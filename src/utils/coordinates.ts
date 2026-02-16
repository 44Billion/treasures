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
 * Validate coordinates without any autocorrection
 * @param lat Latitude value
 * @param lng Longitude value
 * @returns Validated coordinates (unchanged if valid)
 */
export function autocorrectCoordinates(lat: number, lng: number): { lat: number; lng: number; corrected: boolean } {
  // Simply validate that coordinates are in valid ranges
  // Do NOT modify them - let the user see exactly what they get
  const isValid =
    !isNaN(lat) &&
    !isNaN(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180;

  if (!isValid) {
    console.warn('Invalid coordinates detected:', { lat, lng });
  }

  // Return coordinates unchanged
  return { lat, lng, corrected: false };
}

/**
 * Determine the precision (number of decimal places) of a coordinate value
 * @param value The coordinate value
 * @returns Number of decimal places
 */
function getCoordinatePrecision(value: number): number {
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
