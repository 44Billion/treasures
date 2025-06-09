/**
 * Application-wide constants
 */

// Network timeouts (in milliseconds)
export const TIMEOUTS = {
  QUERY: 15000, // 15 seconds - balanced for reliability and speed
  CONNECTIVITY_CHECK: 8000, // 8 seconds - enough for WebSocket handshake
  TILE_DOWNLOAD: 10000,
  FAST_QUERY: 5000, // 5 seconds - optimistic fast loading
  DELETE_OPERATION: 5000, // 5 seconds - a bit more time for deletions
  PUBLISH: 12000, // 12 seconds - reasonable timeout for publishing events
  OPTIMISTIC_LOAD: 1000, // 1 second - very fast initial load
} as const;

// Query limits
export const QUERY_LIMITS = {
  GEOCACHES: 500, // Increased to prevent legitimate caches being bumped off by test traffic
  LOGS: 100, // Reasonable limit per geocache
  BATCH_SIZE: 3,
  PROXIMITY_RESULTS: 100,
  HOME_PAGE_LIMIT: 6,
  FAST_LOAD_LIMIT: 6, // Load 6 geocaches quickly for immediate display
  SKELETON_COUNT: 6, // Number of skeleton cards to show
} as const;

// Retry configuration
export const RETRY_CONFIG = {
  MAX_RETRIES: 2, // Reduced retries for faster feedback
  BASE_DELAY: 1000, // Shorter delay between retries
  BATCH_DELAY: 200, // More breathing room between batch operations
  CONNECTIVITY_INTERVAL: 30000,
  SYNC_INTERVAL: 300000, // 5 minutes
  PUBLISH_MAX_RETRIES: 2, // Specific retry count for publishing
  PUBLISH_BASE_DELAY: 800, // Shorter delay for publishing retries
  // Verified logs use the same retry logic as regular publishing
  // The useNostrPublish hook handles all retry logic consistently
} as const;

// Polling intervals for prefetching and updates
export const POLLING_INTERVALS = {
  GEOCACHES: 180000, // 3 minutes - background polling for real updates only
  LOGS: 120000, // 2 minutes - more frequent for active logs
  DELETION_EVENTS: 600000, // 10 minutes - deletions are rare
  BACKGROUND_SYNC: 300000, // 5 minutes - intelligent background sync with LRU cache
  FAST_UPDATES: 60000, // 1 minute - for immediate updates when needed
  SLOW_UPDATES: 1800000, // 30 minutes - for less critical data
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

// Multi-relay configuration for better stability
export const DEFAULT_RELAYS = [
  'wss://relay.primal.net',      // Primary relay
];

// Primary relay for backwards compatibility
export const DEFAULT_RELAY = DEFAULT_RELAYS[0];

// Preset relays for the relay selector
export const PRESET_RELAYS = [
  { url: 'wss://relay.primal.net', name: 'Primal' },
  { url: 'wss://ditto.pub/relay', name: 'Ditto' },
  { url: 'wss://relay.nostr.band', name: 'Nostr.Band' },
  { url: 'wss://relay.damus.io', name: 'Damus' },
  { url: 'wss://nos.lol', name: 'nos.lol' },
];