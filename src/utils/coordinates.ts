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

/**
 * Result of parsing a coordinate string
 */
export interface CoordinateParseResult {
  lat: number;
  lng: number;
  /** The detected input format for display */
  format: string;
  /** Warning message (non-blocking, coordinates are still usable) */
  warning?: string;
  /** Whether lat/lng appear swapped (lat > 90 but lng <= 90) */
  possibleSwap?: boolean;
}

/**
 * Parse a single string containing both lat and lng in various formats.
 *
 * Supported formats:
 *  - Decimal degrees:            "40.7128, -74.0060"  or  "40.7128 -74.0060"
 *  - Direction-suffixed decimal: "40.7128N 74.0060W"  or  "40.7128N, 74.0060W"
 *  - DMS:                        "40°42'46\"N 74°00'22\"W"
 *  - Google Maps URL:            "https://maps.google.com/...@40.7128,-74.006,15z"
 *  - Google Maps short link:     "https://maps.app.goo.gl/..." (not resolved, user should paste coords)
 *  - Apple Maps / OSM links with lat/lng query params
 *
 * @returns CoordinateParseResult on success, or a string error message on failure.
 */
export function parseCoordinateString(input: string): CoordinateParseResult | string {
  if (!input || typeof input !== 'string') {
    return 'Please enter coordinates';
  }

  const trimmed = input.trim();
  if (trimmed === '') {
    return 'Please enter coordinates';
  }

  // --- Try Google Maps URL first ---
  const googleResult = tryParseGoogleMapsUrl(trimmed);
  if (googleResult) return addWarnings(googleResult);

  // --- Try generic URL with lat/lng query params ---
  const urlResult = tryParseUrlParams(trimmed);
  if (urlResult) return addWarnings(urlResult);

  // --- Normalize the text input ---
  const cleaned = trimmed
    .replace(/[,;]/g, ' ')    // commas / semicolons -> spaces
    .replace(/\s+/g, ' ')     // collapse whitespace
    .replace(/['\u2018\u2019\u2032]/g, "'")  // normalize apostrophes / primes
    .replace(/["\u201C\u201D\u2033]/g, '"')  // normalize quotes / double primes
    .replace(/[\u00B0\u00BA]/g, '\u00B0');   // normalize degree symbols

  // --- Try DMS: 40°42'46"N 74°00'22"W ---
  const dmsResult = tryParseDMS(cleaned);
  if (dmsResult) return addWarnings(dmsResult);

  // --- Try direction-suffixed decimal: 40.7128N 74.0060W ---
  const dirResult = tryParseDirectionDecimal(cleaned);
  if (dirResult) return addWarnings(dirResult);

  // --- Try plain decimal: 40.7128 -74.0060 ---
  const decResult = tryParseDecimal(cleaned);
  if (decResult) return addWarnings(decResult);

  return 'Could not parse coordinates. Try formats like "40.7128, -74.0060" or "40°42\'46"N 74°00\'22"W"';
}


// ---- Internal parsers ----

function tryParseGoogleMapsUrl(input: string): CoordinateParseResult | null {
  // Match @lat,lng in Google Maps URLs
  const atMatch = input.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (atMatch) {
    const lat = parseFloat(atMatch[1]);
    const lng = parseFloat(atMatch[2]);
    if (isFinite(lat) && isFinite(lng)) {
      return { lat, lng, format: 'Google Maps URL' };
    }
  }

  // Match ?q=lat,lng or ?ll=lat,lng
  const qMatch = input.match(/[?&](?:q|ll|center|query)=(-?\d+\.?\d*)[,+](-?\d+\.?\d*)/);
  if (qMatch) {
    const lat = parseFloat(qMatch[1]);
    const lng = parseFloat(qMatch[2]);
    if (isFinite(lat) && isFinite(lng)) {
      return { lat, lng, format: 'Maps URL' };
    }
  }

  // Match /place/lat,lng/ pattern
  const placeMatch = input.match(/\/place\/(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (placeMatch) {
    const lat = parseFloat(placeMatch[1]);
    const lng = parseFloat(placeMatch[2]);
    if (isFinite(lat) && isFinite(lng)) {
      return { lat, lng, format: 'Google Maps URL' };
    }
  }

  return null;
}

function tryParseUrlParams(input: string): CoordinateParseResult | null {
  // Generic URL with lat/lng, latitude/longitude query params
  if (!input.includes('http')) return null;

  try {
    const url = new URL(input);
    const lat = url.searchParams.get('lat') || url.searchParams.get('latitude') || url.searchParams.get('mlat');
    const lng = url.searchParams.get('lng') || url.searchParams.get('lon') || url.searchParams.get('longitude') || url.searchParams.get('mlon');
    if (lat && lng) {
      const latNum = parseFloat(lat);
      const lngNum = parseFloat(lng);
      if (isFinite(latNum) && isFinite(lngNum)) {
        return { lat: latNum, lng: lngNum, format: 'Map URL' };
      }
    }
  } catch {
    // not a valid URL, fall through
  }

  return null;
}

function tryParseDMS(input: string): CoordinateParseResult | null {
  const dmsPattern = /^(\d+)\u00B0\s*(\d+)'\s*(\d+\.?\d*)(?:"|'')?\s*([NS])\s+(\d+)\u00B0\s*(\d+)'\s*(\d+\.?\d*)(?:"|'')?\s*([EW])$/i;
  const match = input.match(dmsPattern);
  if (!match) return null;

  const latDeg = parseInt(match[1]);
  const latMin = parseInt(match[2]);
  const latSec = parseFloat(match[3]);
  const latDir = match[4].toUpperCase() === 'S' ? -1 : 1;

  const lngDeg = parseInt(match[5]);
  const lngMin = parseInt(match[6]);
  const lngSec = parseFloat(match[7]);
  const lngDir = match[8].toUpperCase() === 'W' ? -1 : 1;

  if (latMin >= 60 || latSec >= 60 || lngMin >= 60 || lngSec >= 60) {
    return null; // invalid minutes/seconds
  }

  const lat = (latDeg + latMin / 60 + latSec / 3600) * latDir;
  const lng = (lngDeg + lngMin / 60 + lngSec / 3600) * lngDir;

  if (!isFinite(lat) || !isFinite(lng)) return null;

  return { lat, lng, format: 'DMS (degrees/minutes/seconds)' };
}

function tryParseDirectionDecimal(input: string): CoordinateParseResult | null {
  const dirPattern = /^(\d+\.?\d*)\s*([NS])\s+(\d+\.?\d*)\s*([EW])$/i;
  const match = input.match(dirPattern);
  if (!match) return null;

  const lat = parseFloat(match[1]) * (match[2].toUpperCase() === 'S' ? -1 : 1);
  const lng = parseFloat(match[3]) * (match[4].toUpperCase() === 'W' ? -1 : 1);

  if (!isFinite(lat) || !isFinite(lng)) return null;

  return { lat, lng, format: 'Decimal degrees with direction' };
}

function tryParseDecimal(input: string): CoordinateParseResult | null {
  const decPattern = /^(-?\d+\.?\d*)\s+(-?\d+\.?\d*)$/;
  const match = input.match(decPattern);
  if (!match) return null;

  const lat = parseFloat(match[1]);
  const lng = parseFloat(match[2]);

  if (!isFinite(lat) || !isFinite(lng)) return null;

  return { lat, lng, format: 'Decimal degrees' };
}

/**
 * Add validation warnings to a parsed coordinate result
 */
function addWarnings(result: CoordinateParseResult): CoordinateParseResult | string {
  const { lat, lng } = result;

  // Hard errors
  if (Math.abs(lat) > 90 && Math.abs(lng) > 180) {
    return 'Both values are out of range. Latitude must be -90 to 90, longitude -180 to 180.';
  }

  // Possible lat/lng swap
  if (Math.abs(lat) > 90 && Math.abs(lng) <= 90) {
    return {
      ...result,
      warning: 'Latitude is out of range (must be -90 to 90). Did you swap lat and lng?',
      possibleSwap: true,
      // Offer the swapped version in the result so the UI can provide a fix button
    };
  }

  if (Math.abs(lng) > 180) {
    return 'Longitude is out of range (must be -180 to 180).';
  }

  // Near Null Island
  if (Math.abs(lat) < 0.5 && Math.abs(lng) < 0.5) {
    return {
      ...result,
      warning: 'These coordinates are near 0,0 (Gulf of Guinea). Is this correct?',
    };
  }

  return result;
}
