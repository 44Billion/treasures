import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { TIMEOUTS } from '@/lib/constants';
import type { NostrEvent } from '@nostrify/nostrify';

export function useZaps(targetId: string) {
  const { nostr } = useNostr();

  return useQuery<NostrEvent[], Error>({
    queryKey: ['zaps', targetId],
    queryFn: async (c) => {
      if (!targetId) return [];
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(TIMEOUTS.QUERY)]);
      const events = await nostr.query(
        [
          {
            kinds: [9735],
            '#e': [targetId],
          },
        ],
        { signal }
      );
      return events;
    },
    enabled: !!targetId,
  });
}
