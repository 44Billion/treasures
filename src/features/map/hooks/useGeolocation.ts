import { useState, useCallback } from 'react';
import { useToast } from '@/shared/hooks/useToast';
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

// Android-optimized geolocation strategies
// 
// ROOT CAUSE ANALYSIS of Android geolocation failures:
// 1. 30-second timeout was too long - Android often fails fast (3-8 seconds) or hangs indefinitely
// 2. enableHighAccuracy: true on first attempt causes Android to wait for GPS lock, which often times out
// 3. maximumAge: 300000 (5 minutes) was too long - Android cached stale/invalid positions
// 4. No fallback to network-only positioning when GPS fails
// 5. Nested callback structure made error handling unreliable
// 6. No distinction between "GPS unavailable" vs "permission denied" vs "timeout"
//
// Android-specific behavior:
// - GPS cold start can take 30+ seconds outdoors, often fails indoors
// - Network positioning (cell towers + WiFi) is much faster and more reliable
// - Android browsers aggressively timeout GPS requests to preserve battery
// - Different Android versions handle geolocation permissions differently
//
const GEOLOCATION_STRATEGIES = [
  // Strategy 1: Network-first approach (most reliable on Android)
  {
    enableHighAccuracy: false, // Use network positioning first
    timeout: 5000,             // Quick timeout for fast feedback
    maximumAge: 60000,         // 1 minute - fresh enough for most use cases
    name: 'network-fast'
  },
  // Strategy 2: GPS with reasonable timeout (for outdoor/accurate positioning)
  {
    enableHighAccuracy: true,  // Try GPS but with realistic timeout
    timeout: 12000,            // Longer but not excessive
    maximumAge: 30000,         // 30 seconds - fresher for GPS
    name: 'gps-moderate'
  },
  // Strategy 3: Network fallback with longer cache (last resort)
  {
    enableHighAccuracy: false,
    timeout: 8000,
    maximumAge: 300000,        // 5 minutes - accept older cached position
    name: 'network-cached'
  }
];

export function useGeolocation(options: UseGeolocationOptions = {}) {
  const [state, setState] = useState<GeolocationState>({
    loading: false,
    error: null,
    coords: null,
  });
  const { toast } = useToast();

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

    // Try each strategy in sequence
    for (let i = 0; i < GEOLOCATION_STRATEGIES.length; i++) {
      const strategy = GEOLOCATION_STRATEGIES[i];
      
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

        // Success! Update state and show feedback
        setState({
          loading: false,
          error: null,
          coords: position.coords,
        });

        // Show success toast with accuracy info
        const accuracy = Math.round(position.coords.accuracy);
        toast({
          title: "Location found",
          description: `±${accuracy}m accuracy (${strategy.name})`,
        });

        return; // Exit early on success

      } catch (error: unknown) {
        const err = error as GeolocationPositionError | Error;
        
        // Handle permission denied immediately (don't try other strategies)
        if ('code' in err && err.code === GeolocationPositionError.PERMISSION_DENIED) {
          setState({
            loading: false,
            error: "Location access denied",
            coords: null,
          });
          toast({
            title: "Location access denied",
            description: "Please enable location access in your browser settings",
            variant: "destructive",
          });
          return;
        }

        // For other errors, continue to next strategy
        console.warn(`Geolocation strategy ${strategy.name} failed:`, err.message || err);
        
        // If this was the last strategy, try IP fallback
        if (i === GEOLOCATION_STRATEGIES.length - 1) {
          try {
            const ipLocation = await getIPLocation();
            if (ipLocation) {
              // Create mock GeolocationCoordinates object
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
              
              setState({
                loading: false,
                error: null,
                coords: mockCoords,
              });
              
              toast({
                title: "Location found",
                description: `Using approximate location (~${Math.round(ipLocation.accuracy / 1000)}km accuracy)`,
              });
              return;
            }
          } catch (ipError) {
            console.warn('IP geolocation also failed:', ipError);
          }

          // All strategies failed
          setState({
            loading: false,
            error: "Unable to determine location",
            coords: null,
          });
          
          toast({
            title: "Location unavailable",
            description: "Please check your location settings and try again",
            variant: "destructive",
          });
        }
      }
    }
  }, [options.enableHighAccuracy, options.timeout, options.maximumAge, toast]);

  return {
    ...state,
    getLocation,
  };
}