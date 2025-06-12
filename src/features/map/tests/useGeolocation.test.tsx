import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useGeolocation } from '../hooks/useGeolocation';
import { useToast } from '@/shared/hooks/useToast';

// Mock GeolocationPositionError
global.GeolocationPositionError = {
  PERMISSION_DENIED: 1,
  POSITION_UNAVAILABLE: 2,
  TIMEOUT: 3,
} as any;

// Mock the toast hook
vi.mock('@/shared/hooks/useToast', () => ({
  useToast: vi.fn(() => ({
    toast: vi.fn(),
  })),
}));

// Mock IP geolocation
vi.mock('../utils/ipGeolocation', () => ({
  getIPLocation: vi.fn(() => Promise.resolve({
    lat: 40.7128,
    lng: -74.0060,
    accuracy: 25000,
    source: 'test'
  })),
}));

describe('useGeolocation', () => {
  const mockToast = vi.fn();
  
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useToast).mockReturnValue({ toast: mockToast });
    
    // Mock geolocation API
    Object.defineProperty(global.navigator, 'geolocation', {
      value: {
        getCurrentPosition: vi.fn(),
      },
      writable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should handle successful geolocation', async () => {
    const mockPosition = {
      coords: {
        latitude: 40.7128,
        longitude: -74.0060,
        accuracy: 10,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
        toJSON: vi.fn(),
      },
      timestamp: Date.now(),
    };

    // Mock successful geolocation
    vi.mocked(navigator.geolocation.getCurrentPosition).mockImplementation(
      (success) => {
        setTimeout(() => success(mockPosition), 100);
      }
    );

    const { result } = renderHook(() => useGeolocation());

    // Initially should be in default state
    expect(result.current.loading).toBe(false);
    expect(result.current.coords).toBe(null);
    expect(result.current.error).toBe(null);

    // Trigger location request
    act(() => {
      act(() => {
      result.current.getLocation();
    });
    });

    // Should be loading
    expect(result.current.loading).toBe(true);

    // Wait for success
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.coords).toEqual(mockPosition.coords);
      expect(result.current.error).toBe(null);
    });

    // Should show success toast
    expect(mockToast).toHaveBeenCalledWith({
      title: "Location found",
      description: "±10m accuracy (network-fast)",
    });
  });

  it('should handle permission denied', async () => {
    const mockError = {
      code: GeolocationPositionError.PERMISSION_DENIED,
      message: 'Permission denied',
    };

    // Mock permission denied
    vi.mocked(navigator.geolocation.getCurrentPosition).mockImplementation(
      (_, error) => {
        setTimeout(() => error?.(mockError), 100);
      }
    );

    const { result } = renderHook(() => useGeolocation());

    result.current.getLocation();

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe("Location access denied");
      expect(result.current.coords).toBe(null);
    });

    // Should show permission denied toast
    expect(mockToast).toHaveBeenCalledWith({
      title: "Location access denied",
      description: "Please enable location access in your browser settings",
      variant: "destructive",
    });
  });

  it('should fallback to IP geolocation after all strategies fail', async () => {
    const mockError = {
      code: GeolocationPositionError.TIMEOUT,
      message: 'Timeout',
    };

    // Mock all geolocation attempts to fail
    vi.mocked(navigator.geolocation.getCurrentPosition).mockImplementation(
      (_, error) => {
        setTimeout(() => error?.(mockError), 100);
      }
    );

    const { result } = renderHook(() => useGeolocation());

    result.current.getLocation();

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.coords).toBeTruthy();
      expect(result.current.coords?.latitude).toBe(40.7128);
      expect(result.current.coords?.longitude).toBe(-74.0060);
      expect(result.current.coords?.accuracy).toBe(25000);
    }, { timeout: 10000 });

    // Should show IP location toast
    expect(mockToast).toHaveBeenCalledWith({
      title: "Location found",
      description: "Using approximate location (~25km accuracy)",
    });
  });

  it('should handle no geolocation support', () => {
    // Remove geolocation support
    Object.defineProperty(global.navigator, 'geolocation', {
      value: undefined,
      writable: true,
    });

    const { result } = renderHook(() => useGeolocation());

    act(() => {
      result.current.getLocation();
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe("Geolocation is not supported by your browser");
    expect(result.current.coords).toBe(null);

    expect(mockToast).toHaveBeenCalledWith({
      title: "Geolocation not supported",
      description: "Geolocation is not supported by your browser",
      variant: "destructive",
    });
  });

  it('should use custom options when provided', async () => {
    const mockPosition = {
      coords: {
        latitude: 40.7128,
        longitude: -74.0060,
        accuracy: 50,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
        toJSON: vi.fn(),
      },
      timestamp: Date.now(),
    };

    let capturedOptions: PositionOptions | undefined;

    vi.mocked(navigator.geolocation.getCurrentPosition).mockImplementation(
      (success, _, options) => {
        capturedOptions = options;
        setTimeout(() => success(mockPosition), 100);
      }
    );

    const { result } = renderHook(() => 
      useGeolocation({
        enableHighAccuracy: false,
        timeout: 5000,
        maximumAge: 60000,
      })
    );

    act(() => {
      result.current.getLocation();
    });

    await waitFor(() => {
      expect(result.current.coords).toBeTruthy();
    });

    // Should use custom options
    expect(capturedOptions?.enableHighAccuracy).toBe(false);
    expect(capturedOptions?.timeout).toBe(5000);
    expect(capturedOptions?.maximumAge).toBe(60000);
  });
});