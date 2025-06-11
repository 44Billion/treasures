import { useNostr } from '@nostrify/react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { NostrEvent, NostrFilter } from '@nostrify/nostrify';
import type { Geocache } from '@/shared/types';
import { parseNaddr } from '@/lib/naddr-utils';
import { TIMEOUTS, QUERY_LIMITS } from '@/lib/constants';
import { useOfflineMode } from '@/hooks/useOfflineStorage';
import { offlineStorage, type CachedGeocache } from '@/lib/offlineStorage';
import { 
  NIP_GC_KINDS, 
  parseGeocacheEvent, 
  parseLogEvent,
  createGeocacheCoordinate 
} from '@/lib/nip-gc';

export function useGeocacheByNaddr(naddr: string) {
  const { nostr } = useNostr();
  const { isOnline, isConnected, connectionQuality } = useOfflineMode();
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: ['geocache-by-naddr', naddr],
    staleTime: (isOnline && isConnected && navigator.onLine) ? 30000 : Infinity, // 30 seconds online, never stale offline
    gcTime: 300000, // 5 minutes
    retry: (failureCount, error) => {
      // Don't retry if it's an invalid cache link
      if (error instanceof Error && error.message === 'INVALID_CACHE_LINK') {
        return false;
      }
      // Retry network errors up to 2 times when online
      return failureCount < 2 && (isOnline && isConnected && navigator.onLine);
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000), // Exponential backoff
    refetchOnReconnect: true, // Refetch when connection is restored
    networkMode: 'always', // Always run queries regardless of network status
    placeholderData: () => {
      // Try to find the geocache in existing cache first
      const parsed = parseNaddr(naddr);
      if (!parsed) return undefined;
      
      const { pubkey, dTag } = parsed;
      
      // Check main geocaches cache
      const geocachesData = queryClient.getQueryData(['geocaches']) as Geocache[] | undefined;
      if (geocachesData && Array.isArray(geocachesData)) {
        const cachedGeocache = geocachesData.find(cache => 
          cache.pubkey === pubkey && cache.dTag === dTag
        );
        
        if (cachedGeocache) {
          console.log('🚀 Using cached geocache data from main query:', cachedGeocache.name);
          return cachedGeocache;
        }
      }
      
      // Check other potential cache locations
      const fastGeocachesData = queryClient.getQueryData(['geocaches-fast']) as Geocache[] | undefined;
      if (fastGeocachesData && Array.isArray(fastGeocachesData)) {
        const cachedGeocache = fastGeocachesData.find(cache => 
          cache.pubkey === pubkey && cache.dTag === dTag
        );
        
        if (cachedGeocache) {
          console.log('🚀 Using cached geocache data from fast query:', cachedGeocache.name);
          return cachedGeocache;
        }
      }
      
      // Check proximity geocaches cache
      const proximityData = queryClient.getQueryData(['proximity-geocaches']) as Geocache[] | undefined;
      if (proximityData && Array.isArray(proximityData)) {
        const cachedGeocache = proximityData.find(cache => 
          cache.pubkey === pubkey && cache.dTag === dTag
        );
        
        if (cachedGeocache) {
          console.log('🚀 Using cached geocache data from proximity query:', cachedGeocache.name);
          return cachedGeocache;
        }
      }
      
      return undefined;
    },
    queryFn: async (c) => {
      console.log('useGeocacheByNaddr query starting...', {
        naddr,
        isOnline,
        isConnected,
        connectionQuality,
        navigatorOnline: navigator.onLine,
        timestamp: new Date().toISOString()
      });

      // Parse the naddr to get pubkey and dTag
      const parsed = parseNaddr(naddr);
      if (!parsed) {
        throw new Error('INVALID_CACHE_LINK');
      }
      
      const { pubkey, dTag, relays } = parsed;

      // Check if we have fresh data in cache first (avoid unnecessary network requests)
      const existingData = queryClient.getQueryData(['geocache-by-naddr', naddr]) as Geocache | undefined;
      if (existingData) {
        const cacheAge = Date.now() - (queryClient.getQueryState(['geocache-by-naddr', naddr])?.dataUpdatedAt || 0);
        // If data is less than 30 seconds old, use it
        if (cacheAge < 30000) {
          console.log('🚀 Using fresh cached data, skipping network request:', existingData.name);
          return existingData;
        }
      }

      // Always try to get offline data first as a fallback
      let offlineGeocache: Geocache | null = null;
      try {
        await offlineStorage.init();
        const cachedGeocaches = await offlineStorage.getAllGeocaches();
        const cached = cachedGeocaches.find(c => 
          c.event.pubkey === pubkey && 
          c.event.tags.find(t => t[0] === 'd')?.[1] === dTag
        );
        
        if (cached) {
          offlineGeocache = parseGeocacheEvent(cached.event);
          console.log('Found offline geocache:', offlineGeocache?.name);
        }
      } catch (error) {
        console.warn('Failed to get offline geocache:', error);
      }

      // Always attempt network fetch first when accessing direct links
      // This ensures QR codes and bookmarks work even with poor connectivity detection

      try {
        // Query by pubkey and d-tag
        const filter: NostrFilter = {
          kinds: [37515], // Geocache listing events
          authors: [pubkey],
          '#d': [dTag],
          limit: 1,
        };

        const signal = AbortSignal.any([c.signal, AbortSignal.timeout(TIMEOUTS.QUERY)]);
        const events = await nostr.query([filter], { signal });

        if (events.length === 0) {
          // If no online data but we have offline data, return that
          if (offlineGeocache) {
            console.log('No online data found, using offline geocache');
            return {
              ...offlineGeocache,
              foundCount: 0,
              logCount: 0,
            };
          }
          return null;
        }

        const geocache = parseGeocacheEvent(events[0]);
        if (!geocache) {
          // If parsing failed but we have offline data, return that
          if (offlineGeocache) {
            console.log('Online data parsing failed, using offline geocache');
            return {
              ...offlineGeocache,
              foundCount: 0,
              logCount: 0,
            };
          }
          return null;
        }

        // Cache the geocache offline for future use
        try {
          const cachedGeocache: CachedGeocache = {
            id: geocache.id,
            event: events[0],
            lastUpdated: Date.now(),
            coordinates: geocache.location ? [geocache.location.lat, geocache.location.lng] as [number, number] : undefined,
            difficulty: geocache.difficulty,
            terrain: geocache.terrain,
            type: geocache.type,
          };
          await offlineStorage.storeGeocache(cachedGeocache);
        } catch (error) {
          console.warn('Failed to cache geocache offline:', error);
        }

        // Quick log count fetch
        
        // Get logs for this specific geocache (both found and comment logs)
        const geocacheCoordinate = createGeocacheCoordinate(geocache.pubkey, geocache.dTag);
        
        const foundLogFilter: NostrFilter = {
          kinds: [NIP_GC_KINDS.FOUND_LOG],
          '#a': [geocacheCoordinate],
          limit: QUERY_LIMITS.LOGS / 2,
        };
        
        const commentLogFilter: NostrFilter = {
          kinds: [NIP_GC_KINDS.COMMENT_LOG],
          '#a': [geocacheCoordinate],
          '#A': [geocacheCoordinate],
          limit: QUERY_LIMITS.LOGS / 2,
        };

        // Use nostr query with error handling
        let logEvents: NostrEvent[] = [];
        try {
          const [foundEvents, commentEvents] = await Promise.all([
            nostr.query([foundLogFilter], { signal }),
            nostr.query([commentLogFilter], { signal }),
          ]);
          logEvents = [...foundEvents, ...commentEvents];
        } catch (error) {
          logEvents = []; // Continue without log counts
        }
      
        let foundCount = 0;
        const logCount = logEvents.length;
        
        logEvents.forEach(event => {
          const log = parseLogEvent(event);
          if (log && log.type === 'found') {
            foundCount++;
          }
        });

        const result = {
          ...geocache,
          foundCount,
          logCount,
        };

        console.log('Online geocache query successful:', result.name);
        return result;
      } catch (error) {
        console.warn('Online geocache query failed:', error);
        // Return offline data if available, otherwise throw a more specific error
        if (offlineGeocache) {
          console.log('Falling back to offline data');
          return {
            ...offlineGeocache,
            foundCount: 0,
            logCount: 0,
          };
        }
        
        // If we have no offline data and network failed, provide a helpful error
        if (!navigator.onLine || !isOnline || !isConnected) {
          throw new Error('Geocache not available offline');
        }
        
        // For other network errors, throw the original error
        throw error;
      }
    },
    enabled: !!naddr,
  });
}