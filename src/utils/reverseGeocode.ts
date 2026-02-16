/**
 * Reverse geocoding utility to get location information from coordinates
 */

// Simple in-memory cache for reverse geocoding results
const geocodeCache = new Map<string, string>();
const CACHE_DURATION = 1000 * 60 * 60 * 24; // 24 hours
const cacheTimestamps = new Map<string, number>();

interface ReverseGeocodeResult {
  city?: string;
  town?: string;
  village?: string;
  county?: string;
  state?: string;
  country?: string;
}

/**
 * Get a human-readable location name from coordinates using Nominatim
 * Returns format: "City, State" or "Town, Country" or just "Country" as fallback
 */
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  // Create cache key from rounded coordinates (to 2 decimal places for reasonable caching)
  const cacheKey = `${lat.toFixed(2)},${lng.toFixed(2)}`;
  
  // Check cache
  const cached = geocodeCache.get(cacheKey);
  const cacheTime = cacheTimestamps.get(cacheKey);
  
  if (cached && cacheTime && Date.now() - cacheTime < CACHE_DURATION) {
    return cached;
  }

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?` +
      new URLSearchParams({
        lat: lat.toString(),
        lon: lng.toString(),
        format: 'json',
        addressdetails: '1',
        zoom: '10', // City level
      }),
      {
        headers: {
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(5000), // 5 second timeout
      }
    );

    if (!response.ok) {
      throw new Error('Reverse geocoding failed');
    }

    const data = await response.json() as { address?: ReverseGeocodeResult };
    const address = data.address;

    if (!address) {
      return '';
    }

    // Build location string with priority: city/town/village, state/county, country
    const locationParts: string[] = [];
    
    // Add primary location (city, town, or village)
    const primaryLocation = address.city || address.town || address.village;
    if (primaryLocation) {
      locationParts.push(primaryLocation);
    }

    // Add secondary location (state or county)
    const secondaryLocation = address.state || address.county;
    if (secondaryLocation) {
      locationParts.push(secondaryLocation);
    }

    // If we don't have enough detail, add country
    if (locationParts.length === 0 && address.country) {
      locationParts.push(address.country);
    } else if (locationParts.length === 1 && !address.state) {
      // If we only have a city and no state, add country for context
      if (address.country) {
        locationParts.push(address.country);
      }
    }

    const locationString = locationParts.join(', ');
    
    // Cache the result
    geocodeCache.set(cacheKey, locationString);
    cacheTimestamps.set(cacheKey, Date.now());
    
    return locationString;
  } catch (error) {
    console.warn('Reverse geocoding error:', error);
    return '';
  }
}

/**
 * Prefetch location names for multiple coordinates
 * Useful for batch processing geocaches
 */
export async function prefetchLocations(coordinates: Array<{ lat: number; lng: number }>): Promise<void> {
  // Process in small batches to avoid overwhelming the API
  const BATCH_SIZE = 5;
  const DELAY_BETWEEN_BATCHES = 1000; // 1 second

  for (let i = 0; i < coordinates.length; i += BATCH_SIZE) {
    const batch = coordinates.slice(i, i + BATCH_SIZE);
    
    await Promise.all(
      batch.map(coord => reverseGeocode(coord.lat, coord.lng))
    );

    // Wait between batches
    if (i + BATCH_SIZE < coordinates.length) {
      await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
    }
  }
}

/**
 * Clear the geocoding cache
 */
export function clearGeocodeCache(): void {
  geocodeCache.clear();
  cacheTimestamps.clear();
}
