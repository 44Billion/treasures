/**
 * Polling intervals for background updates
 * Used by data management hooks for consistent update timing
 */

// Polling intervals for prefetching and updates
export const POLLING_INTERVALS = {
  GEOCACHES: 180000, // 3 minutes - background polling for real updates only
  LOGS: 120000, // 2 minutes - more frequent for active logs
  DELETION_EVENTS: 600000, // 10 minutes - deletions are rare
  BACKGROUND_SYNC: 300000, // 5 minutes - intelligent background sync with LRU cache
  FAST_UPDATES: 60000, // 1 minute - for immediate updates when needed
  SLOW_UPDATES: 1800000, // 30 minutes - for less critical data
} as const;