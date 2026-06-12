import { useState, useEffect, useCallback, useRef } from 'react';
import { useDeviceOrientation } from './useDeviceOrientation';

interface CompassTarget {
  lat: number;
  lng: number;
}

interface CompassState {
  /** Bearing from user to target in degrees (0-360, 0 = North) */
  bearing: number | null;
  /** Distance from user to target in meters */
  distance: number | null;
  /** The rotation angle for the compass arrow (degrees, CSS-ready) */
  arrowRotation: number | null;
  /** User's compass heading (0-360, 0 = North) */
  heading: number | null;
  /** Whether the compass is fully operational (has position + target) */
  isActive: boolean;
  /** Whether we're waiting for GPS position */
  isLocating: boolean;
  /** Whether the compass sensor is available */
  hasCompass: boolean;
  /** Whether we need to request sensor permission (iOS) */
  needsPermission: boolean;
  /** GPS accuracy in meters */
  gpsAccuracy: number | null;
  /** Compass accuracy in degrees (lower = better) */
  compassAccuracy: number | null;
  /** Error message (GPS/location errors) */
  error: string | null;
  /** Sensor-specific error (orientation/motion sensor issues) */
  sensorError: string | null;
}

/**
 * Calculate the initial bearing from point A to point B using the forward azimuth formula.
 * Returns degrees (0-360, 0 = North, clockwise).
 */
function calculateBearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => deg * (Math.PI / 180);
  const toDeg = (rad: number) => rad * (180 / Math.PI);

  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);
  const deltaLambda = toRad(lng2 - lng1);

  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) -
            Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);

  const bearing = (toDeg(Math.atan2(y, x)) + 360) % 360;
  return bearing;
}

/**
 * Calculate the Haversine distance between two points.
 * Returns distance in meters.
 */
function calculateDistanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000; // Earth's radius in meters
  const toRad = (deg: number) => deg * (Math.PI / 180);

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Format distance for display.
 */
export function formatCompassDistance(meters: number): string {
  if (meters < 10) {
    return `${meters.toFixed(1)}m`;
  } else if (meters < 1000) {
    return `${Math.round(meters)}m`;
  } else if (meters < 10000) {
    return `${(meters / 1000).toFixed(1)}km`;
  } else {
    return `${Math.round(meters / 1000)}km`;
  }
}

/**
 * Get a cardinal direction label from a bearing.
 */
export function getBearingLabel(bearing: number): string {
  const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const index = Math.round(bearing / 45) % 8;
  return directions[index] || 'N';
}

// Geolocation strategies, run IN PARALLEL (same approach as the app's
// useGeolocation hook). The strategies must run concurrently, not
// sequentially: a cold/silent network attempt would otherwise eat its full
// timeout before the GPS attempt even starts, pushing the GPS attempt past
// the initial-fix deadline -- making the first attempt fail while the warmed
// OS cache makes the second succeed instantly.
const GPS_STRATEGIES = [
  { enableHighAccuracy: false, timeout: 4000, maximumAge: 60000, name: 'network-fast' },
  { enableHighAccuracy: true, timeout: 6000, maximumAge: 30000, name: 'gps' },
] as const;

// Long-running rescue request: a cold GPS fix can take longer than the
// bounded strategy timeouts. While it runs, the locating spinner stays on and
// no error is shown; only if the rescue also fails do we surface a failure.
const RESCUE_TIMEOUT_MS = 30000;

// Extra guard beyond the browser-level timeout, in case the provider never
// invokes either callback (seen behind full-tunnel VPNs).
const RESCUE_TIMEOUT_BUFFER_MS = 1000;

/**
 * Hook that provides a compass pointing toward a target geocache.
 * Combines device orientation (compass heading) with GPS position
 * to calculate the direction and distance to the target.
 * 
 * Uses a multi-strategy approach for geolocation:
 * 1. Fast network-based positioning (cell/wifi) for a quick, reliable fix
 * 2. High-accuracy GPS for precise positioning (also works offline)
 *
 * Every request is time-bounded, so the locating state always clears.
 * After the initial fix, starts watchPosition for continuous updates.
 */
