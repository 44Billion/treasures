/**
 * Calculate the distance between two geographic points using the Haversine formula
 * @param lat1 Latitude of the first point
 * @param lon1 Longitude of the first point
 * @param lat2 Latitude of the second point
 * @param lon2 Longitude of the second point
 * @returns Distance in kilometers
 */
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radius of the Earth in kilometers
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return distance;
}

/**
 * Convert degrees to radians
 */
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Format distance for display
 * @param km Distance in kilometers
 * @returns Formatted string with appropriate unit
 */
export function formatDistance(km: number): string {
  if (km < 1) {
    return `${Math.round(km * 1000)}m`;
  } else if (km < 10) {
    return `${km.toFixed(1)}km`;
  } else {
    return `${Math.round(km)}km`;
  }
}

/**
 * Sort geocaches by distance from a reference point
 */
export function sortByDistance<T extends { location: { lat: number; lng: number } }>(
  items: T[],
  refLat: number,
  refLng: number
): (T & { distance: number })[] {
  return items
    .map(item => ({
      ...item,
      distance: calculateDistance(refLat, refLng, item.location.lat, item.location.lng)
    }))
    .sort((a, b) => a.distance - b.distance);
}

/**
 * Filter items within a certain radius
 */
export function filterByRadius<T extends { location: { lat: number; lng: number } }>(
  items: T[],
  centerLat: number,
  centerLng: number,
  radiusKm: number
): T[] {
  return items.filter(item => {
    const distance = calculateDistance(centerLat, centerLng, item.location.lat, item.location.lng);
    return distance <= radiusKm;
  });
}

/**
 * Find the closest geocache to a reference point
 */
export function findClosestGeocache<T extends { location: { lat: number; lng: number } }>(
  items: T[],
  refLat: number,
  refLng: number
): T | null {
  if (items.length === 0) return null;
  
  const sorted = sortByDistance(items, refLat, refLng);
  return sorted[0];
}