/**
 * Coordinate and location utilities
 */

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface CoordinatePair extends Array<number> {
  0: number; // lat
  1: number; // lng
}

/**
 * Convert coordinates object to array format
 */
export function coordinatesToArray(coords: Coordinates): CoordinatePair {
  return [coords.lat, coords.lng];
}

/**
 * Convert coordinates array to object format
 */
export function arrayToCoordinates(coords: CoordinatePair): Coordinates {
  return { lat: coords[0], lng: coords[1] };
}

/**
 * Parse coordinate string (e.g., "40.7128,-74.0060")
 */
export function parseCoordinateString(coordString: string): Coordinates | null {
  try {
    const parts = coordString.split(',').map(s => parseFloat(s.trim()));
    if (parts.length === 2 && parts.every(n => !isNaN(n))) {
      const lat = parts[0];
      const lng = parts[1];
      if (lat !== undefined && lng !== undefined) {
        return { lat, lng };
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Format coordinates as string
 */
export function formatCoordinates(coords: Coordinates, precision: number = 6): string {
  return `${coords.lat.toFixed(precision)},${coords.lng.toFixed(precision)}`;
}

/**
 * Validate coordinates
 */
export function isValidCoordinates(coords: Coordinates): boolean {
  return (
    typeof coords.lat === 'number' &&
    typeof coords.lng === 'number' &&
    coords.lat >= -90 &&
    coords.lat <= 90 &&
    coords.lng >= -180 &&
    coords.lng <= 180 &&
    !isNaN(coords.lat) &&
    !isNaN(coords.lng)
  );
}

/**
 * Calculate distance between two coordinates (Haversine formula)
 */
export function calculateDistance(
  coord1: Coordinates,
  coord2: Coordinates
): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRadians(coord2.lat - coord1.lat);
  const dLng = toRadians(coord2.lng - coord1.lng);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(coord1.lat)) * Math.cos(toRadians(coord2.lat)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
    
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculate bounds for a given center and radius
 */
export function calculateBounds(
  center: Coordinates,
  radiusKm: number
): {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
} {
  const latDelta = radiusKm / 111; // Rough conversion: 1 degree ≈ 111 km
  const lngDelta = radiusKm / (111 * Math.cos(center.lat * Math.PI / 180));
  
  return {
    minLat: center.lat - latDelta,
    maxLat: center.lat + latDelta,
    minLng: center.lng - lngDelta,
    maxLng: center.lng + lngDelta,
  };
}

/**
 * Check if coordinates are within bounds
 */
export function isWithinBounds(
  coords: Coordinates,
  bounds: ReturnType<typeof calculateBounds>
): boolean {
  return (
    coords.lat >= bounds.minLat &&
    coords.lat <= bounds.maxLat &&
    coords.lng >= bounds.minLng &&
    coords.lng <= bounds.maxLng
  );
}

/**
 * Format coordinates for display
 */
export function formatCoordinatesForDisplay(coords: Coordinates): string {
  const latDir = coords.lat >= 0 ? 'N' : 'S';
  const lngDir = coords.lng >= 0 ? 'E' : 'W';
  
  return `${Math.abs(coords.lat).toFixed(6)}°${latDir}, ${Math.abs(coords.lng).toFixed(6)}°${lngDir}`;
}

/**
 * Convert degrees to radians
 */
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}