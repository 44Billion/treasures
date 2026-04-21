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

// Spike detection: threshold for "large jump" and how many consecutive
// large jumps we tolerate before accepting the new heading as a real turn.
const SPIKE_THRESHOLD_DEG = 120;
const SPIKE_ACCEPT_COUNT = 3;

/**
 * Trigger sensor permission on Android Chrome via the Generic Sensor API.
 *
 * Android Chrome has no `DeviceOrientationEvent.requestPermission()` like iOS.
 * The only way to trigger the browser's permission prompt is to construct a
 * Generic Sensor object (e.g. `AbsoluteOrientationSensor`). If the user hasn't
 * granted permission yet, Chrome will show its permission dialog.
 *
 * Returns `true` if permission is granted, `false` otherwise.
 */
async function requestSensorPermissionAndroid(): Promise<boolean> {
  // Try the Permissions API first to check current status
  if (navigator.permissions) {
    try {
      // Chrome gates deviceorientation behind the 'accelerometer' permission
      const result = await navigator.permissions.query(
        { name: 'accelerometer' as PermissionName },
      );
      if (result.state === 'granted') return true;
      if (result.state === 'denied') return false;
      // 'prompt' — fall through to trigger the prompt via sensor construction
    } catch {
      // permissions.query may not support 'accelerometer' — fall through
    }
  }

  // Construct a Generic Sensor to trigger Chrome's permission prompt.
  // AbsoluteOrientationSensor is the most relevant for compass heading.
  const win = window as any;
  const SensorClass = win.AbsoluteOrientationSensor ?? win.Accelerometer;

  if (typeof SensorClass === 'function') {
    return new Promise<boolean>((resolve) => {
      try {
        const sensor = new (SensorClass as new (opts: Record<string, unknown>) => {
          start(): void;
          stop(): void;
          addEventListener(type: string, cb: () => void): void;
        })({ frequency: 1 });

        sensor.addEventListener('error', () => {
          sensor.stop();
          resolve(false);
        });
        sensor.addEventListener('reading', () => {
          sensor.stop();
          resolve(true);
        });
        sensor.start();

        // Safety timeout — if neither callback fires within 4s, assume denied
        setTimeout(() => {
          sensor.stop();
          resolve(false);
        }, 4000);
      } catch {
        // Sensor construction failed — permission may be blocked by policy
        resolve(false);
      }
    });
  }

  // No Generic Sensor API available — optimistically assume events will fire.
  // This covers older Android browsers and other platforms.
  return true;
}

/**
 * Hook that provides compass heading from the device's magnetometer.
 *
 * - Smooths readings with a low-pass filter to avoid jitter
 * - Throttles React state updates to ~15Hz
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
  // Spike detection: count consecutive large-delta readings
  const spikeCount = useRef(0);

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

    // Spike detection: reject isolated large jumps (sensor glitches), but
    // accept sustained ones (real fast turns). If we see SPIKE_ACCEPT_COUNT
    // consecutive readings far from the smoothed value, it's a real turn —
    // snap to the new heading instead of crawling via the low-pass filter.
    if (Math.abs(delta) > SPIKE_THRESHOLD_DEG) {
      spikeCount.current++;
      if (spikeCount.current >= SPIKE_ACCEPT_COUNT) {
        // Sustained large delta — accept as real turn
        smoothedHeading.current = raw;
        spikeCount.current = 0;
        return raw;
      }
      return prev;
    }
    spikeCount.current = 0;

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

  // Which event name was actually registered — used for clean removal.
  const activeEventName = useRef<string | null>(null);

  const addListeners = useCallback(() => {
    // Register exactly ONE listener. On Android Chrome both
    // `deviceorientationabsolute` (true north) and `deviceorientation`
    // (relative) fire simultaneously. Registering both feeds two different
    // reference frames into the smoothing filter, which corrupts the heading
    // and makes the compass appear frozen.
    if ('ondeviceorientationabsolute' in window) {
      activeEventName.current = 'deviceorientationabsolute';
    } else {
      activeEventName.current = 'deviceorientation';
    }
    window.addEventListener(
      activeEventName.current as 'deviceorientation',
      handleOrientation,
      true,
    );
  }, [handleOrientation]);

  const removeListeners = useCallback(() => {
    // Remove whichever single listener was registered
    if (activeEventName.current) {
      window.removeEventListener(
        activeEventName.current as 'deviceorientation',
        handleOrientation,
        true,
      );
      activeEventName.current = null;
    }
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

    // Android Chrome: trigger sensor permission prompt via the Generic Sensor API.
    // Unlike iOS, Android has no DeviceOrientationEvent.requestPermission().
    // The only way to trigger Chrome's permission dialog is to construct a
    // sensor object — this prompts the user if permission hasn't been granted.
    const sensorGranted = await requestSensorPermissionAndroid();
    if (!sensorGranted) {
      setState(prev => ({ ...prev, error: 'Sensor permission denied. Enable motion sensors in site settings.' }));
      return false;
    }

    // Permission granted — start listening for deviceorientation events
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
