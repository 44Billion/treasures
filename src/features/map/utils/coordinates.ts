/**
 * Parse coordinate string to number, handling various formats
 * @param coordStr Coordinate string (e.g., "40", "40.7", "-74.0060")
 * @returns Parsed number or NaN if invalid
 */
export function parseCoordinate(coordStr: string): number {
  if (!coordStr || typeof coordStr !== 'string') {
    return NaN;
  }

  // Trim whitespace
  const trimmed = coordStr.trim();

  // Handle empty string
  if (trimmed === '') {
    return NaN;
  }

  // Handle various number formats
  // This includes integers, decimals, and scientific notation
  const parsed = parseFloat(trimmed);

  // Additional validation - ensure it's a finite number
  if (!isFinite(parsed)) {
    return NaN;
  }

  return parsed;
}

/**
 * Autocorrect coordinates to handle common input errors
 * @param lat Latitude value
 * @param lng Longitude value
 * @returns Corrected coordinates
 */
export function autocorrectCoordinates(lat: number, lng: number): { lat: number; lng: number; corrected: boolean } {
  let corrected = false;
  let newLat = lat;
  let newLng = lng;

  // Auto-detect if coordinates are swapped
  // If latitude is outside valid range but longitude is within latitude range
  if (Math.abs(newLat) > 90 && Math.abs(newLng) <= 90) {
    [newLat, newLng] = [newLng, newLat];
    corrected = true;
  }

  // Clamp latitude to valid range
  if (newLat > 90) {
    newLat = 90;
    corrected = true;
  }
  if (newLat < -90) {
    newLat = -90;
    corrected = true;
  }

  // Wrap longitude to valid range
  if (newLng > 180 || newLng < -180) {
    while (newLng > 180) newLng -= 360;
    while (newLng < -180) newLng += 360;
    corrected = true;
  }

  // Common correction: North America positive longitude
  // Only flip if longitude is in the range that would make sense for North America (60-130)
  // This avoids incorrectly flipping Asian coordinates (100-180)
  if (newLat > 20 && newLat < 50 && newLng > 60 && newLng < 100) {
    newLng = -newLng;
    corrected = true;
  }

  // Common correction: Asian coordinates with negative longitude
  // If latitude suggests Asia and longitude is negative but would make sense as positive
  // Asia is roughly lat 0-50, lng 60-180 (Eastern hemisphere)
  if (newLat > 0 && newLat < 50 && newLng < 0 && newLng > -180) {
    const potentialAsianLng = -newLng; // Flip to positive
    // Check if this would place it in Asia (60-180)
    if (potentialAsianLng > 60 && potentialAsianLng < 180) {
      newLng = potentialAsianLng;
      corrected = true;
    }
  }

  return { lat: newLat, lng: newLng, corrected };
}

/**
 * Format coordinates for display
 * @param lat Latitude
 * @param lng Longitude
 * @param precision Number of decimal places
 * @returns Formatted string
 */
export function formatCoordinates(lat: number, lng: number, precision: number = 6): string {
  return `${lat.toFixed(precision)}, ${lng.toFixed(precision)}`;
}

/**
 * Determine the precision (number of decimal places) of a coordinate value
 * @param value The coordinate value
 * @returns Number of decimal places
 */
export function getCoordinatePrecision(value: number): number {
  const str = value.toString();
  const decimalIndex = str.indexOf('.');

  if (decimalIndex === -1) {
    return 0; // No decimal places
  }

  // Count digits after decimal point, excluding trailing zeros
  const afterDecimal = str.substring(decimalIndex + 1);
  const withoutTrailingZeros = afterDecimal.replace(/0+$/, '');

  return withoutTrailingZeros.length;
}

/**
 * Determine appropriate geohash precision levels based on coordinate precision
 * @param lat Latitude value
 * @param lng Longitude value
 * @returns Array of geohash precision levels to generate
 */
export function getGeohashPrecisionLevels(lat: number, lng: number): number[] {
  const latPrecision = getCoordinatePrecision(lat);
  const lngPrecision = getCoordinatePrecision(lng);
  const maxPrecision = Math.max(latPrecision, lngPrecision);

  // Mapping of coordinate decimal places to appropriate geohash precision
  // This ensures we don't generate overly precise geohashes for imprecise coordinates
  let maxGeohashPrecision: number;

  if (maxPrecision === 0) {
    // Integer coordinates (very imprecise) - only broad area geohashes
    maxGeohashPrecision = 3;
  } else if (maxPrecision === 1) {
    // 1 decimal place (~11km precision) - city level
    maxGeohashPrecision = 4;
  } else if (maxPrecision === 2) {
    // 2 decimal places (~1.1km precision) - neighborhood level
    maxGeohashPrecision = 5;
  } else if (maxPrecision === 3) {
    // 3 decimal places (~110m precision) - block level
    maxGeohashPrecision = 6;
  } else if (maxPrecision === 4) {
    // 4 decimal places (~11m precision) - building level
    maxGeohashPrecision = 7;
  } else if (maxPrecision === 5) {
    // 5 decimal places (~1.1m precision) - room level
    maxGeohashPrecision = 8;
  } else {
    // 6+ decimal places (~0.11m precision or better) - exact location
    maxGeohashPrecision = 9;
  }

  // Always include precision levels 3-4 for broad proximity search
  // Then add progressively more precise levels up to the determined maximum
  const levels: number[] = [];

  for (let precision = 3; precision <= Math.max(4, maxGeohashPrecision); precision++) {
    levels.push(precision);
  }

  return levels;
}
/**
 * Format a single coordinate value for input fields
 * Limits precision to 5 decimal places for automatic sources (map clicks, GPS, search)
 * but preserves full precision for manual entry
 * @param value The coordinate value
 * @param isFromAutomaticSource Whether this came from map click, GPS, or search
 * @returns Formatted coordinate string
 */
export function formatCoordinateForInput(value: number, isFromAutomaticSource: boolean = true): string {
  if (isFromAutomaticSource) {
    // Limit to 5 decimal places for automatic sources (~1.1m precision)
    // This matches our geohash precision requirements
    return value.toFixed(5);
  } else {
    // For manual entry, preserve the original precision
    return value.toString();
  }
}
