/**
 * Application-wide constants
 */

// Network timeouts (in milliseconds)
export const TIMEOUTS = {
  SAFARI_QUERY: 5000,
  SAFARI_QUERY_RETRY: 6000,
  STANDARD_QUERY: 15000,
  CONNECTIVITY_CHECK: 5000,
  TILE_DOWNLOAD: 10000,
} as const;

// Query limits
export const QUERY_LIMITS = {
  SAFARI_GEOCACHES: 30,
  STANDARD_GEOCACHES: 100,
  SAFARI_LOGS: 100,
  STANDARD_LOGS: 500,
  SAFARI_BATCH_SIZE: 3,
  STANDARD_BATCH_SIZE: 5,
  PROXIMITY_RESULTS: 150,
} as const;

// Retry configuration
export const RETRY_CONFIG = {
  MAX_RETRIES: 3,
  SAFARI_MAX_RETRIES: 2,
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

// Default relay configuration
export const DEFAULT_RELAYS = [
  'wss://ditto.pub/relay',
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.nostr.band',
] as const;

// Safari-specific relays (faster/more reliable for Safari)
export const SAFARI_RELAYS = [
  'wss://ditto.pub/relay',
  'wss://relay.damus.io',
  'wss://nos.lol',
] as const;