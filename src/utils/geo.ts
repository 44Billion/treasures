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

// ===== GEOHASH VIEWPORT COVERAGE =====

import { encodeGeohash } from '@/utils/nip-gc';

/** A simple lat/lng bounding box (south-west / north-east corners). */
export interface GeoBounds {
  south: number;
  west: number;
  north: number;
  east: number;
}

/**
 * Approximate width/height (in degrees) of a geohash cell at a given precision.
 * Geohash cells alternate which axis gets the extra bit, so cells are not square,
 * but these averaged figures are accurate enough for viewport coverage math.
 *
 * Index = precision (1-9). Values are [lngWidth°, latHeight°].
 */
const GEOHASH_CELL_SIZE_DEG: Record<number, { lng: number; lat: number }> = {
  1: { lng: 45, lat: 45 },
  2: { lng: 11.25, lat: 5.625 },
  3: { lng: 1.40625, lat: 1.40625 },
  4: { lng: 0.3515625, lat: 0.17578125 },
  5: { lng: 0.0439453125, lat: 0.0439453125 },
  6: { lng: 0.010986328125, lat: 0.0054931640625 },
  7: { lng: 0.001373291015625, lat: 0.001373291015625 },
  8: { lng: 0.00034332275390625, lat: 0.000171661376953125 },
  9: { lng: 0.0000429153442382813, lat: 0.0000429153442382813 },
};

/**
 * Pick the geohash prefix precision to use when querying treasures for a map
 * viewport at a given zoom level.
 *
 * Constraints that drive this mapping:
 *  - Treasure events (NIP-GC) always carry geohash `g` tags at precisions 3 and 4
 *    (additional precisions 5–9 only when the coordinates are specific enough —
 *    see {@link getGeohashPrecisionLevels}). A relay `#g` filter matches exact tag
 *    values, so to guarantee we match *every* cache in the area we must query at a
 *    precision that every cache reliably stores: precision 3 or 4. Precision 4
 *    cells are ~20–40km, which comfortably covers even close map views with only a
 *    handful of cells, so we cap at 4 rather than risk missing caches that lack a
 *    precision-5 tag.
 *
 * @param zoom Leaflet zoom level (roughly 1 = whole world, 18 = building level)
 * @returns geohash prefix length in the range 3–4 (or 0 for "world view, no filter")
 */
export function geohashPrecisionForZoom(zoom: number): number {
  if (zoom <= 4) return 0; // Continental / world view — too broad to filter usefully
  if (zoom <= 7) return 3; // ~150km cells — region / whole state
  return 4; // ~20–40km cells — metro, neighborhood and closer
}

/**
 * Compute the set of geohash prefixes that cover a lat/lng bounding box, used to
 * build a relay `#g` filter for the current map viewport so we can discover
 * treasures local to where the user is looking.
 *
 * If the box would require more than `maxCells` cells at the requested
 * precision, the precision is automatically reduced (coarser, larger cells)
 * until the coverage fits — but never below `minPrecision`. This is important:
 * NIP-GC events always carry `g` tags at precisions 3 and 4, so stepping *down*
 * to precision 3/4 still matches stored tags, whereas returning nothing (the
 * old behavior) meant wide views like a whole U.S. state silently fetched no
 * treasures at all. We never step below precision 3 because caches don't store
 * coarser tags; if even `minPrecision` exceeds `maxCells`, we use it anyway
 * (a larger filter is fine — an empty result is not).
 *
 * @param bounds Viewport bounds
 * @param precision Desired geohash prefix length (1–9); may be reduced to fit
 * @param maxCells Soft maximum number of cells to return (default 200)
 * @param minPrecision Precision floor; never step below this (default 3)
 * @returns Covering geohash prefixes (all the same length), or `[]` only when
 *   the whole world is visible.
 */
export function geohashesForBounds(
  bounds: GeoBounds,
  precision: number,
  maxCells: number = 200,
  minPrecision: number = 3,
): string[] {
  if (precision < 1) return [];

  // Clamp bounds to valid lat/lng ranges. Longitude may wrap past ±180 after a
  // world-wrap pan, so normalize the span rather than the absolute values.
  const south = Math.max(-90, Math.min(90, bounds.south));
  const north = Math.max(-90, Math.min(90, bounds.north));
  const west = bounds.west;
  const east = bounds.east;

  // If the span is >= 360°, the whole world is visible — not worth filtering.
  if (east - west >= 360) return [];

  // Find the highest precision (<= requested) whose coverage fits within
  // maxCells, but never go below minPrecision (the coarsest precision that
  // treasures actually store as `g` tags).
  const floor = Math.max(1, minPrecision);
  let usePrecision = Math.min(precision, 9);
  let cell = GEOHASH_CELL_SIZE_DEG[usePrecision];
  while (usePrecision > floor) {
    cell = GEOHASH_CELL_SIZE_DEG[usePrecision];
    if (!cell) {
      usePrecision--;
      continue;
    }
    const latSteps = Math.floor((north - south) / cell.lat) + 2;
    const lngSteps = Math.floor((east - west) / cell.lng) + 2;
    if (latSteps * lngSteps <= maxCells) break;
    usePrecision--;
  }
  cell = GEOHASH_CELL_SIZE_DEG[usePrecision];
  if (!cell) return [];

  const prefixes = new Set<string>();

  for (let lat = south; lat <= north + cell.lat; lat += cell.lat) {
    for (let lng = west; lng <= east + cell.lng; lng += cell.lng) {
      const clampedLat = Math.max(-90, Math.min(90, lat));
      // Normalize longitude into [-180, 180) for a valid geohash encode.
      let normLng = ((lng + 180) % 360 + 360) % 360 - 180;
      if (normLng === 180) normLng = -180;
      prefixes.add(encodeGeohash(clampedLat, normLng, usePrecision));
      // Hard safety stop (shouldn't trigger given the step-down above).
      if (prefixes.size > maxCells) return Array.from(prefixes);
    }
  }

  return Array.from(prefixes);
}

