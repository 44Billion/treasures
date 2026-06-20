import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { parseGeocacheEvent } from '@/utils/nip-gc';
import { NIP_GC_KINDS } from '@/utils/nip-gc';
import { TIMEOUTS, QUERY_LIMITS } from '@/config';
import { APP_RELAYS } from '@/lib/appRelays';
import type { NostrEvent } from '@nostrify/nostrify';
import type { Geocache } from '@/types/geocache';

/** Normalize a relay URL for deduplication (lowercase, strip trailing slash). */
function normalizeRelayUrl(url: string): string {
  return url.toLowerCase().replace(/\/+$/, '');
}

/**
 * Parse the `r` tags of a NIP-65 (kind 10002) relay-list event into the URLs
 * the author publishes to (i.e. their "write" relays). An `r` tag with no
 * marker means both read and write; the `write` marker means write-only.
 */
function parseWriteRelays(event: NostrEvent): string[] {
  return event.tags
    .filter(([name]) => name === 'r')
    .filter(([, , marker]) => !marker || marker === 'write')
    .map(([, url]) => (url || '').replace(/\/+$/, ''))
    .filter(Boolean);
}

/**
 * Discovers geocaches an author has published to their own NIP-65 relays that
 * may not be present on the app's default / the viewer's relays.
 *
 * Flow:
 *  1. Fetch the author's kind-10002 relay list (via the viewer's pool — relay
 *     lists are widely propagated, so this is reliable).
 *  2. Query each of the author's *write* relays directly (fresh `NRelay1`
 *     connections), excluding relays already covered by the app defaults.
 *  3. Aggregate results across all relays and dedupe by the addressable
 *     coordinate (`kind:pubkey:dTag`), keeping the newest version of each cache.
 *
 * This complements `useUserGeocaches` (which only sees the viewer's effective
 * relays); merge the two in the consumer and dedupe again by coordinate.
 */
export function useUserRelayGeocaches(targetPubkey?: string, isOwnProfile = false) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['user-relay-geocaches', targetPubkey, isOwnProfile],
    enabled: !!targetPubkey,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000,
    retry: false,
    refetchOnWindowFocus: false,
    queryFn: async ({ signal }) => {
      if (!targetPubkey) return [] as Geocache[];

      // 1. Fetch the author's NIP-65 relay list.
      const relayListEvents = await nostr.query(
        [{ kinds: [10002], authors: [targetPubkey], limit: 1 }],
        { signal: AbortSignal.any([signal, AbortSignal.timeout(TIMEOUTS.QUERY)]) },
      );

      const relayListEvent = relayListEvents[0];
      if (!relayListEvent) return [] as Geocache[];

      // 2. Build the set of the author's write relays, excluding the app's
      //    default relays (already covered by `useUserGeocaches`).
      const appRelaySet = new Set(APP_RELAYS.relays.map((r) => normalizeRelayUrl(r.url)));
      const seen = new Set<string>();
      const relayUrls: string[] = [];
      for (const url of parseWriteRelays(relayListEvent)) {
        const norm = normalizeRelayUrl(url);
        if (appRelaySet.has(norm) || seen.has(norm)) continue;
        seen.add(norm);
        relayUrls.push(url);
      }

      if (relayUrls.length === 0) return [] as Geocache[];

      const filters = [
        {
          kinds: [NIP_GC_KINDS.GEOCACHE],
          authors: [targetPubkey],
          limit: QUERY_LIMITS.GEOCACHES,
        },
      ];

      // 3. Query every author relay directly and aggregate results. We connect
      //    to each relay independently so a single slow/dead relay can't block
      //    the others, and we tolerate per-relay failures silently.
      const { NRelay1 } = await import('@nostrify/nostrify');

      const perRelay = await Promise.all(
        relayUrls.map(async (relayUrl) => {
          const relay = new NRelay1(relayUrl);
          try {
            const relaySignal = AbortSignal.timeout(TIMEOUTS.QUERY);
            return await relay.query(filters, { signal: relaySignal });
          } catch {
            return [] as NostrEvent[];
          } finally {
            relay.close();
          }
        }),
      );

      const events = perRelay.flat();
      if (events.length === 0) return [] as Geocache[];

      // Dedupe by addressable coordinate (kind:pubkey:dTag) — geocaches are
      // replaceable, so the event id changes between versions; keep the newest.
      const byAddr = new Map<string, Geocache>();
      for (const event of events) {
        const geocache = parseGeocacheEvent(event);
        if (!geocache) continue;
        // Hidden caches are only visible to their creator on their own profile.
        if (geocache.hidden && !isOwnProfile) continue;
        const key = `${geocache.kind}:${geocache.pubkey}:${geocache.dTag}`;
        const existing = byAddr.get(key);
        if (!existing || geocache.created_at >= existing.created_at) {
          byAddr.set(key, geocache);
        }
      }

      return Array.from(byAddr.values()).sort((a, b) => b.created_at - a.created_at);
    },
  });
}
