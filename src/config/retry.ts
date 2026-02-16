/**
 * Retry configuration for network operations
 * Used across features for consistent retry behavior
 */

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