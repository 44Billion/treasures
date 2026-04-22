import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { nip19 } from 'nostr-tools';
import { TIMEOUTS } from '@/config';
import { NIP_GC_KINDS, parseAdventureEvent, parseGeocacheEvent } from '@/utils/nip-gc';
import type { Adventure } from '@/types/adventure';
import type { Geocache } from '@/types/geocache';

/**
 * Decode an adventure naddr into its components.
 * Returns null if the naddr is invalid or not a kind 37517 curation list.
 */
function parseAdventureNaddr(naddr: string): { pubkey: string; identifier: string; relays?: string[] } | null {
  try {
    const decoded = nip19.decode(naddr);
    if (decoded.type !== 'naddr') return null;
    if (decoded.data.kind !== NIP_GC_KINDS.ADVENTURE) return null;
    return {
      pubkey: decoded.data.pubkey,
      identifier: decoded.data.identifier,
      relays: decoded.data.relays,
    };
  } catch {
    return null;
  }
}

/**
 * Fetch a single adventure by naddr, resolving all referenced geocaches.
 */
export function useAdventure(naddr: string) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['adventure', naddr],
    queryFn: async (c): Promise<Adventure | null> => {
      const parsed = parseAdventureNaddr(naddr);
      if (!parsed) {
        throw new Error('Invalid adventure link');
      }

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(TIMEOUTS.QUERY)]);

      // Fetch the adventure list event
      const events = await nostr.query([{
        kinds: [NIP_GC_KINDS.ADVENTURE],
        authors: [parsed.pubkey],
        '#d': [parsed.identifier],
        limit: 1,
      }], { signal });

      if (events.length === 0) {
        return null;
      }

      const adventure = parseAdventureEvent(events[0]!);
      if (!adventure) {
        return null;
      }

      // Resolve geocache references into full geocache objects
      // Group refs by pubkey+kind for efficient batched queries
      const refsByFilter = new Map<string, { kind: number; pubkey: string; identifiers: string[] }>();

      for (const ref of adventure.geocacheRefs) {
        const [kindStr, pubkey, identifier] = ref.split(':');
        if (!kindStr || !pubkey || !identifier) continue;
        const kind = parseInt(kindStr);
        const key = `${kind}:${pubkey}`;
        const existing = refsByFilter.get(key);
        if (existing) {
          existing.identifiers.push(identifier);
        } else {
          refsByFilter.set(key, { kind, pubkey, identifiers: [identifier] });
        }
      }

      // Query for all referenced geocaches
      const geocacheSignal = AbortSignal.any([c.signal, AbortSignal.timeout(TIMEOUTS.QUERY)]);
      const filters = Array.from(refsByFilter.values()).map(({ kind, pubkey, identifiers }) => ({
        kinds: [kind],
        authors: [pubkey],
        '#d': identifiers,
      }));

      let geocacheEvents: typeof events = [];
      if (filters.length > 0) {
        geocacheEvents = await nostr.query(filters, { signal: geocacheSignal });
      }

      // Parse and map geocaches by their coordinate key
      const geocacheMap = new Map<string, Geocache>();
      for (const event of geocacheEvents) {
        const geocache = parseGeocacheEvent(event);
        if (geocache) {
          const key = `${event.kind}:${event.pubkey}:${event.tags.find(t => t[0] === 'd')?.[1]}`;
          geocacheMap.set(key, geocache);
        }
      }

      // Preserve the original order from the adventure's a tags
      const geocaches: Geocache[] = [];
      for (const ref of adventure.geocacheRefs) {
        const geocache = geocacheMap.get(ref);
        if (geocache) {
          geocaches.push(geocache);
        }
      }

      return {
        ...adventure,
        geocaches,
      };
    },
    enabled: !!naddr,
    staleTime: 300000, // 5 minutes
    gcTime: 600000, // 10 minutes
  });
}
