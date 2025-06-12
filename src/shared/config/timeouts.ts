/**
 * Network timeout configurations
 * Used across all features for consistent timeout handling
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