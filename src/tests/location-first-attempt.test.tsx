/**
 * Regression tests for the "first location attempt fails, second works
 * instantly" bug.
 *
 * Root cause: geolocation strategies ran sequentially (network 4s, then GPS
 * 6s = up to 10s) while the hard UI deadline fired at 8s. On a cold start the
 * network attempt burned its whole window, the GPS attempt got cut off by the
 * deadline, and the (discarded) requests warmed the OS location cache -- so
 * the second attempt resolved instantly from cache.
 *
 * The fix runs the strategies in parallel (worst case inside the deadline)
 * and lets a late-arriving fix override the deadline error.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useCompass } from '@/hooks/useCompass';
import { getIPLocation } from '@/utils/ipGeolocation';

vi.mock('@/hooks/useToast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, def?: string) => def ?? _key }),
}));

vi.mock('@/utils/ipGeolocation', () => ({
  getIPLocation: vi.fn(),
}));

vi.mock('@/hooks/useDeviceOrientation', () => ({
  useDeviceOrientation: () => ({
    heading: null,
    accuracy: null,
    isSupported: false,
    permissionGranted: false,
    error: null,
    requestPermission: vi.fn().mockResolvedValue(undefined),
    stopListening: vi.fn(),
  }),
}));

type SuccessCallback = (position: GeolocationPosition) => void;
type ErrorCallback = (error: unknown) => void;
type GetCurrentPositionMock = ReturnType<typeof vi.fn> &
  ((success: SuccessCallback, error: ErrorCallback, options: PositionOptions) => void);

// Timeouts used to identify which request is which inside the mock.
const GPS_TIMEOUT = 6000;
const RESCUE_TIMEOUT = 30000;

function makePosition(accuracy: number, lat = 44.97, lng = -93.26): GeolocationPosition {
  const coords = {
    latitude: lat,
    longitude: lng,
    accuracy,
    altitude: null,
    altitudeAccuracy: null,
    heading: null,
    speed: null,
    toJSON: () => ({ latitude: lat, longitude: lng, accuracy }),
  } as GeolocationCoordinates;
  return { coords, timestamp: Date.now(), toJSON: () => ({}) } as GeolocationPosition;
}

let getCurrentPosition: GetCurrentPositionMock;
let watchPosition: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.useFakeTimers();
  getCurrentPosition = vi.fn() as GetCurrentPositionMock;
  watchPosition = vi.fn().mockReturnValue(1);
  vi.stubGlobal('navigator', {
    ...window.navigator,
    onLine: true,
    geolocation: {
      getCurrentPosition,
      watchPosition,
      clearWatch: vi.fn(),
    },
  });
  if (!('GeolocationPositionError' in globalThis)) {
    (globalThis as Record<string, unknown>).GeolocationPositionError = class {
      static PERMISSION_DENIED = 1;
      static POSITION_UNAVAILABLE = 2;
      static TIMEOUT = 3;
    };
  }
  vi.mocked(getIPLocation).mockResolvedValue(null);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('useGeolocation first-attempt reliability', () => {
  it('adopts a cold GPS fix on the FIRST attempt even when network positioning is silent', async () => {
    // Network strategy never responds (cold provider); GPS lands after 5s.
    // Under the old sequential flow, GPS would not even get its full window
    // (4s network + 5s GPS = 9s > 8s deadline) and the first attempt failed.
    getCurrentPosition.mockImplementation((success, _error, options) => {
      if (options.enableHighAccuracy && options.timeout === GPS_TIMEOUT) {
        setTimeout(() => success(makePosition(10)), 5000);
      }
      // network + rescue requests stay silent
    });

    const { result } = renderHook(() => useGeolocation());
    act(() => {
      void result.current.getLocation();
    });
    expect(result.current.loading).toBe(true);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(result.current.coords?.accuracy).toBe(10);
    expect(result.current.error).toBeNull();
    expect(result.current.loading).toBe(false);

    // The 8s deadline must NOT clobber the successful fix afterwards.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
    });
    expect(result.current.error).toBeNull();
    expect(result.current.coords?.accuracy).toBe(10);
  });

  it('recovers with a late fix after the deadline error instead of requiring a second attempt', async () => {
    // All bounded strategies stay silent; only the long-running rescue
    // request eventually produces a fix.
    getCurrentPosition.mockImplementation((success, _error, options) => {
      if (options.timeout === RESCUE_TIMEOUT) {
        setTimeout(() => success(makePosition(20)), 5000);
      }
    });

    const { result } = renderHook(() => useGeolocation());
    act(() => {
      void result.current.getLocation();
    });

    // Bounded strategies + IP fallback exhausted -> error surfaces, spinner clears.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(8000);
    });
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeTruthy();

    // ...but the rescue request is still alive; when its fix lands the
    // location is adopted and the error cleared.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(result.current.coords?.accuracy).toBe(20);
    expect(result.current.error).toBeNull();
  });

  it('returns a fast network fix immediately', async () => {
    getCurrentPosition.mockImplementation((success, _error, options) => {
      if (!options.enableHighAccuracy) {
        setTimeout(() => success(makePosition(1500)), 100);
      }
    });

    const { result } = renderHook(() => useGeolocation());
    act(() => {
      void result.current.getLocation();
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    expect(result.current.coords?.accuracy).toBe(1500);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('does not replace an accurate GPS fix with a worse network fix that resolves later', async () => {
    getCurrentPosition.mockImplementation((success, _error, options) => {
      if (options.enableHighAccuracy && options.timeout === GPS_TIMEOUT) {
        setTimeout(() => success(makePosition(8)), 500);
      } else if (!options.enableHighAccuracy) {
        setTimeout(() => success(makePosition(2000)), 2000);
      }
    });

    const { result } = renderHook(() => useGeolocation());
    act(() => {
      void result.current.getLocation();
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(result.current.coords?.accuracy).toBe(8);
  });

  it('surfaces permission denial immediately and does not keep requesting', async () => {
    getCurrentPosition.mockImplementation((_success, error) => {
      setTimeout(() => error({ code: 1, message: 'User denied Geolocation' }), 50);
    });

    const { result } = renderHook(() => useGeolocation());
    act(() => {
      void result.current.getLocation();
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
    expect(result.current.error).toBe('Location access denied');
    expect(result.current.loading).toBe(false);

    // No background rescue after a denial -- only the two strategy requests.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30000);
    });
    expect(getCurrentPosition).toHaveBeenCalledTimes(2);
    expect(result.current.coords).toBeNull();
  });
});

describe('useCompass first-attempt reliability', () => {
  const target = { lat: 44.98, lng: -93.27 };

  it('locks on a cold GPS fix on the FIRST attempt and starts tracking', async () => {
    getCurrentPosition.mockImplementation((success, _error, options) => {
      if (options.enableHighAccuracy && options.timeout === GPS_TIMEOUT) {
        setTimeout(() => success(makePosition(12)), 5000);
      }
      // network strategy stays silent
    });

    const { result } = renderHook(() => useCompass(target));
    await act(async () => {
      void result.current.startTracking();
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.isLocating).toBe(true);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(result.current.isLocating).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.gpsAccuracy).toBe(12);
    expect(result.current.isActive).toBe(true);
    expect(watchPosition).toHaveBeenCalledTimes(1);

    // Deadline must not clobber the fix afterwards.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
    });
    expect(result.current.error).toBeNull();
  });

  it('recovers with a late rescue fix after the initial-fix deadline', async () => {
    getCurrentPosition.mockImplementation((success, _error, options) => {
      if (options.timeout === RESCUE_TIMEOUT) {
        setTimeout(() => success(makePosition(25)), 5000);
      }
    });

    const { result } = renderHook(() => useCompass(target));
    await act(async () => {
      void result.current.startTracking();
      await vi.advanceTimersByTimeAsync(0);
    });

    // Both bounded strategies fail -> error surfaces, spinner clears.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(8000);
    });
    expect(result.current.isLocating).toBe(false);
    expect(result.current.error).toBeTruthy();

    // Rescue fix lands -> compass becomes active and tracking starts.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(result.current.error).toBeNull();
    expect(result.current.gpsAccuracy).toBe(25);
    expect(result.current.isActive).toBe(true);
    expect(watchPosition).toHaveBeenCalledTimes(1);
  });

  it('ignores a late rescue fix after tracking is stopped', async () => {
    getCurrentPosition.mockImplementation((success, _error, options) => {
      if (options.timeout === RESCUE_TIMEOUT) {
        setTimeout(() => success(makePosition(25)), 5000);
      }
    });

    const { result } = renderHook(() => useCompass(target));
    await act(async () => {
      void result.current.startTracking();
      await vi.advanceTimersByTimeAsync(8000);
    });

    act(() => {
      result.current.stopTracking();
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(result.current.isActive).toBe(false);
    expect(watchPosition).not.toHaveBeenCalled();
  });
});
