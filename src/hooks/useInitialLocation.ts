import { useState, useEffect } from 'react';
import { getIPLocation } from '../utils/ipGeolocation';

interface InitialLocation {
  lat: number;
  lng: number;
}

const DEFAULT_LOCATION: InitialLocation = {
  lat: 40.7128,
  lng: -74.0060
};

// Store the detected location globally so all components can use it
let cachedInitialLocation: InitialLocation | null = null;
let isDetecting = false;
let detectionPromise: Promise<InitialLocation> | null = null;

/**
 * Hook to get initial location for maps
 * Tries IP geolocation first, falls back to NYC
 * Caches result across all components
 */
export function useInitialLocation() {
  const [location, setLocation] = useState<InitialLocation>(
    cachedInitialLocation || DEFAULT_LOCATION
  );
  const [isLoading, setIsLoading] = useState(!cachedInitialLocation);

  useEffect(() => {
    // If we already have a cached location, use it
    if (cachedInitialLocation) {
      setLocation(cachedInitialLocation);
      setIsLoading(false);
      return;
    }

    // If detection is already in progress, wait for it
    if (isDetecting && detectionPromise) {
      detectionPromise.then(loc => {
        setLocation(loc);
        setIsLoading(false);
      });
      return;
    }

    // Start detection
    isDetecting = true;
    detectionPromise = detectInitialLocation();

    detectionPromise.then(loc => {
      cachedInitialLocation = loc;
      setLocation(loc);
      setIsLoading(false);
      isDetecting = false;
    });
  }, []);

  return { location, isLoading };
}

/**
 * Detect initial location using IP geolocation
 * Falls back to NYC if detection fails
 */
async function detectInitialLocation(): Promise<InitialLocation> {
  try {
    const ipLocation = await getIPLocation();
    
    if (ipLocation) {
      console.log('Initial location detected via IP:', ipLocation);
      return {
        lat: ipLocation.lat,
        lng: ipLocation.lng
      };
    }
  } catch (error) {
    console.warn('Failed to detect initial location:', error);
  }

  // Fallback to NYC
  console.log('Using default location (NYC)');
  return DEFAULT_LOCATION;
}

/**
 * Clear the cached location (useful for testing)
 */
export function clearCachedLocation() {
  cachedInitialLocation = null;
  isDetecting = false;
  detectionPromise = null;
}
