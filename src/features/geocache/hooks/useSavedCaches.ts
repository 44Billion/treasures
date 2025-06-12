/**
 * Re-export the Nostr-based saved caches hook as the default
 * This ensures all components use the same Nostr-based implementation
 */
export { useNostrSavedCaches as useSavedCaches } from './useNostrSavedCaches';