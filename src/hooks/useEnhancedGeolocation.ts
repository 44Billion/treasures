import { useState, useCallback, useRef } from 'react';
import { useToast } from '@/hooks/useToast';
import { getIPLocation } from '@/lib/ipGeolocation';
import { 
  isFirefoxAndroid, 
  getLocationWithGuidance, 
  getFirefoxAndroidLocation 
} from '@/lib/firefoxAndroidGeolocation';

interface GeolocationState {
  loading: boolean;
  error: string | null;
  coords: GeolocationCoordinates | null;
  accuracy: 'high' | 'medium' | 'low' | null;
  source: 'gps' | 'network' | 'ip' | null;
}

interface UseEnhancedGeolocationOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
  fallbackToIP?: boolean;
}

/**
 * Enhanced geolocation hook with progressive fallback strategy
 * Prioritizes precise location but gracefully falls back to less accurate methods
 */
export function useEnhancedGeolocation(options: UseEnhancedGeolocationOptions = {}) {
  const [state, setState] = useState<GeolocationState>({
    loading: false,
    error: null,
    coords: null,
    accuracy: null,
    source: null,
  });
  const { toast } = useToast();
  const abortControllerRef = useRef<AbortController | null>(null);

  const getLocation = useCallback(async () => {
    // Cancel any ongoing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    if (!navigator.geolocation) {
      const error = "Geolocation is not supported by your browser";
      setState({ loading: false, error, coords: null, accuracy: null, source: null });
      toast({
        title: "Geolocation not supported",
        description: error,
        variant: "destructive",
      });
      return;
    }

    setState(prev => ({ ...prev, loading: true, error: null }));

    // Strategy 1: High accuracy GPS (best for precise location)
    const tryHighAccuracy = (): Promise<GeolocationPosition> => {
      return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error('High accuracy timeout'));
        }, 10000); // 10 second timeout for high accuracy

        navigator.geolocation.getCurrentPosition(
          (position) => {
            clearTimeout(timeoutId);
            resolve(position);
          },
          (error) => {
            clearTimeout(timeoutId);
            reject(error);
          },
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 60000, // 1 minute cache for high accuracy
          }
        );
      });
    };

    // Strategy 2: Network-based location (faster, less accurate)
    const tryNetworkLocation = (): Promise<GeolocationPosition> => {
      return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error('Network location timeout'));
        }, 8000); // 8 second timeout for network

        navigator.geolocation.getCurrentPosition(
          (position) => {
            clearTimeout(timeoutId);
            resolve(position);
          },
          (error) => {
            clearTimeout(timeoutId);
            reject(error);
          },
          {
            enableHighAccuracy: false,
            timeout: 8000,
            maximumAge: 300000, // 5 minute cache for network location
          }
        );
      });
    };

    // Strategy 3: Cached location (fastest)
    const tryCachedLocation = (): Promise<GeolocationPosition> => {
      return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error('Cached location timeout'));
        }, 5000); // 5 second timeout for cached

        navigator.geolocation.getCurrentPosition(
          (position) => {
            clearTimeout(timeoutId);
            resolve(position);
          },
          (error) => {
            clearTimeout(timeoutId);
            reject(error);
          },
          {
            enableHighAccuracy: false,
            timeout: 5000,
            maximumAge: 600000, // 10 minute cache
          }
        );
      });
    };

    const handleSuccess = (position: GeolocationPosition, source: 'gps' | 'network' | 'cached') => {
      if (abortControllerRef.current?.signal.aborted) return;

      let accuracy: 'high' | 'medium' | 'low';
      if (position.coords.accuracy <= 10) {
        accuracy = 'high';
      } else if (position.coords.accuracy <= 100) {
        accuracy = 'medium';
      } else {
        accuracy = 'low';
      }

      setState({
        loading: false,
        error: null,
        coords: position.coords,
        accuracy,
        source: source === 'cached' ? 'network' : source, // Don't expose 'cached' as source
      });

      const accuracyText = accuracy === 'high' ? 'High' : accuracy === 'medium' ? 'Medium' : 'Low';
      const sourceText = source === 'gps' ? 'GPS' : 'Network';
      
      toast({
        title: "Location found",
        description: `${accuracyText} accuracy (±${Math.round(position.coords.accuracy)}m) via ${sourceText}`,
      });
    };

    const handleIPFallback = async () => {
      if (abortControllerRef.current?.signal.aborted) return;
      if (!options.fallbackToIP) return;

      try {
        const ipLocation = await getIPLocation();
        if (ipLocation && !abortControllerRef.current?.signal.aborted) {
          const mockCoords = {
            latitude: ipLocation.lat,
            longitude: ipLocation.lng,
            accuracy: ipLocation.accuracy,
            altitude: null,
            altitudeAccuracy: null,
            heading: null,
            speed: null,
          } as GeolocationCoordinates;

          setState({
            loading: false,
            error: null,
            coords: mockCoords,
            accuracy: 'low',
            source: 'ip',
          });

          toast({
            title: "Approximate location found",
            description: `Using IP-based location (~${Math.round(ipLocation.accuracy / 1000)}km accuracy)`,
          });
          return;
        }
      } catch (ipError) {
        console.warn('IP geolocation failed:', ipError);
      }
    };

    // Use Firefox Android optimized approach if detected
    if (isFirefoxAndroid()) {
      try {
        const result = await getLocationWithGuidance();
        
        if (result.success && result.position && !abortControllerRef.current?.signal.aborted) {
          const sourceMap = {
            'high-accuracy': 'gps' as const,
            'network': 'network' as const,
            'cached': 'network' as const,
          };
          
          handleSuccess(result.position, sourceMap[result.method as keyof typeof sourceMap] || 'network');
          return;
        } else if (!result.success && !abortControllerRef.current?.signal.aborted) {
          // Try IP fallback for Firefox Android
          await handleIPFallback();
          
          if (!abortControllerRef.current?.signal.aborted) {
            setState({
              loading: false,
              error: result.error || "Unable to get your location",
              coords: null,
              accuracy: null,
              source: null,
            });

            toast({
              title: result.error || "Location request failed",
              description: result.guidance?.[0] || "Please check your location settings and try again",
              variant: "destructive",
            });
          }
        }
      } catch (error) {
        console.error('Firefox Android geolocation error:', error);
        await handleIPFallback();
      }
    } else {
      // Progressive fallback strategy for other browsers
      try {
        // Try high accuracy first (best for precise location needs)
        try {
          const position = await tryHighAccuracy();
          handleSuccess(position, 'gps');
          return;
        } catch (highAccuracyError) {
          console.log('High accuracy failed, trying network location:', highAccuracyError);
          
          // If high accuracy fails, try network-based location
          try {
            const position = await tryNetworkLocation();
            handleSuccess(position, 'network');
            return;
          } catch (networkError) {
            console.log('Network location failed, trying cached location:', networkError);
            
            // If network fails, try cached location
            try {
              const position = await tryCachedLocation();
              handleSuccess(position, 'cached');
              return;
            } catch (cachedError) {
              console.log('Cached location failed, trying IP fallback:', cachedError);
              
              // Final fallback to IP geolocation
              await handleIPFallback();
            }
          }
        }

        // If all methods fail, show appropriate error
        if (!abortControllerRef.current?.signal.aborted) {
          let errorMessage = "Unable to get your location";
          let description = "Please check your location settings and try again";

          if (!window.isSecureContext) {
            description = "Location requires a secure connection (HTTPS)";
          }

          setState({
            loading: false,
            error: errorMessage,
            coords: null,
            accuracy: null,
            source: null,
          });

          toast({
            title: errorMessage,
            description: description,
            variant: "destructive",
          });
        }
      } catch (error) {
        if (!abortControllerRef.current?.signal.aborted) {
          console.error('Geolocation error:', error);
          setState({
            loading: false,
            error: "Location request failed",
            coords: null,
            accuracy: null,
            source: null,
          });

          toast({
            title: "Location request failed",
            description: "Please try again or enter coordinates manually",
            variant: "destructive",
          });
        }
      }
    }
  }, [toast, options.fallbackToIP]);

  const cancelLocation = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setState(prev => ({ ...prev, loading: false }));
  }, []);

  return {
    ...state,
    getLocation,
    cancelLocation,
  };
}