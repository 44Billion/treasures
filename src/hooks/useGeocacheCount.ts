import { useQuery } from '@tanstack/react-query';
import { useAppContext } from '@/hooks/useAppContext';
import { getEffectiveRelays } from '@/lib/appRelays';
import { NIP_GC_KINDS } from '@/utils/nip-gc';
import { TIMEOUTS } from '@/config';
import type { NostrFilter } from '@nostrify/nostrify';

/** Result of an accurate treasure count query. */
export interface GeocacheCountResult {
  /** Best estimate of the number of distinct matching treasures. */
  count: number;
  /** True when at least one relay returned a probabilistic/approximate count. */
  approximate: boolean;
  /** True when no relay supported NIP-45 COUNT (caller may fall back). */
  unsupported: boolean;
}

/**
 * Query relays for an accurate count of treasure (kind 37516) events using
 * NIP-45 `COUNT`. The shared `NPool` (`useNostr`) does not expose `count`, so we
 * open the user's effective read relays directly via `NRelay1` and ask each one.
 *
 * Because the same events live on multiple relays, counts overlap heavily.
 * Summing would massively over-count, so we take the **maximum** count across
 * relays as the best single-value estimate of the number of distinct treasures.
 *
 * If no relay supports COUNT, `unsupported` is true and `count` is 0 so callers
 * can fall back to the number of loaded treasures.
 *
 * @param filter Optional extra filter fields merged into the base
 *   `{ kinds: [37516] }` filter (e.g. `{ '#g': [...] }` for a viewport count).
 */
export function useGeocacheCount(filter?: NostrFilter) {
  const { config } = useAppContext();

  // Stable, normalized read-relay list for the query key.
  const readRelays = getEffectiveRelays(config.relayMetadata, config.useAppRelays, config.useUserRelays)
    .relays.filter((r) => r.read)
    .map((r) => r.url);

  return useQuery<GeocacheCountResult>({
    queryKey: ['geocache-count', readRelays, filter ?? null],
    queryFn: async ({ signal: querySignal }) => {
      const { NRelay1 } = await import('@nostrify/nostrify');

      const countFilter: NostrFilter = {
        kinds: [NIP_GC_KINDS.GEOCACHE],
        ...filter,
      };

      const results = await Promise.allSettled(
        readRelays.map(async (url) => {
          const relay = new NRelay1(url);
          try {
            const signal = AbortSignal.any([
              querySignal,
              AbortSignal.timeout(TIMEOUTS.QUERY),
            ]);
            const res = await relay.count([countFilter], { signal });
            return res;
          } finally {
            relay.close();
          }
        }),
      );

      let max = 0;
      let approximate = false;
      let anySupported = false;

      for (const r of results) {
        if (r.status !== 'fulfilled') continue;
        anySupported = true;
        if (typeof r.value.count === 'number' && r.value.count > max) {
          max = r.value.count;
        }
        if (r.value.approximate) approximate = true;
      }

      return {
        count: max,
        approximate,
        unsupported: !anySupported,
      };
    },
    // Counts change slowly; keep them cached to avoid hammering relays.
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    retry: 1,
  });
}
