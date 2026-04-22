import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { NIP_GC_KINDS } from '@/utils/nip-gc';
import { TIMEOUTS } from '@/config';
import { QUERY_LIMITS } from '@/config/limits';

/**
 * Returns a Set of geocache coordinate keys ("kind:pubkey:dTag") the current user has found.
 * Lightweight hook for showing found status on geocache cards across the app.
 */
export function useMyFoundCaches() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();

  const { data: foundKeys } = useQuery({
    queryKey: ['my-found-caches', user?.pubkey],
    queryFn: async (c) => {
      if (!user?.pubkey) return [];

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(TIMEOUTS.QUERY)]);

      const events = await nostr.query([{
        kinds: [NIP_GC_KINDS.FOUND_LOG],
        authors: [user.pubkey],
        limit: QUERY_LIMITS.LOGS,
      }], { signal });

      const keys: string[] = [];
      for (const event of events) {
        const aTag = event.tags.find(t => t[0] === 'a')?.[1];
        if (aTag) {
          keys.push(aTag);
        }
      }

      return [...new Set(keys)];
    },
    enabled: !!user?.pubkey,
    staleTime: 60000,
    gcTime: 300000,
  });

  const foundSet = useMemo(() => new Set(foundKeys || []), [foundKeys]);

  return foundSet;
}
