import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { TIMEOUTS } from '@/config';
import { NIP_GC_KINDS, parseAdventureEvent } from '@/utils/nip-gc';
import type { Adventure } from '@/types/adventure';

/**
 * Fetch all published adventures for the browse page.
 * Queries kind 37517 geocache curation list events.
 */
export function useAdventures() {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['adventures'],
    queryFn: async (c): Promise<Adventure[]> => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(TIMEOUTS.QUERY)]);

      const events = await nostr.query([{
        kinds: [NIP_GC_KINDS.ADVENTURE],
        limit: 50,
      }], { signal });

      const adventures: Adventure[] = [];
      for (const event of events) {
        const adventure = parseAdventureEvent(event);
        if (adventure) {
          adventures.push(adventure);
        }
      }

      // Sort by creation date, newest first
      adventures.sort((a, b) => b.created_at - a.created_at);

      return adventures;
    },
    staleTime: 300000, // 5 minutes
    gcTime: 600000, // 10 minutes
  });
}
