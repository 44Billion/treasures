/**
 * Application-wide constants
 */

// Network timeouts (in milliseconds)
export const TIMEOUTS = {
  QUERY: 8000,
  CONNECTIVITY_CHECK: 3000,
  TILE_DOWNLOAD: 10000,
  FAST_QUERY: 2000,
  DELETE_OPERATION: 3000, // Shorter timeout for deletions - they're fire-and-forget
} as const;

// Query limits
export const QUERY_LIMITS = {
  GEOCACHES: 50,
  LOGS: 200,
  BATCH_SIZE: 3,
  PROXIMITY_RESULTS: 100,
  HOME_PAGE_LIMIT: 3,
  FAST_LOAD_LIMIT: 10,
} as const;

// Retry configuration
export const RETRY_CONFIG = {
  MAX_RETRIES: 2,
  BASE_DELAY: 1000,
  BATCH_DELAY: 100,
  CONNECTIVITY_INTERVAL: 30000,
  SYNC_INTERVAL: 300000, // 5 minutes
} as const;

// Storage configuration
export const STORAGE_CONFIG = {
  MAX_AGE_DAYS: 30,
  CLEANUP_INTERVAL: 24 * 60 * 60 * 1000, // 24 hours
  MAX_CACHE_ENTRIES: 500,
  MAX_IMAGE_CACHE_ENTRIES: 200,
} as const;

// Validation limits
export const VALIDATION_LIMITS = {
  NAME_MIN_LENGTH: 3,
  NAME_MAX_LENGTH: 100,
  DESCRIPTION_MIN_LENGTH: 10,
  DESCRIPTION_MAX_LENGTH: 1000,
  LOG_MIN_LENGTH: 5,
  LOG_MAX_LENGTH: 500,
  HINT_MAX_LENGTH: 200,
  DIFFICULTY_MIN: 1,
  DIFFICULTY_MAX: 5,
  TERRAIN_MIN: 1,
  TERRAIN_MAX: 5,
} as const;

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

// UI configuration
export const UI_CONFIG = {
  TOAST_DURATION: 5000,
  DEBOUNCE_DELAY: 300,
  ANIMATION_DURATION: 200,
  MOBILE_BREAKPOINT: 768,
} as const;

// Single relay configuration - using ditto.pub as sole relay
export const DEFAULT_RELAY = 'wss://ditto.pub/relay';

// For compatibility with existing code that expects an array
export const DEFAULT_RELAYS = [DEFAULT_RELAY];