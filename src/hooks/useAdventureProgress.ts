import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { NIP_GC_KINDS } from '@/utils/nip-gc';
import { TIMEOUTS } from '@/config';

/**
 * Track a user's found-log progress against a set of geocache references.
 * Returns which caches the current user has found.
 */
export function useAdventureProgress(geocacheRefs: string[]) {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();

  const { data: foundRefs } = useQuery({
    queryKey: ['adventure-progress', user?.pubkey, geocacheRefs.join(',')],
    queryFn: async (c) => {
      if (!user?.pubkey || geocacheRefs.length === 0) return [];

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(TIMEOUTS.QUERY)]);

      // Query for found logs by this user referencing these geocaches
      const events = await nostr.query([{
        kinds: [NIP_GC_KINDS.FOUND_LOG],
        authors: [user.pubkey],
        '#a': geocacheRefs,
        limit: geocacheRefs.length,
      }], { signal });

      // Extract which geocache coordinates have been found
      const found: string[] = [];
      for (const event of events) {
        const aTag = event.tags.find(t => t[0] === 'a')?.[1];
        if (aTag && geocacheRefs.includes(aTag)) {
          found.push(aTag);
        }
      }

      return [...new Set(found)];
    },
    enabled: !!user?.pubkey && geocacheRefs.length > 0,
    staleTime: 60000,
    gcTime: 300000,
  });

  const foundSet = useMemo(() => new Set(foundRefs || []), [foundRefs]);

  return {
    foundSet,
    totalFound: foundSet.size,
    totalCaches: geocacheRefs.length,
  };
}
