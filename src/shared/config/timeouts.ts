/**
 * Network timeout configurations
 * Used across all features for consistent timeout handling
 */

// Network timeouts (in milliseconds)
export const TIMEOUTS = {
  QUERY: 8000, // 8 seconds - faster failure for better UX
  CONNECTIVITY_CHECK: 5000, // 5 seconds - faster connectivity detection
  TILE_DOWNLOAD: 10000,
  FAST_QUERY: 3000, // 3 seconds - faster optimistic loading
  DELETE_OPERATION: 5000, // 5 seconds - a bit more time for deletions
  PUBLISH: 12000, // 12 seconds - reasonable timeout for publishing events
  OPTIMISTIC_LOAD: 1000, // 1 second - very fast initial load
  STATS_QUERY: 15000, // 15 seconds - longer timeout for stats queries that fetch more data
} as const;