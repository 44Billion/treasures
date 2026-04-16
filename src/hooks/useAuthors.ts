import { NSchema as n, type NostrEvent } from '@nostrify/nostrify';
import { useNostr } from '@nostrify/react';
import { useQueries } from '@tanstack/react-query';

export function useAuthors(pubkeys: (string | undefined)[]) {
  const { nostr } = useNostr();

  return useQueries({
    queries: pubkeys.map((pubkey) => {
      return {
        queryKey: ['author', pubkey ?? ''],
        queryFn: async ({ signal }: { signal: AbortSignal }) => {
          if (!pubkey) {
            return {};
          }

          const [event] = await nostr.query(
            [{ kinds: [0], authors: [pubkey], limit: 1 }],
            { signal },
          );

          if (!event) {
            return { hasProfile: false };
          }

          try {
            const metadata = n.json().pipe(n.metadata()).parse(event.content);
            return { metadata, event, hasProfile: true };
          } catch {
            return { event, hasProfile: true };
          }
        },
        staleTime: 5 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
        retry: 1,
        enabled: !!pubkey,
        refetchOnWindowFocus: false,
        refetchOnMount: false,
        placeholderData: { hasProfile: false },
      };
    }),
  });
}
