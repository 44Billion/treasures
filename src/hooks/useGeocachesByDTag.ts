import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { TIMEOUTS } from '@/config';
import { NIP_GC_KINDS, parseGeocacheEvent } from '@/utils/nip-gc';
import { useMultiRelayQuery } from '@/hooks/useMultiRelayQuery';
import type { Geocache } from '@/types/geocache';

/**
 * Look up geocaches by their `d` tag across the primary relay (with multi-relay
 * fallback when nothing is found). Because a `d` tag is only unique within a
 * single author, multiple authors can publish addressable events with the same
 * `d` value — this hook returns ALL matches.
 *
 * Used by the `/d/:dTag` route to resolve short-form treasure URLs.
 */
export function useGeocachesByDTag(dTag: string | undefined) {
  const { nostr } = useNostr();
  const { queryMultipleRelays } = useMultiRelayQuery();

  return useQuery<Geocache[]>({
    queryKey: ['geocaches-by-dtag', dTag],
    enabled: !!dTag,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    retry: false,
    networkMode: 'always',
    queryFn: async (c) => {
      if (!dTag) return [];

      const filters = [{
        kinds: [NIP_GC_KINDS.GEOCACHE, NIP_GC_KINDS.GEOCACHE_LEGACY],
        '#d': [dTag],
        limit: 50,
      }];

      // Primary relay first
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(TIMEOUTS.QUERY)]);
      let events = await nostr.query(filters, { signal });

      // If nothing on primary relay, fall back to other preset relays
      if (events.length === 0) {
        const { events: fallbackEvents } = await queryMultipleRelays(filters);
        events = fallbackEvents;
      }

      // Parse and dedupe by author pubkey: addressable events are uniquely
      // identified by (kind, pubkey, dTag) — keep only the latest per author.
      const latestByAuthor = new Map<string, typeof events[number]>();
      for (const event of events) {
        const key = `${event.kind}:${event.pubkey}`;
        const existing = latestByAuthor.get(key);
        if (!existing || event.created_at > existing.created_at) {
          latestByAuthor.set(key, event);
        }
      }

      const geocaches: Geocache[] = [];
      for (const event of latestByAuthor.values()) {
        const parsed = parseGeocacheEvent(event);
        if (parsed) geocaches.push(parsed);
      }

      // Newest first
      geocaches.sort((a, b) => b.created_at - a.created_at);
      return geocaches;
    },
  });
}
