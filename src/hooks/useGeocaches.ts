import { useQuery } from '@tanstack/react-query';
import { useGeocacheStoreContext } from '@/stores/hooks';
import { useIsWotEnabled } from '@/utils/wot';
import { useWotStore } from '@/stores/useWotStore';
import { useNostr } from '@nostrify/react';
import { nip19, nip57 } from 'nostr-tools';
import { TIMEOUTS, QUERY_LIMITS } from '@/config';
import { useZapStore } from '@/stores/useZapStore';
import { NIP_GC_KINDS } from '@/utils/nip-gc';
import { useMemo } from 'react';
import { batchedQuery } from '@/utils/batchQuery';

interface GeocacheWithStats {
  foundCount: number;
  logCount: number;
  zapTotal: number;
}

export function useGeocaches() {
  const geocacheStore = useGeocacheStoreContext();
  const isWotEnabled = useIsWotEnabled();
  const { wotPubkeys, lastCalculated: wotLastCalculated } = useWotStore();
  const { nostr } = useNostr();
  const { setZaps } = useZapStore();

  // Step 1: Fetch geocaches first
  const geocachesQuery = useQuery({
    queryKey: ['geocaches', isWotEnabled, wotPubkeys.size, wotLastCalculated],
    queryFn: async () => {
      const result = await geocacheStore.fetchGeocaches();
      
      if (!result.success) {
        throw result.error;
      }
      
      return result.data || [];
    },
    staleTime: 600000, // 10 minutes - longer stale time for better cache consistency
    gcTime: 1800000, // 30 minutes
    refetchInterval: false,
  });

  // Step 2: Fetch stats for all geocaches (depends on geocaches being loaded)
  const statsQuery = useQuery({
    queryKey: ['geocache-stats', geocachesQuery.data?.length, geocachesQuery.dataUpdatedAt, isWotEnabled, wotPubkeys.size, wotLastCalculated],
    queryFn: async (c) => {
      const geocaches = geocachesQuery.data;
      
      if (!geocaches || geocaches.length === 0) {
        return new Map<string, GeocacheWithStats>();
      }

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(TIMEOUTS.STATS_QUERY)]);
      
      try {
        // Build optimized filters for all geocaches
        const coordinates = geocaches.map(geocache => 
          `${geocache.kind || NIP_GC_KINDS.GEOCACHE}:${geocache.pubkey}:${geocache.dTag}`
        );
        
        // Create consolidated filters instead of individual ones
        const logsLimit = Math.min(QUERY_LIMITS.LOGS * geocaches.length, 1000); // Cap at 1000 to avoid excessive limits
        const allFilters: Record<string, unknown>[] = [
          // Single filter for all found logs
          {
            kinds: [NIP_GC_KINDS.FOUND_LOG],
            '#a': coordinates,
            limit: logsLimit,
          },
          // Single filter for all comment logs  
          {
            kinds: [NIP_GC_KINDS.COMMENT_LOG],
            '#a': coordinates,
            limit: logsLimit,
          },
          // Single filter for all zaps
          {
            kinds: [9735],
            '#a': coordinates,
          },
        ];

        const allEvents = await batchedQuery(nostr, allFilters, 3, signal);
        
        // Make sure allEvents is defined before proceeding
        if (!allEvents) {
          return new Map<string, GeocacheWithStats>();
        }

        // Process all events and build stats map
        const statsMap = new Map<string, GeocacheWithStats>();
        
        // Initialize all geocaches with zero stats
        geocaches.forEach(geocache => {
          const key = `${geocache.pubkey}:${geocache.dTag}`;
          statsMap.set(key, { foundCount: 0, logCount: 0, zapTotal: 0 });
        });

        // Process logs and count by geocache
        // When WoT is enabled, pre-index events by geocache key to avoid O(N*M) nested loop
        const logCounts = new Map<string, { foundCount: Set<string>; logCount: number }>();
        const wotLogCounts = new Map<string, { foundCount: Set<string>; logCount: number }>();
        
        geocaches.forEach(geocache => {
          const key = `${geocache.pubkey}:${geocache.dTag}`;
          logCounts.set(key, { foundCount: new Set(), logCount: 0 });
          if (isWotEnabled && wotPubkeys.size > 0) {
            wotLogCounts.set(key, { foundCount: new Set(), logCount: 0 });
          }
        });

        // Process zap events by target
        const zapEventsByTarget = new Map<string, Record<string, unknown>[]>();

        // Single pass over all events — O(N) instead of O(N*M)
        allEvents.forEach((event: Record<string, unknown>) => {
          const kind = event.kind as number;
          const tags = event.tags as string[][];
          const eventPubkey = event.pubkey as string;

          // Handle log events
          if (kind === NIP_GC_KINDS.FOUND_LOG || kind === NIP_GC_KINDS.COMMENT_LOG) {
            const aTag = tags.find((t) => t[0] === 'a')?.[1];
            if (!aTag) return;

            const [tagKind, pubkey, dTag] = aTag.split(':');
            if ((tagKind !== NIP_GC_KINDS.GEOCACHE.toString() && tagKind !== NIP_GC_KINDS.GEOCACHE_LEGACY.toString()) || !pubkey || !dTag) return;

            const key = `${pubkey}:${dTag}`;

            // Standard counts
            const counts = logCounts.get(key);
            if (!counts) return;
            counts.logCount++;
            if (kind === NIP_GC_KINDS.FOUND_LOG) {
              counts.foundCount.add(eventPubkey);
            }

            // WoT-filtered counts (computed in the same pass, avoiding the O(N*M) re-scan)
            if (isWotEnabled && wotPubkeys.size > 0 && wotPubkeys.has(eventPubkey)) {
              const wotCounts = wotLogCounts.get(key);
              if (wotCounts) {
                wotCounts.logCount++;
                if (kind === NIP_GC_KINDS.FOUND_LOG) {
                  wotCounts.foundCount.add(eventPubkey);
                }
              }
            }
          }

          // Handle zap events
          if (kind === 9735) {
            // Check for 'a' tag (naddr zaps)
            const aTag = tags.find((t) => t[0] === 'a')?.[1];
            if (aTag) {
              try {
                const [zapKind, pubkey, identifier] = aTag.split(':');
                const naddr = nip19.naddrEncode({
                  kind: parseInt(zapKind),
                  pubkey,
                  identifier,
                });
                const key = `naddr:${naddr}`;
                if (!zapEventsByTarget.has(key)) {
                  zapEventsByTarget.set(key, []);
                }
                zapEventsByTarget.get(key)!.push(event);
              } catch {
                // Skip malformed a-tags
              }
            }

            // Check for 'e' tag (event id zaps)
            const eTag = tags.find((t) => t[0] === 'e')?.[1];
            if (eTag) {
              const key = `event:${eTag}`;
              if (!zapEventsByTarget.has(key)) {
                zapEventsByTarget.set(key, []);
              }
              zapEventsByTarget.get(key)!.push(event);
            }
          }
        });

        // Apply counts to stats map — use WoT counts when enabled
        const sourceCounts = (isWotEnabled && wotPubkeys.size > 0) ? wotLogCounts : logCounts;
        sourceCounts.forEach((counts, key) => {
          const currentStats = statsMap.get(key) || { foundCount: 0, logCount: 0, zapTotal: 0 };
          statsMap.set(key, {
            ...currentStats,
            foundCount: counts.foundCount.size,
            logCount: counts.logCount,
          });
        });

        // Process zap totals and update stats map
        // Build a lookup map for geocaches to avoid repeated .find() calls
        const geocacheByNaddr = new Map<string, typeof geocaches[number]>();
        const geocacheByEvent = new Map<string, typeof geocaches[number]>();
        const geocacheByCoord = new Map<string, typeof geocaches[number]>();
        geocaches.forEach(g => {
          if (g.naddr) geocacheByNaddr.set(`naddr:${g.naddr}`, g);
          if (g.id) geocacheByEvent.set(`event:${g.id}`, g);
          geocacheByCoord.set(`${g.kind || NIP_GC_KINDS.GEOCACHE}:${g.pubkey}:${g.dTag}`, g);
        });

        zapEventsByTarget.forEach((events, targetKey) => {
          let geocache = geocacheByNaddr.get(targetKey) || geocacheByEvent.get(targetKey);
          let zapStoreKey = targetKey;
          
          // Strategy 2: If targetKey is naddr format, try to parse it and match by pubkey/dTag
          if (!geocache && targetKey.startsWith('naddr:')) {
            try {
              const naddrPart = targetKey.substring(6);
              const decoded = nip19.decode(naddrPart);
              if (decoded.type === 'naddr') {
                const { kind, pubkey, identifier } = decoded.data;
                geocache = geocacheByCoord.get(`${kind}:${pubkey}:${identifier}`);
                if (geocache && geocache.naddr) {
                  zapStoreKey = `naddr:${geocache.naddr}`;
                }
              }
            } catch {
              // Skip malformed naddr
            }
          }
          
          if (geocache) {
            const statsKey = `${geocache.pubkey}:${geocache.dTag}`;
            const zapTotal = events.reduce((total, event) => {
              return total + getZapAmount(event);
            }, 0);

            const currentStats = statsMap.get(statsKey) || { foundCount: 0, logCount: 0, zapTotal: 0 };
            statsMap.set(statsKey, {
              ...currentStats,
              zapTotal,
            });

            setZaps(zapStoreKey, events);
          }
        });

        return statsMap;
      
    } catch (error) {
      console.warn('Failed to fetch geocache stats:', error);
      return new Map<string, GeocacheWithStats>();
    }
    },
    enabled: geocachesQuery.data !== undefined && geocachesQuery.data.length > 0, // Only run after geocaches are loaded
    staleTime: 120000, // 2 minutes - longer stale time to prevent unnecessary refetches
    gcTime: 600000, // 10 minutes cache retention
    refetchOnWindowFocus: false,
    refetchInterval: false,
  });

  // Apply WoT filtering to geocaches
  const filteredGeocaches = useMemo(() => {
    if (!geocachesQuery.data) {
      return [];
    }
    
    if (isWotEnabled && wotPubkeys.size > 0) {
      return geocachesQuery.data.filter(geocache => wotPubkeys.has(geocache.pubkey));
    }
    
    return geocachesQuery.data;
  }, [geocachesQuery.data, isWotEnabled, wotPubkeys]);

  // Combine geocaches with their stats
  const geocachesWithStats = useMemo(() => {
    if (!filteredGeocaches.length) {
      return filteredGeocaches;
    }

    // If no stats available yet, return geocaches with zero stats
    if (!statsQuery.data) {
      return filteredGeocaches.map(geocache => ({
        ...geocache,
        foundCount: 0,
        logCount: 0,
        zapTotal: 0,
      }));
    }

    // Combine with stats
    return filteredGeocaches.map(geocache => {
      const key = `${geocache.pubkey}:${geocache.dTag}`;
      const stats = statsQuery.data.get(key) || { foundCount: 0, logCount: 0, zapTotal: 0 };
      
      return {
        ...geocache,
        ...stats,
      };
    });
  }, [filteredGeocaches, statsQuery.data]);

  // Combine query states - stats loading is non-blocking
  const isLoading = geocachesQuery.isLoading;
  const isError = geocachesQuery.isError;
  const isSuccess = geocachesQuery.isSuccess;
  const error = geocachesQuery.error;
  
  // Stats loading state - true when stats are being fetched
  const isStatsLoading = statsQuery.isLoading && geocachesQuery.isSuccess;

  return {
    // Base query properties from geocaches query
    ...geocachesQuery,
    // Override state properties
    isLoading,
    isError,
    isSuccess,
    error,
    // Use the combined data
    data: geocachesWithStats,
    // Stats loading state
    isStatsLoading,
    // Pagination
    hasMore: geocacheStore.hasMore,
    loadMore: geocacheStore.loadMoreGeocaches,
  };
}

// Helper function to extract zap amount from event
function getZapAmount(event: Record<string, unknown>): number {
  const tags = event.tags as string[][];
  const bolt11 = tags.find((t) => t[0] === 'bolt11')?.[1];
  if (bolt11) {
    try {
      return nip57.getSatoshisAmountFromBolt11(bolt11);
    } catch {
      return 0;
    }
  }
  return 0;
}
