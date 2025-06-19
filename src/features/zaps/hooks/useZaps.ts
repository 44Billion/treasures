import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { TIMEOUTS } from '@/lib/constants';
import type { NostrEvent } from '@nostrify/nostrify';
import { nip19 } from 'nostr-tools';

export function useZaps(targetId: string, naddr?: string) {
  const { nostr } = useNostr();

  return useQuery<NostrEvent[], Error>({
    queryKey: ['zaps', targetId, naddr],
    queryFn: async (c) => {
      if (!targetId) return [];
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(TIMEOUTS.QUERY)]);
      
      const filters: any[] = [];

      if (naddr) {
        try {
          const decoded = nip19.decode(naddr);
          if (decoded.type === 'naddr') {
            const { kind, pubkey, identifier } = decoded.data;
            filters.push({
              kinds: [9735],
              '#a': [`${kind}:${pubkey}:${identifier}`],
            });
          }
        } catch (e) {
          console.error("Invalid naddr", naddr, e);
        }
      } else {
        filters.push({
          kinds: [9735],
          '#e': [targetId],
        });
      }

      if (filters.length === 0) return [];

      const events = await nostr.query(filters, { signal });
      return events;
    },
    enabled: !!targetId,
  });
}
