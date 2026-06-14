import { useTreasureNotifications } from '@/hooks/useTreasureNotifications';

/**
 * Lightweight boolean indicator for the notification dot in navigation.
 *
 * Reuses the shared `['treasure-notifications', ...]` query (deduped by
 * TanStack Query), so mounting this alongside the notifications page adds no
 * extra relay traffic.
 */
export function useHasUnreadNotifications(): boolean {
  const { unreadCount } = useTreasureNotifications();
  return unreadCount > 0;
}
