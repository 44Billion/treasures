import { useState, useCallback, useRef } from 'react';
import { useToast } from '@/hooks/useToast';
import { getIPLocation } from '@/lib/ipGeolocation';

interface GeolocationState {
  loading: boolean;
  error: string | null;
  coords: GeolocationCoordinates | null;
  accuracy: 'high' | 'medium' | 'low' | null;
  source: 'precise' | 'network' | 'approximate' | null;
  attempts: number;
}

interface UseAdaptiveGeolocationOptions {
  enableFallback?: boolean;
  prioritizePrecision?: boolean;
}

/**
 * Adaptive geolocation hook that quickly determines the best location acquisition strategy
 * without browser-specific hacks. Uses capability testing and progressive timeouts.
 */
export function useAdaptiveGeolocation(options: UseAdaptiveGeolocationOptions = {}) {
  const [state, setState] = useState<GeolocationState>({
    loading: false,
    error: null,
    coords: null,
    accuracy: null,
    source: null,
    attempts: 0,
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
      setState({ 
        loading: false, 
        error: "Location services not available", 
        coords: null, 
        accuracy: null, 
        source: null,
        attempts: 0
      });
      toast({
        title: "Location not available",
        description: "Your device doesn't support location services",
        variant: "destructive",
      });
      return;
    }

    setState(prev => ({ ...prev, loading: true, error: null, attempts: 0 }));

    // Strategy: Prioritize precision, fall back gracefully
    const strategies = [];
    
    if (options.prioritizePrecision !== false) {
      // Strategy 1: High accuracy GPS (best precision)
      strategies.push({
        name: 'precise',
        timeout: 10000,
        priority: 1,
        options: {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000, // 1 minute for high accuracy
        }
      });
    }
    
    // Strategy 2: Network location (fallback)
    strategies.push({
      name: 'network',
      timeout: 6000,
      priority: options.prioritizePrecision !== false ? 2 : 1,
      options: {
        enableHighAccuracy: false,
        timeout: 6000,
        maximumAge: 300000, // 5 minutes
      }
    });
    
    // Strategy 3: Cached location (last resort for GPS)
    strategies.push({
      name: 'cached',
      timeout: 4000,
      priority: 3,
      options: {
        enableHighAccuracy: false,
        timeout: 4000,
        maximumAge: 600000, // 10 minutes
      }
    });

    const attemptLocation = (strategy: typeof strategies[0]): Promise<{
      position: GeolocationPosition;
      strategy: string;
      priority: number;
    }> => {
      return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error(`${strategy.name} timeout`));
        }, strategy.timeout);

        navigator.geolocation.getCurrentPosition(
          (position) => {
            clearTimeout(timeoutId);
            resolve({ position, strategy: strategy.name, priority: strategy.priority });
          },
          (error) => {
            clearTimeout(timeoutId);
            reject(error);
          },
          strategy.options
        );
      });
    };

    const handleSuccess = (position: GeolocationPosition, strategyName: string) => {
      if (abortControllerRef.current?.signal.aborted) return;

      let accuracy: 'high' | 'medium' | 'low';
      let source: 'precise' | 'network' | 'approximate';

      // Strict accuracy classification - prioritize precise location
      if (position.coords.accuracy <= 10) {
        accuracy = 'high';
        source = 'precise';
      } else if (position.coords.accuracy <= 50) {
        accuracy = 'medium';
        source = strategyName === 'precise' ? 'precise' : 'network';
      } else if (position.coords.accuracy <= 200) {
        accuracy = 'low';
        source = 'network';
      } else {
        accuracy = 'low';
        source = 'approximate';
      }

      setState(prev => ({
        loading: false,
        error: null,
        coords: position.coords,
        accuracy,
        source,
        attempts: prev.attempts + 1,
      }));

      const accuracyText = accuracy === 'high' ? 'High precision' : 
                          accuracy === 'medium' ? 'Good accuracy' : 'Approximate';
      
      toast({
        title: "Location found",
        description: `${accuracyText} (±${Math.round(position.coords.accuracy)}m)`,
      });
    };

    const handleIPFallback = async () => {
      if (abortControllerRef.current?.signal.aborted || !options.enableFallback) return false;

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

          setState(prev => ({
            loading: false,
            error: null,
            coords: mockCoords,
            accuracy: 'low',
            source: 'approximate',
            attempts: prev.attempts + 1,
          }));

          toast({
            title: "Approximate location only",
            description: `City-level accuracy (~${Math.round(ipLocation.accuracy / 1000)}km) - GPS unavailable`,
            variant: "default",
          });
          return true;
        }
      } catch (error) {
        console.warn('IP geolocation failed:', error);
      }
      return false;
    };

    try {
      // Try strategies in priority order, but with some parallelism for speed
      let bestResult: { position: GeolocationPosition; strategy: string; priority: number } | null = null;
      
      if (options.prioritizePrecision !== false) {
        // Precision mode: Try high accuracy first, give it time to succeed
        try {
          const preciseResult = await attemptLocation(strategies[0]); // High accuracy
          if (!abortControllerRef.current?.signal.aborted) {
            handleSuccess(preciseResult.position, preciseResult.strategy);
            return;
          }
        } catch (preciseError) {
          console.log('High accuracy failed, trying fallback methods:', preciseError);
          
          // High accuracy failed, try other methods in parallel
          const fallbackStrategies = strategies.slice(1);
          const results = await Promise.allSettled(
            fallbackStrategies.map(strategy => attemptLocation(strategy))
          );

          // Find the best successful result (lowest priority number = higher priority)
          const successfulResults = results
            .filter((result): result is PromiseFulfilledResult<{ position: GeolocationPosition; strategy: string; priority: number }> => 
              result.status === 'fulfilled'
            )
            .map(result => result.value)
            .sort((a, b) => a.priority - b.priority);

          if (successfulResults.length > 0 && !abortControllerRef.current?.signal.aborted) {
            bestResult = successfulResults[0];
          }
        }
      } else {
        // Speed mode: Try all strategies in parallel
        const results = await Promise.allSettled(
          strategies.map(strategy => attemptLocation(strategy))
        );

        // Find the best successful result (prioritize by priority, then by speed)
        const successfulResults = results
          .filter((result): result is PromiseFulfilledResult<{ position: GeolocationPosition; strategy: string; priority: number }> => 
            result.status === 'fulfilled'
          )
          .map(result => result.value)
          .sort((a, b) => a.priority - b.priority);

        if (successfulResults.length > 0 && !abortControllerRef.current?.signal.aborted) {
          bestResult = successfulResults[0];
        }
      }

      if (bestResult && !abortControllerRef.current?.signal.aborted) {
        handleSuccess(bestResult.position, bestResult.strategy);
        return;
      }

      // If all GPS strategies failed, try IP fallback only if enabled
      if (options.enableFallback) {
        const fallbackSucceeded = await handleIPFallback();
        if (fallbackSucceeded) return;
      }
      
      if (!abortControllerRef.current?.signal.aborted) {
        // All methods failed
        const errorMessage = "Unable to get precise location";
        let description = "Please enable location services and try again";

        // Check for common issues without browser detection
        if (!window.isSecureContext) {
          description = "Location requires a secure connection (HTTPS)";
        } else if (options.prioritizePrecision !== false) {
          description = "High accuracy location unavailable. Try enabling GPS or moving to an area with better signal.";
        }

        setState(prev => ({
          loading: false,
          error: errorMessage,
          coords: null,
          accuracy: null,
          source: null,
          attempts: prev.attempts + strategies.length,
        }));

        toast({
          title: errorMessage,
          description: description,
          variant: "destructive",
        });
      }
    } catch (error) {
      if (!abortControllerRef.current?.signal.aborted) {
        console.error('Adaptive geolocation error:', error);
        setState(prev => ({
          loading: false,
          error: "Location request failed",
          coords: null,
          accuracy: null,
          source: null,
          attempts: prev.attempts + 1,
        }));

        toast({
          title: "Location request failed",
          description: "Please try again or enter coordinates manually",
          variant: "destructive",
        });
      }
    }
  }, [toast, options.enableFallback, options.prioritizePrecision]);

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