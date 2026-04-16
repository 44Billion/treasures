import { type NostrEvent, type NostrMetadata, NSchema as n } from '@nostrify/nostrify';
import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';

export function useAuthor(pubkey: string | undefined) {
  const { nostr } = useNostr();

  return useQuery<{ event?: NostrEvent; metadata?: NostrMetadata; hasProfile?: boolean }>({
    queryKey: ['author', pubkey ?? ''],
    queryFn: async ({ signal }) => {
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
  });
}
