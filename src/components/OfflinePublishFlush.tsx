import { useOfflinePublishFlush } from '@/hooks/useOfflinePublishFlush';

/**
 * Mounts the offline publish queue flusher inside the Nostr provider tree.
 * Renders nothing.
 */
export function OfflinePublishFlush() {
  useOfflinePublishFlush();
  return null;
}
