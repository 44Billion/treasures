import { useQuery } from '@tanstack/react-query';
import { useGeocacheStoreContext } from '@/shared/stores/hooks';
import { useIsWotEnabled } from '@/shared/utils/wot';
import { useWotStore } from '@/shared/stores/useWotStore';
import { useNostr } from '@nostrify/react';
import { nip19, nip57 } from 'nostr-tools';
import { TIMEOUTS, QUERY_LIMITS } from '@/lib/constants';
import { useZapStore } from '@/shared/stores/useZapStore';
import { NIP_GC_KINDS } from '@/features/geocache/utils/nip-gc';
import { useMemo } from 'react';
import { batchedQuery } from '@/shared/utils/batchQuery';

export interface GeocacheWithStats {
  foundCount: number;
  logCount: number;
  zapTotal: number;
}

export function useGeocaches() {
  const geocacheStore = useGeocacheStoreContext();
  const isWotEnabled = useIsWotEnabled();
  const { wotPubkeys } = useWotStore();
  const { nostr } = useNostr();
  const { setZaps } = useZapStore();

  // Step 1: Fetch geocaches first
  const geocachesQuery = useQuery({
    queryKey: ['geocaches', isWotEnabled, Array.from(wotPubkeys).sort().join(',')],
    queryFn: async () => {
      console.log('🚀 Fetching geocaches...');
      const result = await geocacheStore.fetchGeocaches();
      
      if (!result.success) {
        throw result.error;
      }
      
      console.log('✅ Geocaches fetched:', result.data?.length || 0);
      return result.data || [];
    },
    staleTime: 600000, // 10 minutes - longer stale time for better cache consistency
    gcTime: 1800000, // 30 minutes
    refetchInterval: false,
  });

  // Step 2: Fetch stats for all geocaches (depends on geocaches being loaded)
  const statsQuery = useQuery({
    queryKey: ['geocache-stats', geocachesQuery.data?.map(g => `${g.pubkey}:${g.dTag}`).join(','), isWotEnabled, Array.from(wotPubkeys).sort().join(',')],
    queryFn: async (c) => {
      const geocaches = geocachesQuery.data;
      
      if (!geocaches || geocaches.length === 0) {
        return new Map<string, GeocacheWithStats>();
      }

      console.log('📊 Fetching stats for', geocaches.length, 'geocaches...');
      
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(TIMEOUTS.STATS_QUERY)]);
      
      try {
        // Build optimized filters for all geocaches
        const coordinates = geocaches.map(geocache => 
          `${geocache.kind || NIP_GC_KINDS.GEOCACHE}:${geocache.pubkey}:${geocache.dTag}`
        );
        
        // Create consolidated filters instead of individual ones
        const logsLimit = Math.min(QUERY_LIMITS.LOGS * geocaches.length, 1000); // Cap at 1000 to avoid excessive limits
        const allFilters: any[] = [
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

        console.log('📡 Querying with optimized filters:', {
          filterCount: allFilters.length,
          totalCoordinates: coordinates.length,
          estimatedEventsLimit: allFilters.reduce((sum, filter) => sum + (filter.limit || 0), 0)
        });
        
        // Execute queries with larger batch size since we have fewer filters
        console.log('🚀 Starting batched query for stats...');
        const queryStartTime = Date.now();
        
        let allEvents: any[] = [];
        
        try {
          allEvents = await batchedQuery(nostr, allFilters, 3, signal);
          const queryDuration = Date.now() - queryStartTime;
          
          console.log('✅ Batched query completed successfully:', {
            duration: `${queryDuration}ms`,
            eventsReceived: allEvents.length,
            filtersUsed: allFilters.length
          });
          
          // Continue processing events instead of returning them directly
        } catch (queryError) {
          const queryDuration = Date.now() - queryStartTime;
          console.error('❌ Batched query failed:', {
            duration: `${queryDuration}ms`,
            error: queryError,
            filtersUsed: allFilters.length,
            coordinates: coordinates.length
          });
          throw queryError;
        }
        
        // Make sure allEvents is defined before proceeding
        if (!allEvents) {
          console.warn('❌ No events returned from batched query');
          return new Map<string, GeocacheWithStats>();
        }
        
        console.log('✅ Stats fetched:', {
          totalEvents: allEvents.length,
          zapEvents: allEvents.filter(e => e.kind === 9735).length,
          logEvents: allEvents.filter(e => e.kind === NIP_GC_KINDS.FOUND_LOG || e.kind === NIP_GC_KINDS.COMMENT_LOG).length
        });

        // Process all events and build stats map
        const statsMap = new Map<string, GeocacheWithStats>();
        
        // Initialize all geocaches with zero stats
        geocaches.forEach(geocache => {
          const key = `${geocache.pubkey}:${geocache.dTag}`;
          statsMap.set(key, { foundCount: 0, logCount: 0, zapTotal: 0 });
        });

        // Process logs and count by geocache
        const logCounts = new Map<string, { foundCount: Set<string>; logCount: number }>();
        
        geocaches.forEach(geocache => {
          const key = `${geocache.pubkey}:${geocache.dTag}`;
          logCounts.set(key, { foundCount: new Set(), logCount: 0 });
        });

        // Process zap events by target
        const zapEventsByTarget = new Map<string, any[]>();

        // Separate and process events
        allEvents.forEach(event => {
          // Handle log events
          if (event.kind === NIP_GC_KINDS.FOUND_LOG || event.kind === NIP_GC_KINDS.COMMENT_LOG) {
            const aTag = event.tags.find((t: string[]) => t[0] === 'a')?.[1];
            if (!aTag) return;

            const [kind, pubkey, dTag] = aTag.split(':');
            if ((kind !== NIP_GC_KINDS.GEOCACHE.toString() && kind !== NIP_GC_KINDS.GEOCACHE_LEGACY.toString()) || !pubkey || !dTag) return;

            const key = `${pubkey}:${dTag}`;
            const counts = logCounts.get(key);
            if (!counts) return;

            counts.logCount++;
            
            // Count found logs (unique by pubkey)
            if (event.kind === NIP_GC_KINDS.FOUND_LOG) {
              counts.foundCount.add(event.pubkey);
            }
          }

          // Handle zap events
          if (event.kind === 9735) {
            // Check for 'a' tag (naddr zaps)
            const aTag = event.tags.find((t: string[]) => t[0] === 'a')?.[1];
            if (aTag) {
              try {
                const [kind, pubkey, identifier] = aTag.split(':');
                const naddr = nip19.naddrEncode({
                  kind: parseInt(kind),
                  pubkey,
                  identifier,
                });
                const key = `naddr:${naddr}`;
                if (!zapEventsByTarget.has(key)) {
                  zapEventsByTarget.set(key, []);
                }
                zapEventsByTarget.get(key)!.push(event);
              } catch (e) {
                console.error("Failed to encode naddr from a-tag:", aTag, e);
              }
            }

            // Check for 'e' tag (event id zaps)
            const eTag = event.tags.find((t: string[]) => t[0] === 'e')?.[1];
            if (eTag) {
              const key = `event:${eTag}`;
              if (!zapEventsByTarget.has(key)) {
                zapEventsByTarget.set(key, []);
              }
              zapEventsByTarget.get(key)!.push(event);
            }
          }
        });

        // Apply WoT filtering if enabled and update stats map
        logCounts.forEach((counts, key) => {
          let foundCount = counts.foundCount.size;
          let logCount = counts.logCount;

          if (isWotEnabled && wotPubkeys.size > 0) {
            // Filter logs by WoT pubkeys
            const wotFoundLogs = new Set<string>();
            let wotTotalLogs = 0;

            allEvents.forEach(event => {
              if (event.kind !== NIP_GC_KINDS.FOUND_LOG && event.kind !== NIP_GC_KINDS.COMMENT_LOG) return;
              
              const aTag = event.tags.find((t: string[]) => t[0] === 'a')?.[1];
              if (!aTag) return;

              const [kind, pubkey, dTag] = aTag.split(':');
              if ((kind !== NIP_GC_KINDS.GEOCACHE.toString() && kind !== NIP_GC_KINDS.GEOCACHE_LEGACY.toString()) || !pubkey || !dTag) return;
              if (`${pubkey}:${dTag}` !== key) return;

              if (wotPubkeys.has(event.pubkey)) {
                wotTotalLogs++;
                if (event.kind === NIP_GC_KINDS.FOUND_LOG) {
                  wotFoundLogs.add(event.pubkey);
                }
              }
            });

            foundCount = wotFoundLogs.size;
            logCount = wotTotalLogs;
          }

          // Update stats map with log counts
          const currentStats = statsMap.get(key) || { foundCount: 0, logCount: 0, zapTotal: 0 };
          statsMap.set(key, {
            ...currentStats,
            foundCount,
            logCount,
          });
        });

        // Process zap totals and update stats map
        zapEventsByTarget.forEach((events, targetKey) => {
          // Try to find the corresponding geocache using multiple strategies
          let geocache = null;
          let zapStoreKey = targetKey;
          
          // Strategy 1: Try exact match with naddr/event key
          geocache = geocaches.find(g => {
            const geocacheKey = g.naddr ? `naddr:${g.naddr}` : `event:${g.id}`;
            return geocacheKey === targetKey;
          });
          
          // Strategy 2: If targetKey is naddr format, try to parse it and match by pubkey/dTag
          if (!geocache && targetKey.startsWith('naddr:')) {
            try {
              const naddrPart = targetKey.substring(6); // Remove 'naddr:' prefix
              const decoded = nip19.decode(naddrPart);
              if (decoded.type === 'naddr') {
                const { kind, pubkey, identifier } = decoded.data;
                geocache = geocaches.find(g => 
                  g.pubkey === pubkey && 
                  g.dTag === identifier && 
                  (g.kind || NIP_GC_KINDS.GEOCACHE) === kind
                );
                
                // If found, update the zapStoreKey to use the geocache's actual naddr
                if (geocache && geocache.naddr) {
                  zapStoreKey = `naddr:${geocache.naddr}`;
                }
              }
            } catch (e) {
              console.warn('Failed to parse naddr from zap target key:', targetKey, e);
            }
          }
          
          // Strategy 3: If targetKey is event format, try to match by event ID
          if (!geocache && targetKey.startsWith('event:')) {
            const eventId = targetKey.substring(7); // Remove 'event:' prefix
            geocache = geocaches.find(g => g.id === eventId);
          }
          
          if (geocache) {
            const statsKey = `${geocache.pubkey}:${geocache.dTag}`;
            const zapTotal = events.reduce((total, event) => {
              return total + getZapAmount(event);
            }, 0);

            // Update stats map with zap totals
            const currentStats = statsMap.get(statsKey) || { foundCount: 0, logCount: 0, zapTotal: 0 };
            statsMap.set(statsKey, {
              ...currentStats,
              zapTotal,
            });

            // Update zap store with the corrected key
            setZaps(zapStoreKey, events);
          }
        });

        console.log('✅ Stats processing completed for', statsMap.size, 'geocaches');
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
  };
}

// Helper function to extract zap amount from event
function getZapAmount(event: any): number {
  const bolt11 = event.tags.find((t: any[]) => t[0] === 'bolt11')?.[1];
  if (bolt11) {
    try {
      return nip57.getSatoshisAmountFromBolt11(bolt11);
    } catch (e) {
      console.error("Invalid bolt11 invoice", bolt11, e);
      return 0;
    }
  }
  return 0;
}

/**
 * Hook for getting geocaches near a specific location
 */
export function useNearbyGeocaches(lat?: number, lon?: number, radiusKm = 50) {
  const geocacheStore = useGeocacheStoreContext();
  const isWotEnabled = useIsWotEnabled();
  const { wotPubkeys } = useWotStore();

  return useQuery({
    queryKey: ['nearby-geocaches', lat, lon, radiusKm, isWotEnabled, Array.from(wotPubkeys).sort().join(',')],
    queryFn: async () => {
      if (!lat || !lon) return [];

      const result = await geocacheStore.fetchNearbyGeocaches(lat, lon, radiusKm);
      if (!result.success) {
        throw result.error;
      }
      
      let geocaches = result.data || [];
      
      // Apply WoT filtering if enabled
      if (isWotEnabled && wotPubkeys.size > 0) {
        geocaches = geocaches.filter(geocache => wotPubkeys.has(geocache.pubkey));
      }
      
      return geocaches;
    },
    enabled: lat !== undefined && lon !== undefined,
    staleTime: 120000, // 2 minutes for location-based data
  });
}