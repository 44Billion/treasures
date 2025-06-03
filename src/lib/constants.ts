/**
 * Application-wide constants
 */

// Network timeouts (in milliseconds) - Unified system handles browser optimization
export const TIMEOUTS = {
  QUERY: 8000, // Automatically optimized per browser (Safari: 5s, Others: 8s)
  CONNECTIVITY_CHECK: 3000,
  TILE_DOWNLOAD: 10000,
  FAST_QUERY: 2000, // For quick operations
  DELETE_OPERATION: 5000, // For deletion operations
} as const;

// Query limits - Unified system handles browser optimization
export const QUERY_LIMITS = {
  GEOCACHES: 50, // Automatically optimized per browser (Safari: 20, Others: 50)
  LOGS: 200, // Automatically optimized per browser (Safari: 50, Others: 200)
  BATCH_SIZE: 3, // Automatically optimized per browser (Safari: 2, Others: 3)
  PROXIMITY_RESULTS: 100,
  HOME_PAGE_LIMIT: 3, // For home page preview
  FAST_LOAD_LIMIT: 10, // For quick initial loads
} as const;

// Retry configuration - Unified system handles browser optimization
export const RETRY_CONFIG = {
  MAX_RETRIES: 2, // Automatically optimized per browser (Safari: 1, Others: 2)
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

// Default relay configuration - using ditto.pub as primary relay
// Additional relays can be configured by users in Settings
export const DEFAULT_RELAYS = [
  'wss://ditto.pub/relay',
] as const;