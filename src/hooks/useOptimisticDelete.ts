import { useNostr } from '@nostrify/react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { TIMEOUTS } from '@/lib/constants';
import type { NostrEvent } from '@nostrify/nostrify';

/**
 * Hook for optimistic deletion operations.
 * This hook implements a fire-and-forget approach for deletion events:
 * - Signs the deletion event
 * - Sends to relays with a short timeout
 * - Doesn't fail if relays don't respond immediately
 * - Only fails for signing errors (user cancellation, no signer, etc.)
 */
export function useOptimisticDelete() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();

  const deleteEvent = async (
    eventId: string,
    eventKind?: number,
    reason?: string,
    additionalTags?: string[][]
  ): Promise<NostrEvent> => {
    if (!user?.signer) {
      throw new Error("You must be logged in to delete events");
    }

    // Create deletion event
    const deletionTags: string[][] = [
      ['e', eventId],
      ['client', 'treasures'],
    ];

    if (eventKind) {
      deletionTags.push(['k', eventKind.toString()]);
    }

    if (additionalTags) {
      deletionTags.push(...additionalTags);
    }

    const deletionEvent = {
      kind: 5,
      content: reason || 'Event deleted by author',
      tags: deletionTags,
      created_at: Math.floor(Date.now() / 1000),
    };

    // Sign the event (this can fail and should fail the operation)
    const signedEvent = await user.signer.signEvent(deletionEvent);

    // Fire-and-forget: send to relays without strict verification
    // Deletion events are optimistic - we assume they work
    try {
      await nostr.event(signedEvent, { 
        signal: AbortSignal.timeout(TIMEOUTS.DELETE_OPERATION) 
      });
    } catch (publishError) {
      // Don't throw here - the event was signed and some relays might have received it
      // Log for debugging but continue with optimistic success
      console.warn('Deletion event publish warning (continuing optimistically):', publishError);
    }

    return signedEvent;
  };

  return { deleteEvent };
}