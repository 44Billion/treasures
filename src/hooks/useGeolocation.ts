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

// GPS-first geolocation strategies.
//
// We try the device GPS chip FIRST because it works fully offline (no internet,
// no cell/wifi connection required) and gives the most accurate fix. Network
// positioning (cell tower + wifi triangulation) and IP lookup require internet
// and are only used as fallbacks when GPS is unavailable (e.g. indoors).
//
// Note: a high-accuracy GPS cold start can take longer than network positioning,
// so the GPS timeout is generous before we fall back.
const GEOLOCATION_STRATEGIES = [
  // Strategy 1: High-accuracy GPS first (works offline, most accurate)
  {
    enableHighAccuracy: true,  // Use the device GPS chip directly
    timeout: 12000,            // Allow time for a GPS fix (cold start)
    maximumAge: 30000,         // 30 seconds - prefer a fresh GPS reading
    name: 'gps-accurate'
  },
  // Strategy 2: Fast network positioning (needs internet, quick fallback)
  {
    enableHighAccuracy: false,
    timeout: 5000,             // Quick timeout for fast feedback
    maximumAge: 60000,         // 1 minute - fresh enough for most use cases
    name: 'network-fast'
  },
  // Strategy 3: Network with longer cache (needs internet, last resort)
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

    // Try each strategy in sequence
    for (let i = 0; i < GEOLOCATION_STRATEGIES.length; i++) {
      const strategy = GEOLOCATION_STRATEGIES[i];
      if (!strategy) return;
      
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
        setState({
          loading: false,
          error: null,
          coords: position.coords,
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
            title: t('map.nearMe.unavailable.title', 'Location unavailable'),
            description: t(
              'map.nearMe.unavailable.description',
              "We couldn't determine your location. Check your GPS or try again in a moment."
            ),
            variant: "destructive",
          });
        }
      }
    }
  }, [options.enableHighAccuracy, options.timeout, options.maximumAge, toast, t]);

  return {
    ...state,
    getLocation,
  };
}