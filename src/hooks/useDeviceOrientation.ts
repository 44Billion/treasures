import { useState, useCallback, useRef, useEffect } from 'react';

interface DeviceOrientationState {
  /** Compass heading in degrees (0-360, 0 = North, clockwise). null if unavailable. */
  heading: number | null;
  /** Accuracy of the compass heading in degrees. null if unavailable. */
  accuracy: number | null;
  /** Whether the device orientation API is supported */
  isSupported: boolean;
  /** Whether permission has been granted */
  permissionGranted: boolean;
  /** Error message if something went wrong */
  error: string | null;
}

// Minimum ms between state updates to React. Sensor fires at ~60Hz,
// but we only need ~15Hz for a smooth compass animation.
const THROTTLE_MS = 66;

// Low-pass filter alpha. Lower = smoother but laggier. 0.3 keeps the
// compass responsive enough to follow the user's movement while still
// filtering out magnetometer noise.
const SMOOTHING_ALPHA = 0.3;

/**
 * Hook that provides compass heading from the device's magnetometer.
 *
 * - Smooths readings with a low-pass filter to avoid jitter
 * - Throttles React state updates to ~10Hz
 * - Handles iOS requestPermission + Android sensor start
 * - Call `requestPermission()` from a user gesture to activate
 */
export function useDeviceOrientation() {
  const [state, setState] = useState<DeviceOrientationState>({
    heading: null,
    accuracy: null,
    isSupported: typeof window !== 'undefined' && 'DeviceOrientationEvent' in window,
    permissionGranted: false,
    error: null,
  });

  const smoothedHeading = useRef<number | null>(null);
  const lastUpdateTime = useRef<number>(0);
  const isListening = useRef(false);

  // Low-pass filter with proper wraparound handling
  const smoothHeading = useCallback((raw: number): number => {
    if (smoothedHeading.current === null) {
      smoothedHeading.current = raw;
      return raw;
    }

    const prev = smoothedHeading.current;

    // Shortest-path delta across the 360/0 boundary
    let delta = raw - prev;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;

    // Reject wild spikes (> 60 deg jump in a single frame is likely noise)
    if (Math.abs(delta) > 60) {
      return prev;
    }

    const smoothed = (prev + SMOOTHING_ALPHA * delta + 360) % 360;
    smoothedHeading.current = smoothed;
    return smoothed;
  }, []);

  // Handle device orientation events -- called at sensor rate (~60Hz)
  const handleOrientation = useCallback((event: DeviceOrientationEvent) => {
    let heading: number | null = null;
    let accuracy: number | null = null;

    // iOS: webkitCompassHeading gives true north directly
    const webkitHeading = (event as DeviceOrientationEvent & { webkitCompassHeading?: number }).webkitCompassHeading;
    const webkitAccuracy = (event as DeviceOrientationEvent & { webkitCompassAccuracy?: number }).webkitCompassAccuracy;

    if (typeof webkitHeading === 'number' && webkitHeading >= 0) {
      heading = webkitHeading;
      accuracy = typeof webkitAccuracy === 'number' ? webkitAccuracy : null;
    } else if (event.alpha !== null) {
      heading = (360 - event.alpha) % 360;
    }

    if (heading === null) return;

    // Always feed the smoother (even if we don't update React state yet)
    const smoothed = smoothHeading(heading);

    // Throttle React state updates
    const now = performance.now();
    if (now - lastUpdateTime.current < THROTTLE_MS) return;
    lastUpdateTime.current = now;

    setState(prev => ({
      ...prev,
      heading: Math.round(smoothed),
      accuracy,
      permissionGranted: true,
      error: null,
    }));
  }, [smoothHeading]);

  // Track whether the user has activated the compass (permission granted, should be listening)
  const isActivated = useRef(false);

  const addListeners = useCallback(() => {
    // Prefer absolute orientation (true north on Android Chrome)
    if ('ondeviceorientationabsolute' in window) {
      window.addEventListener('deviceorientationabsolute' as 'deviceorientation', handleOrientation, true);
    }
    window.addEventListener('deviceorientation', handleOrientation, true);
  }, [handleOrientation]);

  const removeListeners = useCallback(() => {
    window.removeEventListener('deviceorientation', handleOrientation, true);
    window.removeEventListener('deviceorientationabsolute' as 'deviceorientation', handleOrientation, true);
  }, [handleOrientation]);

  const startListening = useCallback(() => {
    if (isListening.current) return;
    isListening.current = true;
    isActivated.current = true;
    addListeners();
  }, [addListeners]);

  const stopListening = useCallback(() => {
    if (!isListening.current) return;
    isListening.current = false;
    isActivated.current = false;
    removeListeners();
  }, [removeListeners]);

  // Re-register listeners when the page becomes visible again.
  // Mobile browsers often stop delivering deviceorientation events after
  // the page goes to the background (screen lock, app switch, etc.).
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!isActivated.current) return;

      if (document.visibilityState === 'hidden') {
        // Page is going to background — remove listeners to save battery
        if (isListening.current) {
          removeListeners();
          isListening.current = false;
        }
      } else {
        // Page is visible again — re-register listeners so heading updates resume
        if (!isListening.current) {
          addListeners();
          isListening.current = true;
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [addListeners, removeListeners]);

  /**
   * Request permission and start listening. Must be called from a user gesture.
   */
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!state.isSupported) {
      setState(prev => ({ ...prev, error: 'Device orientation not supported' }));
      return false;
    }

    // iOS 13+: explicit permission API
    const DOE = DeviceOrientationEvent as unknown as {
      requestPermission?: () => Promise<string>;
    };

    if (typeof DOE.requestPermission === 'function') {
      try {
        const result = await DOE.requestPermission();
        if (result === 'granted') {
          setState(prev => ({ ...prev, permissionGranted: true, error: null }));
          startListening();
          return true;
        } else {
          setState(prev => ({ ...prev, error: 'Sensor permission denied' }));
          return false;
        }
      } catch (err: unknown) {
        const error = err as Error;
        setState(prev => ({ ...prev, error: error.message || 'Failed to request sensor permission' }));
        return false;
      }
    }

    // Android / other: start listening, sensor data will arrive if available
    startListening();

    return new Promise<boolean>((resolve) => {
      let checks = 0;
      const interval = setInterval(() => {
        checks++;
        if (smoothedHeading.current !== null) {
          clearInterval(interval);
          resolve(true);
        } else if (checks >= 20) {
          clearInterval(interval);
          resolve(false);
        }
      }, 100);
    });
  }, [state.isSupported, startListening]);

  return {
    ...state,
    requestPermission,
    stopListening,
  };
}
