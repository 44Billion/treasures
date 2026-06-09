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

// Geolocation strategies, ordered for reliability on Android.
//
// IMPORTANT: do NOT lead with enableHighAccuracy: true. On Android, opening
// with a cold high-accuracy GPS request frequently hangs or returns
// POSITION_UNAVAILABLE, and once that first request fails the rapid retries
// tend to fail too -- so every strategy fails and no location is ever found.
//
// Instead we lead with fast network positioning (instant + reliable when
// online), then attempt high-accuracy GPS (which is also the path that works
// fully offline), then fall back to a longer-cached network fix.
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

// Hard ceiling on the entire getLocation() flow. No matter what happens
// (silent provider, hanging fetch, VPN blocking IP services, etc.), the
// loading state is guaranteed to clear within this window so the UI never
// spins forever.
const OVERALL_DEADLINE_MS = 8000;

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

    // Track whether we've already produced a terminal result, so the overall
    // deadline guard and the strategy loop never fight over the final state.
    let settled = false;
    const finish = (next: GeolocationState) => {
      if (settled) return;
      settled = true;
      setState(next);
    };

    // Hard safety net: whatever happens below, the spinner stops by the
    // deadline. Without this, a silent geolocation provider (e.g. behind a
    // full-tunnel VPN with no usable location service) leaves loading=true
    // forever and the UI spins indefinitely.
    const deadline = setTimeout(() => {
      if (settled) return;
      settled = true;
      setState({ loading: false, error: 'Unable to determine location', coords: null });
      toast({
        title: t('map.nearMe.unavailable.title', 'Location unavailable'),
        description: t(
          'map.nearMe.unavailable.description',
          "We couldn't determine your location. Check your GPS or try again in a moment."
        ),
        variant: 'destructive',
      });
    }, OVERALL_DEADLINE_MS);

    // When offline, the network-positioning strategies and the IP fallback
    // can't work (they need internet), so skip straight to the GPS chip, which
    // is the only thing that works with no connection.
    const isOffline = navigator.onLine === false;
    const strategies = isOffline
      ? GEOLOCATION_STRATEGIES.filter((s) => s.enableHighAccuracy)
      : GEOLOCATION_STRATEGIES;

    // Background upgrade: request a high-accuracy GPS fix and adopt it only if
    // it's actually more accurate than the network fix we already have. Runs
    // fire-and-forget so it never blocks or breaks the initial lock.
    const upgradeToGps = (currentAccuracy: number) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (pos.coords.accuracy <= currentAccuracy) {
            setState({ loading: false, error: null, coords: pos.coords });
          }
        },
        (err) => {
          // GPS upgrade is best-effort; keep the network fix on failure.
          console.warn('GPS accuracy upgrade failed:', err.message || err);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    };

    // Try each strategy in sequence
    for (let i = 0; i < strategies.length; i++) {
      if (settled) break;
      const strategy = strategies[i];
      if (!strategy) break;
      
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          const timeoutId = setTimeout(() => {
            reject(new Error(`Timeout after ${strategy.timeout}ms`));
          }, strategy.timeout);

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
              timeout: options.timeout ?? strategy.timeout,
              maximumAge: options.maximumAge ?? strategy.maximumAge,
            }
          );
        });

        // Success! Update state silently (no toast on a successful lock)
        clearTimeout(deadline);
        finish({
          loading: false,
          error: null,
          coords: position.coords,
        });

        // If this was a fast network fix, kick off a high-accuracy GPS request
        // in the background. Network positioning gives a quick, reliable lock,
        // but GPS is far more accurate -- so we upgrade once it's available
        // without blocking the initial result. (Skip if the caller forced
        // low accuracy via options.)
        const usedHighAccuracy =
          options.enableHighAccuracy ?? strategy.enableHighAccuracy;
        if (!usedHighAccuracy) {
          upgradeToGps(position.coords.accuracy);
        }

        return; // Exit early on success

      } catch (error: unknown) {
        const err = error as GeolocationPositionError | Error;
        
        // Handle permission denied immediately (don't try other strategies)
        if ('code' in err && err.code === GeolocationPositionError.PERMISSION_DENIED) {
          clearTimeout(deadline);
          finish({
            loading: false,
            error: "Location access denied",
            coords: null,
          });
          toast({
            title: t('map.nearMe.denied.title', 'Location access blocked'),
            description: t(
              'map.nearMe.denied.description',
              'Enable location in your browser settings to use Near Me.'
            ),
            variant: "destructive",
          });
          return;
        }

        // For other errors, continue to next strategy
        console.warn(`Geolocation strategy ${strategy.name} failed:`, err.message || err);
      }
    }

    // All device strategies failed. Try a quick IP-based estimate as a last
    // resort (online only; it needs internet). The overall deadline still caps
    // total time, so this can't cause an infinite spin even if it hangs.
    if (!settled && !isOffline) {
      try {
        const ipLocation = await getIPLocation();
        if (ipLocation && !settled) {
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

          clearTimeout(deadline);
          finish({
            loading: false,
            error: null,
            coords: mockCoords,
          });
          return;
        }
      } catch (ipError) {
        console.warn('IP geolocation also failed:', ipError);
      }
    }

    // Everything failed (and we're still before the deadline). Surface the
    // failure now rather than waiting for the deadline timer.
    if (!settled) {
      clearTimeout(deadline);
      finish({
        loading: false,
        error: 'Unable to determine location',
        coords: null,
      });
      toast({
        title: t('map.nearMe.unavailable.title', 'Location unavailable'),
        description: t(
          'map.nearMe.unavailable.description',
          "We couldn't determine your location. Check your GPS or try again in a moment."
        ),
        variant: "destructive",
      });
    }
  }, [options.enableHighAccuracy, options.timeout, options.maximumAge, toast, t]);

  return {
    ...state,
    getLocation,
  };
}