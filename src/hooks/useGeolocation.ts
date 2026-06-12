import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '@/hooks/useToast';
import { getIPLocation } from '../utils/ipGeolocation';

interface GeolocationState {
  loading: boolean;
  error: string | null;
  coords: GeolocationCoordinates | null;
}

interface UseGeolocationOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
}

// Geolocation strategies, run IN PARALLEL (first usable fix wins).
//
// IMPORTANT: the strategies must run concurrently, not sequentially. When run
// one after the other, a cold/silent network attempt eats its full timeout
// before the GPS attempt even starts, pushing the GPS attempt past the overall
// UI deadline -- so the FIRST attempt always failed on a cold cache, while the
// (aborted) requests warmed the OS location cache and made the SECOND attempt
// succeed instantly via maximumAge. Running them in parallel keeps the worst
// case within the deadline.
const GEOLOCATION_STRATEGIES = [
  // Strategy 1: Fast network positioning (cell/wifi) - quick and reliable online
  {
    enableHighAccuracy: false,
    timeout: 4000,             // Quick timeout for fast feedback
    maximumAge: 60000,         // 1 minute - fresh enough for most use cases
    name: 'network-fast'
  },
  // Strategy 2: High-accuracy GPS (most accurate; also works fully offline)
  {
    enableHighAccuracy: true,  // Use the device GPS chip directly
    timeout: 6000,             // Bounded so a silent provider can't stall the UI
    maximumAge: 30000,         // 30 seconds - prefer a fresh GPS reading
    name: 'gps-accurate'
  }
];

// Hard ceiling on the loading spinner. No matter what happens (silent
// provider, hanging fetch, VPN blocking IP services, etc.), the loading state
// is guaranteed to clear within this window so the UI never spins forever.
const OVERALL_DEADLINE_MS = 8000;

// Extra guard beyond the browser-level timeout, in case the provider never
// invokes either callback (seen behind full-tunnel VPNs).
const STRATEGY_TIMEOUT_BUFFER_MS = 500;

// Long-running background request used to (a) upgrade a coarse network/IP fix
// to GPS accuracy and (b) rescue a failed attempt: a cold GPS fix can take
// longer than the UI deadline, and when it finally lands we still adopt it so
// the user doesn't have to tap the button a second time.
const RESCUE_TIMEOUT_MS = 30000;

