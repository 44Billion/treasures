import { useState, useCallback } from 'react';
import { useToast } from '@/hooks/useToast';
import { getIPLocation } from '@/lib/ipGeolocation';

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

export function useGeolocation(options: UseGeolocationOptions = {}) {
  const [state, setState] = useState<GeolocationState>({
    loading: false,
    error: null,
    coords: null,
  });
  const { toast } = useToast();

  const getLocation = useCallback(() => {
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

    const geoOptions: PositionOptions = {
      enableHighAccuracy: options.enableHighAccuracy ?? true,
      timeout: options.timeout ?? 30000, // Increased to 30 seconds
      maximumAge: options.maximumAge ?? 300000, // Allow 5-minute old positions
    };

    const handleSuccess = (position: GeolocationPosition) => {
      setState({
        loading: false,
        error: null,
        coords: position.coords,
      });
      
      // Only show success toast for precise locations
      if (position.coords.accuracy < 1000) {
        toast({
          title: "Location found",
          description: `±${Math.round(position.coords.accuracy)}m accuracy`,
        });
      }
    };

    const handleError = (error: GeolocationPositionError) => {
      let errorMessage = "Unable to get your location";
      let description = "Please try again";

      switch (error.code) {
        case error.PERMISSION_DENIED:
          errorMessage = "Location permission denied";
          description = "Please enable location access in your browser settings and reload the page";
          break;
        case error.POSITION_UNAVAILABLE:
          errorMessage = "Location unavailable";
          description = "GPS/WiFi location failed. Using approximate location instead.";
          break;
        case error.TIMEOUT:
          errorMessage = "Location request timed out";
          description = "Getting your location took too long. Please try again";
          break;
      }

      setState({
        loading: false,
        error: errorMessage,
        coords: null,
      });

      // Only show error toast if we're not going to fall back to IP
      if (error.code !== error.POSITION_UNAVAILABLE) {
        toast({
          title: errorMessage,
          description: description,
          variant: "destructive",
        });
      }

      // Log detailed error for debugging
      console.error('Geolocation error:', {
        code: error.code,
        message: error.message,
        PERMISSION_DENIED: error.PERMISSION_DENIED,
        POSITION_UNAVAILABLE: error.POSITION_UNAVAILABLE,
        TIMEOUT: error.TIMEOUT,
      });
    };

    // Start with a simple getCurrentPosition call
    navigator.geolocation.getCurrentPosition(
      handleSuccess,
      async (error) => {
        console.log('Primary geolocation failed:', error.message);
        
        // If primary fails, try with less strict options
        if (error.code === error.TIMEOUT || error.code === error.POSITION_UNAVAILABLE) {
          navigator.geolocation.getCurrentPosition(
            handleSuccess,
            async (secondError) => {
              console.log('Secondary geolocation failed:', secondError.message);
              
              // Fall back to IP geolocation
              try {
                const ipLocation = await getIPLocation();
                if (ipLocation) {
                  const mockPosition: GeolocationPosition = {
                    coords: {
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
                    },
                    timestamp: Date.now(),
                    toJSON: function() {
                      return {
                        coords: this.coords.toJSON(),
                        timestamp: this.timestamp
                      };
                    }
                  };
                  
                  setState({
                    loading: false,
                    error: null,
                    coords: mockPosition.coords,
                  });
                  
                  toast({
                    title: "Location found",
                    description: `Using approximate location (~${Math.round(ipLocation.accuracy / 1000)}km accuracy)`,
                  });
                } else {
                  handleError(secondError);
                }
              } catch {
                handleError(secondError);
              }
            },
            {
              enableHighAccuracy: false,
              timeout: 5000,
              maximumAge: 300000 // 5 minutes
            }
          );
        } else {
          handleError(error);
        }
      },
      geoOptions
    );
  }, [options.enableHighAccuracy, options.timeout, options.maximumAge, toast]);

  return {
    ...state,
    getLocation,
  };
}