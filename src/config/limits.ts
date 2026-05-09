/**
 * Query limits and batch sizes
 * Used across features for consistent data fetching
 */

// Query limits
export const QUERY_LIMITS = {
  GEOCACHES: 200,        // Per-page query limit
  GEOCACHES_MAX: 500,    // Total paginated limit
  LOGS: 100, // Reasonable limit per geocache
  ZAPS: 50, // Reasonable limit per target
  BATCH_SIZE: 3,
  PROXIMITY_RESULTS: 100,
  HOME_PAGE_LIMIT: 6,
  FAST_LOAD_LIMIT: 6, // Load 6 geocaches quickly for immediate display
  SKELETON_COUNT: 6, // Number of skeleton cards to show
  WOT_MAX_FOLLOWS: 500, // Sensible default for WoT
} as const;

