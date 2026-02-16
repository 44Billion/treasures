/**
 * Map configuration constants
 * Used by map features for consistent map behavior
 */

// Map configuration
export const MAP_CONFIG = {
  DEFAULT_CENTER: [40.7128, -74.0060] as const, // NYC
  DEFAULT_ZOOM: 13,
  MAX_ZOOM: 19,
  MIN_ZOOM: 1,
  TILE_SIZE: 256,
  PROXIMITY_RADIUS_KM: 10,
  GEOHASH_PRECISION: 5,
} as const;