export function useGeolocation(options: UseGeolocationOptions = {}) {
  const [state, setState] = useState<GeolocationState>({
    loading: false,
    error: null,
    coords: null,
  });
  const { toast } = useToast();
  const { t } = useTranslation();

  const getLocation = useCallback(async () => {
    if (!navigator.geolocation) {
      const error = "Geolocation is not supported by your browser";
      setState({ loading: false, error, coords: null });
      toast({
        title: "Geolocation not supported",
        description: error,
        variant: "destructive",
      });
      return;
    }

    setState(prev => ({ ...prev, loading: true, error: null }));

    // Terminal-state coordination:
    // - hasFix: coordinates were applied; only better-accuracy fixes replace them.
    // - failed: an error was surfaced; further errors are ignored, but a late
    //   success may still override the error (see the rescue request below).
    let hasFix = false;
    let failed = false;
    let bestAccuracy = Infinity;

    const succeed = (coords: GeolocationCoordinates) => {
      if (hasFix && coords.accuracy > bestAccuracy) return;
      hasFix = true;
      bestAccuracy = coords.accuracy;
      clearTimeout(deadline);
      setState({ loading: false, error: null, coords });
    };

    const fail = (error: string, title: string, description: string) => {
      if (hasFix || failed) return;
      failed = true;
      clearTimeout(deadline);
      setState({ loading: false, error, coords: null });
      toast({ title, description, variant: "destructive" });
    };

    // Hard safety net: whatever happens below, the spinner stops by the
    // deadline. Without this, a silent geolocation provider (e.g. behind a
    // full-tunnel VPN with no usable location service) leaves loading=true
    // forever and the UI spins indefinitely.
    const deadline = setTimeout(() => {
      fail(
        'Unable to determine location',
        t('map.nearMe.unavailable.title', 'Location unavailable'),
        t(
          'map.nearMe.unavailable.description',
          "We couldn't determine your location. Check your GPS or try again in a moment."
        ),
      );
    }, OVERALL_DEADLINE_MS);

    // When offline, the network-positioning strategy and the IP fallback
    // can't work (they need internet), so skip straight to the GPS chip, which
    // is the only thing that works with no connection.
    const isOffline = navigator.onLine === false;
    const strategies = isOffline
      ? GEOLOCATION_STRATEGIES.filter((s) => s.enableHighAccuracy)
      : GEOLOCATION_STRATEGIES;

    // Single getCurrentPosition attempt with a manual timeout guard slightly
    // beyond the native one, in case the provider never invokes a callback.
    const attempt = (strategy: typeof GEOLOCATION_STRATEGIES[number]): Promise<GeolocationPosition> =>
      new Promise((resolve, reject) => {
        const timeout = options.timeout ?? strategy.timeout;
        const timeoutId = setTimeout(() => {
          reject(new Error(`Timeout after ${timeout}ms`));
        }, timeout + STRATEGY_TIMEOUT_BUFFER_MS);

        navigator.geolocation.getCurrentPosition(
          (pos) => {
            clearTimeout(timeoutId);
            resolve(pos);
          },
          (err) => {
            clearTimeout(timeoutId);
            reject(err);
          },
          {
            enableHighAccuracy: options.enableHighAccuracy ?? strategy.enableHighAccuracy,
            timeout,
            maximumAge: options.maximumAge ?? strategy.maximumAge,
          }
        );
      });

    // Long-running background GPS request. Adopts its fix only if better than
    // what we already have (accuracy upgrade), or if nothing landed at all
    // (late rescue after the deadline error -- the fix still gets applied, so
    // a second tap isn't needed).
    const startRescue = () => {
      navigator.geolocation.getCurrentPosition(
        (pos) => succeed(pos.coords),
        (err) => {
          // Best-effort; keep whatever state we already surfaced.
          console.warn('Background GPS rescue failed:', err.message || err);
        },
        { enableHighAccuracy: true, timeout: RESCUE_TIMEOUT_MS, maximumAge: 0 }
      );
    };

    // Run all strategies in parallel; the first usable fix wins and later,
    // more accurate fixes (GPS after network) upgrade it.
    let permissionDenied = false;
    let gpsStrategySucceeded = false;

    await Promise.allSettled(
      strategies.map(async (strategy) => {
        try {
          const position = await attempt(strategy);
          if (strategy.enableHighAccuracy) gpsStrategySucceeded = true;
          succeed(position.coords);
        } catch (error: unknown) {
          const err = error as GeolocationPositionError | Error;
          if ('code' in err && err.code === GeolocationPositionError.PERMISSION_DENIED) {
            permissionDenied = true;
            fail(
              'Location access denied',
              t('map.nearMe.denied.title', 'Location access blocked'),
              t(
                'map.nearMe.denied.description',
                'Enable location in your browser settings to use Near Me.'
              ),
            );
          } else {
            console.warn(`Geolocation strategy ${strategy.name} failed:`, err.message || err);
          }
        }
      })
    );

    if (permissionDenied) return; // No point making further requests

    if (hasFix) {
      // The fix came from network positioning only; upgrade to GPS accuracy
      // in the background without blocking or breaking the existing lock.
      if (!gpsStrategySucceeded) startRescue();
      return;
    }

    // All device strategies failed. Try a quick IP-based estimate as a last
    // resort (online only; it needs internet). The overall deadline still caps
    // the spinner, and a late success can still override the error.
    if (!isOffline) {
      try {
        const ipLocation = await getIPLocation();
        if (ipLocation && !hasFix) {
          const mockCoords: GeolocationCoordinates = {
            latitude: ipLocation.lat,
            longitude: ipLocation.lng,
            accuracy: ipLocation.accuracy,
            altitude: null,
            altitudeAccuracy: null,
            heading: null,
            speed: null,
            toJSON: () => ({
              latitude: ipLocation.lat,
              longitude: ipLocation.lng,
              accuracy: ipLocation.accuracy,
              altitude: null,
              altitudeAccuracy: null,
              heading: null,
              speed: null,
            })
          };

          succeed(mockCoords);
          // IP accuracy is coarse (~25km); keep trying for a real fix.
          startRescue();
          return;
        }
      } catch (ipError) {
        console.warn('IP geolocation also failed:', ipError);
      }
    }

    // Everything failed. Surface the failure now rather than waiting for the
    // deadline timer...
    fail(
      'Unable to determine location',
      t('map.nearMe.unavailable.title', 'Location unavailable'),
      t(
        'map.nearMe.unavailable.description',
        "We couldn't determine your location. Check your GPS or try again in a moment."
      ),
    );
    // ...but keep one long-running request alive: a cold GPS fix can simply
    // take longer than the UI deadline. When it lands, the location is
    // adopted and the error cleared -- no second attempt needed.
    startRescue();
  }, [options.enableHighAccuracy, options.timeout, options.maximumAge, toast, t]);

  return {
    ...state,
    getLocation,
  };
}
