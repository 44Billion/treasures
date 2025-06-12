import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';
import type { Geocache } from '@/types/geocache';
import { TIMEOUTS, QUERY_LIMITS } from '@/shared/config';
import { useOfflineMode } from '@/features/offline/hooks/useOfflineStorage';
import { useCacheInvalidation } from '@/hooks/useCacheInvalidation';
import { offlineStorage, type CachedGeocache } from '@/features/offline/utils/offlineStorage';
import { 
  NIP_GC_KINDS, 
  parseGeocacheEvent, 
  parseLogEvent, 
  createGeocacheCoordinate 
} from '@/features/geocache/utils/nip-gc';

export function useGeocache(id: string) {
  const { nostr } = useNostr();
  const { isOnline, isConnected, connectionQuality } = useOfflineMode();
  
  // Enable cache invalidation monitoring
  useCacheInvalidation();

  // Query for the geocache by ID
  return useQuery({
    queryKey: ['geocache', id, isOnline && isConnected && navigator.onLine],
    queryFn: async (c) => {
      if (!id) return null;

      // Try offline first
      let offlineGeocache: Geocache | null = null;
      try {
        await offlineStorage.init();
        const cached = await offlineStorage.getGeocache(id);
        if (cached) {
          const parsed = parseGeocacheEvent(cached.event);
          if (parsed) {
            offlineGeocache = {
              ...parsed,
              foundCount: 0,
              logCount: 0,
            };
          }
        }
      } catch (error) {
        console.warn('Failed to get offline geocache:', error);
      }

      // If offline, return offline data
      if (!navigator.onLine || !isOnline || !isConnected) {
        return offlineGeocache;
      }

      try {
        const signal = AbortSignal.any([c.signal, AbortSignal.timeout(TIMEOUTS.QUERY)]);
        const events = await nostr.query([{
          ids: [id],
          kinds: [NIP_GC_KINDS.GEOCACHE],
          limit: 1,
        }], { signal });

        if (events.length === 0) {
          return offlineGeocache;
        }

        const geocache = parseGeocacheEvent(events[0]);
        if (!geocache) {
          return offlineGeocache;
        }

        // Cache offline
        try {
          const cachedGeocache: CachedGeocache = {
            id: geocache.id,
            event: events[0],
            lastUpdated: Date.now(),
            lastValidated: Date.now(),
            coordinates: geocache.location ? [geocache.location.lat, geocache.location.lng] as [number, number] : undefined,
            difficulty: geocache.difficulty,
            terrain: geocache.terrain,
            type: geocache.type,
          };
          await offlineStorage.storeGeocache(cachedGeocache);
        } catch (error) {
          console.warn('Failed to cache geocache offline:', error);
        }

        // Get log counts
        try {
          const logSignal = AbortSignal.timeout(TIMEOUTS.FAST_QUERY);
          const [foundEvents, commentEvents] = await Promise.all([
            nostr.query([{
              kinds: [NIP_GC_KINDS.FOUND_LOG],
              '#a': [createGeocacheCoordinate(geocache.pubkey, geocache.dTag)],
              limit: QUERY_LIMITS.LOGS / 2,
            }], { signal: logSignal }),
            nostr.query([{
              kinds: [NIP_GC_KINDS.COMMENT_LOG],
              '#a': [createGeocacheCoordinate(geocache.pubkey, geocache.dTag)],
              '#A': [createGeocacheCoordinate(geocache.pubkey, geocache.dTag)],
              limit: QUERY_LIMITS.LOGS / 2,
            }], { signal: logSignal })
          ]);

          const logEvents = [...foundEvents, ...commentEvents];
          let foundCount = 0;
          
          logEvents.forEach(event => {
            const log = parseLogEvent(event);
            if (log && log.type === 'found') {
              foundCount++;
            }
          });

          return {
            ...geocache,
            foundCount,
            logCount: logEvents.length,
          };
        } catch (error) {
          // Return geocache without log counts if log query fails
          return {
            ...geocache,
            foundCount: 0,
            logCount: 0,
          };
        }
      } catch (error) {
        console.warn('Online geocache query failed, using offline data:', error);
        return offlineGeocache;
      }
    },
    enabled: !!id,
    staleTime: (isOnline && isConnected && navigator.onLine) ? 30000 : Infinity,
    gcTime: 300000,
    retry: false,
    refetchOnReconnect: true,
    networkMode: 'always',
  });
}
