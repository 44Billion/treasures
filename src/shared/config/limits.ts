/**
 * Query limits and batch sizes
 * Used across features for consistent data fetching
 */

// Query limits
export const QUERY_LIMITS = {
  GEOCACHES: 150,
  LOGS: 100, // Reasonable limit per geocache
  ZAPS: 50, // Reasonable limit per target
  BATCH_SIZE: 3,
  PROXIMITY_RESULTS: 100,
  HOME_PAGE_LIMIT: 6,
  FAST_LOAD_LIMIT: 6, // Load 6 geocaches quickly for immediate display
  SKELETON_COUNT: 6, // Number of skeleton cards to show
  WOT_MAX_FOLLOWS: 500, // Sensible default for WoT
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