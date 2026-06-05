import { type NostrEvent, type NostrMetadata, NSchema as n } from '@nostrify/nostrify';
import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';
import { useEventStore } from '@/hooks/useEventStore';

export function useAuthor(pubkey: string | undefined) {
  const { nostr } = useNostr();
  const eventStore = useEventStore();

  return useQuery<{ event?: NostrEvent; metadata?: NostrMetadata; hasProfile?: boolean }>({
    queryKey: ['author', pubkey ?? ''],
    queryFn: async ({ signal }) => {
      if (!pubkey) {
        return {};
      }

      const filter = [{ kinds: [0], authors: [pubkey], limit: 1 }];

      // Query relays first. The NostrBatcher mirrors the result into the local
      // event store, so subsequent loads (and offline sessions) can read it
      // back from the cache below.
      let [event] = await nostr.query(filter, { signal });

      // Relay miss: fall back to the locally cached kind 0 rather than treating
      // the author as having no profile. A miss is almost always a transient
      // relay hiccup (or being offline), not an intentional profile deletion.
      if (!event) {
        const store = await eventStore;
        const [cached] = await store.query(filter);
        event = cached;
      }

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
