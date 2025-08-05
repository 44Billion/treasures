import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { TIMEOUTS, QUERY_LIMITS } from '@/lib/constants';
import type { NostrEvent } from '@nostrify/nostrify';
import { nip19 } from 'nostr-tools';
import { useZapStore } from '@/shared/stores/useZapStore';
import { separateQueries } from '@/shared/utils/batchQuery';

export function useZaps(targetId: string, naddr?: string) {
  const { nostr } = useNostr();
  const { setZaps } = useZapStore();
  const queryKey = naddr ? `naddr:${naddr}` : `event:${targetId}`;

  return useQuery<NostrEvent[], Error>({
    queryKey: ['zaps', queryKey],
    queryFn: async (c) => {
      if (!targetId && !naddr) return [];
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(TIMEOUTS.QUERY)]);
      
      const queryConfigs: any[] = [];

      if (naddr) {
        try {
          const decoded = nip19.decode(naddr);
          if (decoded.type === 'naddr') {
            const { kind, pubkey, identifier } = decoded.data;
            const coordinate = `${kind}:${pubkey}:${identifier}`;
            console.log('DEBUG: useZaps naddr query:', { 
              naddr, 
              decodedKind: kind, 
              coordinate,
              pubkey,
              identifier 
            });
            queryConfigs.push({
              filters: {
                kinds: [9735],
                '#a': [coordinate],
                limit: QUERY_LIMITS.ZAPS,
              },
              name: 'zaps-naddr'
            });
          }
        } catch (e) {
          console.error("Invalid naddr", naddr, e);
        }
      }
      
      if (targetId) {
        queryConfigs.push({
          filters: {
            kinds: [9735],
            '#e': [targetId],
            limit: QUERY_LIMITS.ZAPS,
          },
          name: 'zaps-event'
        });
      }

      if (queryConfigs.length === 0) return [];

      // Use separateQueries to avoid "arr too big" errors
      const events = await separateQueries(nostr, queryConfigs, signal);
      
      // Deduplicate events by ID to handle React 18's double-rendering in development
      const seenIds = new Set();
      const uniqueEvents = events.filter(event => {
        if (seenIds.has(event.id)) {
          return false;
        }
        seenIds.add(event.id);
        return true;
      });

      // Successfully fetched zap events
      setZaps(queryKey, uniqueEvents);
      return uniqueEvents;
    },
    enabled: !!targetId || !!naddr,
    staleTime: 300000, // 5 minutes - better caching
    gcTime: 600000, // 10 minutes - cache retention
    refetchOnWindowFocus: false,
    refetchInterval: false, // No background sync
    refetchIntervalInBackground: false, // Disabled background sync
  });
}
