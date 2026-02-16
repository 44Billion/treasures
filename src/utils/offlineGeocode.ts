/**
 * 100% Offline reverse geocoding utility using local data
 * Converts coordinates to "City, ST 🏳️" or "City 🏳️" format
 * No external API calls - everything is local
 * 
 * Note: Cities data is lazy-loaded to keep the main bundle small
 */

import { countryToFlag } from './countryToFlag';
import { getStateCodeMapping } from '@/utils/stateCodeMappings';
import type { CityData } from './citiesData';

// Simple in-memory cache for reverse geocoding results
const geocodeCache = new Map<string, string>();
const CACHE_DURATION = 1000 * 60 * 60 * 24; // 24 hours
const cacheTimestamps = new Map<string, number>();

// Countries that use state/province abbreviations (2-digit codes)
const COUNTRIES_WITH_STATES = new Set(['US', 'CA', 'AU', 'BR', 'IN', 'MX']);

// Lazy-loaded cities data
let citiesDataPromise: Promise<CityData[]> | null = null;
let citiesDataCache: CityData[] | null = null;

/**
 * Load cities data on-demand (lazy loading)
 */
async function getCitiesData(): Promise<CityData[]> {
  // Return cached data if available
  if (citiesDataCache) {
    return citiesDataCache;
  }

  // Return existing promise if already loading
  if (citiesDataPromise) {
    return citiesDataPromise;
  }

  // Start loading cities data
  citiesDataPromise = import('./citiesData').then(module => {
    citiesDataCache = module.getCitiesData();
    return citiesDataCache;
  });

  return citiesDataPromise;
}

/**
 * Calculate distance between two points using Haversine formula
 */
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Quick distance approximation (faster than Haversine for initial filtering)
 * Returns approximate distance in km
 */
function quickDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const latDiff = Math.abs(lat2 - lat1);
  const lonDiff = Math.abs(lon2 - lon1);
  
  // Very rough approximation: 1 degree ≈ 111 km at equator
  // Adjust longitude by latitude (cos correction)
  const latMid = (lat1 + lat2) / 2;
  const lonCorrection = Math.cos(latMid * Math.PI / 180);
  
  return Math.sqrt(
    Math.pow(latDiff * 111, 2) + 
    Math.pow(lonDiff * 111 * lonCorrection, 2)
  );
}

/**
 * Get a human-readable location name from coordinates using 100% offline data
 * Returns format: "City, ST 🏳️" for countries with states or "City 🏳️" for others
 * 
 * Note: This function is async because it lazy-loads the cities data
 */
export async function offlineGeocode(lat: number, lng: number): Promise<string> {
  // Create cache key from rounded coordinates (to 2 decimal places for reasonable caching)
  const cacheKey = `${lat.toFixed(2)},${lng.toFixed(2)}`;
  
  // Check cache
  const cached = geocodeCache.get(cacheKey);
  const cacheTime = cacheTimestamps.get(cacheKey);
  
  if (cached && cacheTime && Date.now() - cacheTime < CACHE_DURATION) {
    return cached;
  }

  try {
    // Load cities data (lazy-loaded, cached after first load)
    const cities = await getCitiesData();

    // Two-pass approach:
    // 1. Quick filter to find cities within reasonable radius (fast)
    // 2. Accurate distance calculation on filtered results (slow but on fewer items)
    
    const MAX_QUICK_DISTANCE = 200; // km - initial filter radius
    const MAX_FINAL_DISTANCE = 50;  // km - final acceptance radius
    
    const candidates: Array<{ city: CityData; distance: number }> = [];
    
    // First pass: quick filtering
    for (const city of cities) {
      if (city.lat && city.lng) {
        const cityLat = parseFloat(city.lat);
        const cityLng = parseFloat(city.lng);
        
        const quickDist = quickDistance(lat, lng, cityLat, cityLng);
        
        if (quickDist < MAX_QUICK_DISTANCE) {
          // Calculate accurate distance for candidates
          const accurateDist = calculateDistance(lat, lng, cityLat, cityLng);
          
          if (accurateDist < MAX_FINAL_DISTANCE) {
            candidates.push({ city, distance: accurateDist });
          }
        }
      }
    }

    if (candidates.length === 0) {
      // No city found within acceptable radius
      return '';
    }

    // Sort by distance and get the closest
    candidates.sort((a, b) => a.distance - b.distance);
    const nearestCity = candidates[0].city;

    const countryCode = nearestCity.country;
    const flagEmoji = countryToFlag(countryCode);
    const hasStates = COUNTRIES_WITH_STATES.has(countryCode);
    
    let locationString = '';
    
    if (hasStates && nearestCity.admin1) {
      // Get the state code mapping for this country
      const stateMapping = getStateCodeMapping(countryCode);
      const stateCode = stateMapping?.[nearestCity.admin1] || nearestCity.admin1;
      
      // Format: "City, ST 🏳️"
      locationString = `${nearestCity.name}, ${stateCode} ${flagEmoji}`;
    } else {
      // Format: "City 🏳️"
      locationString = `${nearestCity.name} ${flagEmoji}`;
    }
    
    // Cache the result
    geocodeCache.set(cacheKey, locationString);
    cacheTimestamps.set(cacheKey, Date.now());
    
    return locationString;
  } catch (error) {
    console.warn('Offline geocoding error:', error);
    return '';
  }
}

/**
 * Prefetch location names for multiple coordinates
 * Useful for batch processing geocaches
 */
export async function prefetchLocations(coordinates: Array<{ lat: number; lng: number }>): Promise<void> {
  // Process all coordinates in parallel
  await Promise.all(
    coordinates.map(coord => offlineGeocode(coord.lat, coord.lng))
  );
}

/**
 * Clear the geocoding cache
 */
export function clearGeocodeCache(): void {
  geocodeCache.clear();
  cacheTimestamps.clear();
}
