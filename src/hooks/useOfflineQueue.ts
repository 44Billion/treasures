/**
 * useOfflineQueue - reactive view of the offline publish queue.
 *
 * Surfaces the signed events that were queued because the device was offline
 * (or every relay was unreachable) when the user tapped Publish. These live in
 * IndexedDB (`offlinePublishQueue`) keyed by event id, are NOT yet on any
 * relay, and broadcast automatically when connectivity returns
 * (`useOfflinePublishFlush`).
 *
 * Used by the Profile "Pending offline" section so the user can SEE what's
 * waiting, retry a single item now, or discard one they no longer want.
 */
import { useNostr } from '@nostrify/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { NostrEvent } from '@nostrify/nostrify';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { resilientPublish } from '@/lib/resilientPublish';
import {
  getQueuedEvents,
  removeQueuedEvent,
} from '@/lib/offlinePublishQueue';

export const OFFLINE_QUEUE_QUERY_KEY = ['offline-publish-queue'] as const;

export function useOfflineQueue() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();

  // Only the current user's queued events. The queue is device-local, so the
  // pubkey filter just keeps the UI honest when accounts are switched.
  const queued = useQuery<NostrEvent[]>({
    queryKey: OFFLINE_QUEUE_QUERY_KEY,
    queryFn: async () => {
      const events = await getQueuedEvents();
      if (!user) return events;
      return events.filter((e) => e.pubkey === user.pubkey);
    },
    // Cheap IndexedDB read; keep it fresh whenever the section is shown.
    staleTime: 0,
  });

  /** Attempt to broadcast one queued event right now. */
  const retryOne = useMutation({
    mutationFn: async (event: NostrEvent) => {
      const { status } = await resilientPublish(nostr, event);
      if (status === 'published') {
        await removeQueuedEvent(event.id);
      }
      return status;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: OFFLINE_QUEUE_QUERY_KEY });
    },
  });

  /** Discard a queued event without publishing it. */
  const discardOne = useMutation({
    mutationFn: async (eventId: string) => {
      await removeQueuedEvent(eventId);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: OFFLINE_QUEUE_QUERY_KEY });
    },
  });

  return { queued, retryOne, discardOne };
}
