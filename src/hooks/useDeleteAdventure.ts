import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { NIP_GC_KINDS } from '@/utils/nip-gc';
import type { Adventure } from '@/types/adventure';

interface DeleteAdventureParams {
  /** The adventure to delete. Must be authored by the current user. */
  adventure: Adventure;
  /**
   * Optional reason published with the NIP-09 deletion event content.
   * Defaults to a short generic reason if omitted.
   */
  reason?: string;
}

/**
 * Hook to delete an adventure (kind 37517 curation list) by publishing a
 * NIP-09 (kind 5) deletion event. Mirrors the pattern used for treasure
 * drafts and geocaches: one `e` tag for the original event id, one `a` tag
 * for the addressable coordinate, and a `k` tag for the deleted kind.
 *
 * Authorship is enforced client-side as a safeguard — relays will also
 * reject deletion events that don't match the original author, but failing
 * fast here keeps the UI honest.
 */
export function useDeleteAdventure() {
  const { mutateAsync: publishEvent } = useNostrPublish();
  const queryClient = useQueryClient();
  const { user } = useCurrentUser();

  return useMutation({
    mutationFn: async ({ adventure, reason }: DeleteAdventureParams) => {
      if (!user) {
        throw new Error('You must be logged in to delete an adventure.');
      }
      if (adventure.pubkey !== user.pubkey) {
        throw new Error('Only the author can delete this adventure.');
      }

      const tags: string[][] = [
        ['e', adventure.id],
        ['a', `${NIP_GC_KINDS.ADVENTURE}:${adventure.pubkey}:${adventure.dTag}`],
        ['k', NIP_GC_KINDS.ADVENTURE.toString()],
      ];

      await publishEvent({
        kind: 5,
        content: reason ?? 'Adventure deleted by author',
        tags,
      });
    },
    onSuccess: (_data, { adventure }) => {
      // Optimistically clear the adventure from caches so listings and the
      // detail page reflect the deletion before relays propagate the event.
      queryClient.setQueryData(['adventure', adventure.naddr], null);
      queryClient.invalidateQueries({ queryKey: ['adventures'] });
      queryClient.invalidateQueries({ queryKey: ['adventure'] });
    },
  });
}