export function useCompass(target: CompassTarget | null) {
  const [userPosition, setUserPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const watchId = useRef<number | null>(null);
  const hasPosition = useRef(false);
  // Tracking session guard: late async callbacks (slow strategies, the rescue
  // request) must not mutate state after stopTracking or across a restart.
  const trackingSession = useRef(0);

  // Continuous rotation accumulator. Instead of clamping to 0-360 with modulo,
  // we track total rotation so CSS transitions always take the short path.
  // e.g. 350 -> 370 (instead of 350 -> 10 which spins backwards).
  const continuousRotation = useRef<number | null>(null);

  const orientation = useDeviceOrientation();

  const applyPosition = useCallback((coords: GeolocationCoordinates) => {
    setUserPosition({ lat: coords.latitude, lng: coords.longitude });
    setGpsAccuracy(coords.accuracy);
    setIsLocating(false);
    setGpsError(null);
    hasPosition.current = true;
  }, []);

  // Try a single getCurrentPosition with given options, wrapped in a promise.
  const tryGetPosition = useCallback((options: PositionOptions): Promise<GeolocationPosition> => {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Timeout after ${options.timeout}ms`));
      }, (options.timeout ?? 10000) + 1000); // Extra buffer beyond browser timeout

      navigator.geolocation.getCurrentPosition(
        (pos) => { clearTimeout(timeoutId); resolve(pos); },
        (err) => { clearTimeout(timeoutId); reject(err); },
        options,
      );
    });
  }, []);

  // Phase 2: continuous position updates. Guarded so concurrent strategy
  // successes can't start two watches.
  const startWatch = useCallback(() => {
    if (watchId.current !== null) return;
    watchId.current = navigator.geolocation.watchPosition(
      (position) => {
        applyPosition(position.coords);
      },
      (error) => {
        // watchPosition errors are often transient (GPS lost signal briefly).
        // Only surface the error if we've never gotten a position.
        // If we already have a position, silently keep the last known position.
        if (!hasPosition.current) {
          setIsLocating(false);
          if (error.code === GeolocationPositionError.PERMISSION_DENIED) {
            setGpsError('Location access denied. Please enable location in your browser settings.');
          } else {
            setGpsError('Location signal lost. Try moving to an area with better reception.');
          }
        }
        // If we already have a position, don't overwrite it with an error.
        // The watch will fire success again when signal is reacquired.
      },
      {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 2000, // Keep positions fresh (2s) so compass updates as the user walks
      }
    );
  }, [applyPosition]);

  // Start watching GPS position
  const startTracking = useCallback(async () => {
    if (!navigator.geolocation) {
      setGpsError('Geolocation is not supported by your browser');
      return;
    }

    // Clear any previous watch
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }

    const session = ++trackingSession.current;
    const isStale = () => trackingSession.current !== session;

    setIsLocating(true);
    setGpsError(null);
    hasPosition.current = false;

    // Request sensor permission (handles iOS requestPermission + Android listener start).
    // Must happen in user gesture context.
    await orientation.requestPermission();
    if (isStale()) return;

    // Phase 1: Get an initial fix by racing the strategies in parallel; the
    // first success wins. This is more reliable than watchPosition alone,
    // which on some browsers fires an error immediately if high-accuracy
    // isn't available.
    //
    // Every request below is time-bounded (tryGetPosition has a manual guard
    // beyond the browser timeout, and the rescue request has its own), so the
    // locating spinner is guaranteed to clear without a separate deadline.
    let gotInitialFix = false;

    let permissionDenied = false;

    await Promise.allSettled(GPS_STRATEGIES.map(async (strategy) => {
      try {
        const position = await tryGetPosition({
          enableHighAccuracy: strategy.enableHighAccuracy,
          timeout: strategy.timeout,
          maximumAge: strategy.maximumAge,
        });

        if (isStale() || gotInitialFix) return;
        gotInitialFix = true;
        applyPosition(position.coords);
        startWatch(); // Begin continuous updates immediately on first fix
      } catch (err: unknown) {
        const error = err as GeolocationPositionError | Error;

        if ('code' in error && error.code === GeolocationPositionError.PERMISSION_DENIED) {
          permissionDenied = true;
        } else {
          // Other errors (timeout, unavailable) -- the parallel sibling may still succeed
          console.warn(`Compass GPS strategy "${strategy.name}" failed:`, error.message || error);
        }
      }
    }));

    if (isStale() || gotInitialFix) return;

    if (permissionDenied) {
      setIsLocating(false);
      setGpsError('Location access denied. Please enable location in your browser settings.');
      return;
    }

    // Last-chance rescue: a cold GPS fix can take longer than the strategy
    // timeouts. Keep the locating spinner on and keep one long-running
    // request alive; only if THIS also fails do we surface an error. Showing
    // the error earlier (while the rescue was still trying) just trained
    // users to close and reopen the compass.
    const surfaceFailure = () => {
      if (isStale() || hasPosition.current) return;
      setIsLocating(false);
      setGpsError('Unable to determine your location. Make sure location services are enabled and try again.');
    };
    // Manual guard in case the provider never invokes either callback.
    const rescueGuard = setTimeout(surfaceFailure, RESCUE_TIMEOUT_MS + RESCUE_TIMEOUT_BUFFER_MS);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        clearTimeout(rescueGuard);
        if (isStale()) return;
        applyPosition(position.coords);
        startWatch();
      },
      (err) => {
        clearTimeout(rescueGuard);
        console.warn('Compass GPS rescue failed:', err.message || err);
        surfaceFailure();
      },
      { enableHighAccuracy: true, timeout: RESCUE_TIMEOUT_MS, maximumAge: 0 }
    );
  }, [orientation, tryGetPosition, applyPosition, startWatch]);

  // Stop watching position and orientation sensors
  const stopTracking = useCallback(() => {
    trackingSession.current++;
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
    orientation.stopListening();
    setIsLocating(false);
    hasPosition.current = false;
    continuousRotation.current = null;
  }, [orientation]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (watchId.current !== null) {
        navigator.geolocation.clearWatch(watchId.current);
        watchId.current = null;
      }
    };
  }, []);

  // Re-establish GPS watch when page becomes visible again.
  // Mobile browsers often stop delivering watchPosition updates when the
  // page is backgrounded (screen lock, app switch, notification shade).
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;
      if (watchId.current === null) return; // Not actively tracking
      if (!hasPosition.current) return; // Still in initial fix phase

      // Restart the watch to ensure fresh position updates resume
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = navigator.geolocation.watchPosition(
        (position) => {
          applyPosition(position.coords);
        },
        () => {
          // Silently ignore — we already have a position, and the watch
          // will fire success again when signal is reacquired.
        },
        {
          enableHighAccuracy: true,
          timeout: 20000,
          maximumAge: 2000,
        }
      );
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [applyPosition]);

  // Calculate compass state
  const state: CompassState = (() => {
    const heading = orientation.heading;
    const hasCompass = orientation.isSupported && orientation.permissionGranted && heading !== null;

    if (!target) {
      return {
        bearing: null,
        distance: null,
        arrowRotation: null,
        heading,
        isActive: false,
        isLocating,
        hasCompass,
        needsPermission: !orientation.permissionGranted,
        gpsAccuracy,
        compassAccuracy: orientation.accuracy,
        error: gpsError || null,
        sensorError: orientation.error || null,
      };
    }

    if (!userPosition) {
      return {
        bearing: null,
        distance: null,
        arrowRotation: null,
        heading,
        isActive: false,
        isLocating,
        hasCompass,
        needsPermission: !orientation.permissionGranted,
        gpsAccuracy,
        compassAccuracy: orientation.accuracy,
        error: gpsError || null,
        sensorError: orientation.error || null,
      };
    }

    const bearing = calculateBearing(
      userPosition.lat, userPosition.lng,
      target.lat, target.lng
    );

    const distance = calculateDistanceMeters(
      userPosition.lat, userPosition.lng,
      target.lat, target.lng
    );

    // Arrow rotation: bearing relative to heading (or absolute if no compass).
    // Use continuous rotation to avoid CSS transition flips at 0/360 boundary.
    const rawRotation = heading !== null
      ? (bearing - heading + 360) % 360
      : bearing;

    let arrowRotation: number;
    if (continuousRotation.current === null) {
      continuousRotation.current = rawRotation;
      arrowRotation = rawRotation;
    } else {
      // Find shortest delta and accumulate
      let delta = rawRotation - (continuousRotation.current % 360 + 360) % 360;
      if (delta > 180) delta -= 360;
      if (delta < -180) delta += 360;
      continuousRotation.current += delta;
      arrowRotation = continuousRotation.current;
    }

    return {
      bearing,
      distance,
      arrowRotation,
      heading,
      isActive: true,
      isLocating: false,
      hasCompass,
      needsPermission: !orientation.permissionGranted,
      gpsAccuracy,
      compassAccuracy: orientation.accuracy,
      error: null,
      sensorError: orientation.error || null,
    };
  })();

  return {
    ...state,
    startTracking,
    stopTracking,
    requestPermission: orientation.requestPermission,
  };
}
