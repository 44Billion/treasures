import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { NIP_GC_KINDS, parseLogEvent } from '@/utils/nip-gc';
import { verifyEmbeddedVerification, getEmbeddedVerification } from '@/utils/verification';
import { getFtfStatus, hasModifier, type FtfStatus } from '@/utils/modifiers';
import { TIMEOUTS, QUERY_LIMITS } from '@/config';
import type { Geocache, GeocacheLog } from '@/types/geocache';

/**
 * Resolve FTF claim status for every first-to-find treasure in an adventure.
 *
 * Unlike `useAdventureProgress` (which tracks the *current user's* found
 * logs), this hook computes the GLOBAL claim state of each FTF treasure:
 * once any verified found log exists for an FTF treasure, every viewer of
 * the adventure sees it as claimed.
 *
 * Returns a `Map<cacheKey, FtfStatus>` keyed by `"${kind}:${pubkey}:${dTag}"`
 * — only FTF treasures are included; non-FTF caches are absent from the map.
 * Use the convenience `isFtfClaimed(cache)` helper to check claimed state at
 * a call site.
 *
 * Implementation notes:
 *  - Queries kind-7516 found logs filtered by the adventure's FTF treasure
 *    coordinates (both new and legacy kinds) in a single batched query.
 *  - Each log is verified against its target cache's `verificationPubkey`
 *    using the same embedded-verification path as `useGeocacheLogs`.
 *  - Logs that lack an embedded verification, or whose verification fails,
 *    are excluded — so FTF "claimed" requires a cryptographically verified
 *    found log, matching the NIP-GC claim semantics in `getFtfWinner`.
 */
export function useAdventureFtfStatus(geocaches: Geocache[]) {
  const { nostr } = useNostr();

  // Limit verification work to FTF treasures only. Non-FTF caches are
  // skipped entirely — there's no reason to fetch their logs here.
  const ftfCaches = useMemo(
    () => geocaches.filter((g) => hasModifier(g, 'first-to-find')),
    [geocaches],
  );

  // Build the coordinate list — include both new (37516) and legacy (37515)
  // forms because a found log targeting a treasure published under the
  // legacy kind will use the legacy coordinate.
  const ftfCoordinates = useMemo(() => {
    const coords: string[] = [];
    for (const cache of ftfCaches) {
      const kind = cache.kind || NIP_GC_KINDS.GEOCACHE;
      coords.push(`${kind}:${cache.pubkey}:${cache.dTag}`);
      // Always include the alternate coordinate so we catch found logs that
      // referenced whichever kind happened to be canonical at the time.
      const altKind =
        kind === NIP_GC_KINDS.GEOCACHE
          ? NIP_GC_KINDS.GEOCACHE_LEGACY
          : NIP_GC_KINDS.GEOCACHE;
      coords.push(`${altKind}:${cache.pubkey}:${cache.dTag}`);
    }
    return coords;
  }, [ftfCaches]);

  // Build a lookup so we can find the originating cache (and its
  // verification pubkey) for any coordinate, including the alternate-kind
  // form. The key is `pubkey:dTag` — kind-agnostic on purpose.
  const cacheByPubkeyDtag = useMemo(() => {
    const m = new Map<string, Geocache>();
    for (const cache of ftfCaches) {
      m.set(`${cache.pubkey}:${cache.dTag}`, cache);
    }
    return m;
  }, [ftfCaches]);

  const queryKey = useMemo(
    () => ['adventure-ftf-status', ftfCoordinates.sort().join(',')],
    [ftfCoordinates],
  );

  const { data: logsByCacheKey } = useQuery({
    queryKey,
    queryFn: async (c) => {
      if (ftfCoordinates.length === 0) return new Map<string, GeocacheLog[]>();

      const signal = AbortSignal.any([
        c.signal,
        AbortSignal.timeout(TIMEOUTS.QUERY),
      ]);

      const events = await nostr.query(
        [
          {
            kinds: [NIP_GC_KINDS.FOUND_LOG],
            '#a': ftfCoordinates,
            limit: QUERY_LIMITS.LOGS,
          },
        ],
        { signal },
      );

      // Group raw events by the canonical cache key
      // (`${cache.kind}:${cache.pubkey}:${cache.dTag}`), verify each, and
      // populate the resulting log map.
      const grouped = new Map<string, { event: typeof events[number]; log: GeocacheLog }[]>();
      for (const event of events) {
        const aTag = event.tags.find((t) => t[0] === 'a')?.[1];
        if (!aTag) continue;
        const [, pubkey, dTag] = aTag.split(':');
        if (!pubkey || !dTag) continue;

        const cache = cacheByPubkeyDtag.get(`${pubkey}:${dTag}`);
        if (!cache) continue;

        const parsed = parseLogEvent(event);
        if (!parsed || parsed.type !== 'found') continue;

        const canonicalKey = `${cache.kind || NIP_GC_KINDS.GEOCACHE}:${cache.pubkey}:${cache.dTag}`;
        const bucket = grouped.get(canonicalKey) ?? [];
        bucket.push({ event, log: parsed });
        grouped.set(canonicalKey, bucket);
      }

      // Verify each log against its cache's verification pubkey. A cache
      // without `verificationPubkey` cannot have verified founds, so its
      // logs are dropped (no provisional FTF claim without verification).
      const result = new Map<string, GeocacheLog[]>();
      for (const [canonicalKey, items] of grouped) {
        const [kindStr, pubkey, dTag] = canonicalKey.split(':');
        // `kindStr` is intentionally unused below — keeping the destructure
        // self-documenting. The canonical key already encodes it.
        void kindStr;
        const cache = cacheByPubkeyDtag.get(`${pubkey}:${dTag}`);
        if (!cache?.verificationPubkey) continue;

        const verified: GeocacheLog[] = [];
        await Promise.all(
          items.map(async ({ event, log }) => {
            const embedded = getEmbeddedVerification(event);
            if (!embedded) {
              log.isVerified = false;
              return;
            }
            try {
              log.isVerified = await verifyEmbeddedVerification(
                event,
                cache.verificationPubkey!,
              );
            } catch {
              log.isVerified = false;
            }
            if (log.isVerified) verified.push(log);
          }),
        );

        if (verified.length > 0) {
          result.set(canonicalKey, verified);
        }
      }

      return result;
    },
    enabled: ftfCoordinates.length > 0,
    staleTime: 60000,
    gcTime: 300000,
  });

  // Compute per-cache FtfStatus. We include an entry for every FTF cache —
  // even ones with no verified logs — so the UI can distinguish "FTF but
  // unclaimed" from "not an FTF treasure".
  const statusMap = useMemo(() => {
    const m = new Map<string, FtfStatus>();
    for (const cache of ftfCaches) {
      const canonicalKey = `${cache.kind || NIP_GC_KINDS.GEOCACHE}:${cache.pubkey}:${cache.dTag}`;
      const logs = logsByCacheKey?.get(canonicalKey) ?? [];
      m.set(canonicalKey, getFtfStatus(cache, logs));
    }
    return m;
  }, [ftfCaches, logsByCacheKey]);

  /** Returns true iff the given cache is FTF AND has been claimed (or locked). */
  const isFtfClaimed = useMemo(() => {
    return (cache: Pick<Geocache, 'kind' | 'pubkey' | 'dTag'>): boolean => {
      const key = `${cache.kind || NIP_GC_KINDS.GEOCACHE}:${cache.pubkey}:${cache.dTag}`;
      const status = statusMap.get(key);
      return status?.kind === 'claimed' || status?.kind === 'locked';
    };
  }, [statusMap]);

  return {
    statusMap,
    isFtfClaimed,
  };
}
