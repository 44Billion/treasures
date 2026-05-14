import { useMutation } from '@tanstack/react-query';
import type { NostrEvent } from '@nostrify/nostrify';

import { useToast } from '@/hooks/useToast';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { NIP_GD_KINDS, buildGoodDeedTags } from '@/utils/nip-gd';

export interface CreateGoodDeedData {
  /** First-person narrative description of the deed. */
  content: string;
  /** Treasure whose Key Quest this deed completes. */
  geocache: {
    pubkey: string;
    dTag: string;
    kind?: number;
  };
  /** Optional NIP-92 `imeta` tags (built via buildImetaTag). */
  imeta?: string[][];
  /** Optional categorization (`t` tags). */
  categories?: string[];
  /** Optional beneficiaries (`p` tags). */
  beneficiaries?: string[];
  /** Optional location geohash. */
  geohash?: string;
}

/**
 * Publish a kind 5777 Good Deed event.
 *
 * In Treasures this is currently used as the claim-by-deed completion path
 * for a treasure's Key Quest mission. See NIP-GD.md for the full spec.
 */
export function useCreateGoodDeed() {
  const { mutateAsync: publishEvent } = useNostrPublish();
  const { toast } = useToast();

  return useMutation<NostrEvent, Error, CreateGoodDeedData>({
    mutationFn: async (data) => {
      const content = (data.content ?? '').trim();
      if (!content) {
        throw new Error('A description of the deed is required.');
      }
      if (!data.geocache.pubkey || !data.geocache.dTag) {
        throw new Error('Treasure reference is required.');
      }

      const tags = buildGoodDeedTags({
        geocache: data.geocache,
        imeta: data.imeta,
        categories: data.categories,
        beneficiaries: data.beneficiaries,
        geohash: data.geohash,
      });

      return publishEvent({
        kind: NIP_GD_KINDS.GOOD_DEED,
        content,
        tags,
      });
    },
    onSuccess: () => {
      toast({
        title: 'Good Deed posted',
        description: 'Your Key Quest completion has been published.',
      });
    },
    onError: (error: unknown) => {
      const errorObj = error as { message?: string };
      let description = 'Please try again.';

      if (errorObj.message?.includes('timeout')) {
        description = 'Connection timeout. Please check your internet connection and try again.';
      } else if (errorObj.message?.includes('rejected') || errorObj.message?.includes('cancelled')) {
        description = 'Signing was cancelled.';
      } else if (errorObj.message?.includes('not found on relays')) {
        description = "Deed was created but couldn't be verified on relays. It may appear after a delay.";
      } else if (errorObj.message) {
        description = errorObj.message;
      }

      toast({
        title: 'Failed to post Good Deed',
        description,
        variant: 'destructive',
      });
    },
  });
}
