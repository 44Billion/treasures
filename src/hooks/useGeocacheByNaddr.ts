import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';
import { NostrEvent, NostrFilter } from '@nostrify/nostrify';
import type { Geocache } from '@/types/geocache';
import { parseNaddr } from '@/lib/naddr-utils';
import { queryNostr } from '@/lib/nostrQuery';
import { TIMEOUTS, QUERY_LIMITS } from '@/lib/constants';
import { isSafari } from '@/lib/safariNostr';
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

  return useQuery({
    queryKey: ['geocache-by-naddr', naddr, isOnline && isConnected && navigator.onLine, isSafari()],
    staleTime: (isOnline && isConnected && navigator.onLine) ? 30000 : Infinity, // 30 seconds online, never stale offline
    gcTime: 300000, // 5 minutes
    retry: false, // Disable retries to prevent cache invalidation
    refetchOnReconnect: true, // Refetch when connection is restored
    networkMode: 'always', // Always run queries regardless of network status
    queryFn: async (c) => {
      console.log('useGeocacheByNaddr query starting...', {
        naddr,
        isOnline,
        isConnected,
        connectionQuality,
        navigatorOnline: navigator.onLine
      });

      // Parse the naddr to get pubkey and dTag
      const parsed = parseNaddr(naddr);
      if (!parsed) {
        throw new Error('Invalid naddr format');
      }
      
      const { pubkey, dTag, relays } = parsed;

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

      // If we're truly offline or not connected, return offline data immediately
      if (!navigator.onLine || !isOnline || !isConnected || connectionQuality === 'offline') {
        console.log('Using offline data - not connected to internet', {
          navigatorOnline: navigator.onLine,
          isOnline,
          isConnected,
          connectionQuality
        });
        
        if (offlineGeocache) {
          return {
            ...offlineGeocache,
            foundCount: 0, // We don't have log counts offline for individual caches
            logCount: 0,
          };
        } else {
          throw new Error('Geocache not available offline');
        }
      }

      try {
        // Query by pubkey and d-tag
        const filter: NostrFilter = {
          kinds: [37515], // Geocache listing events
          authors: [pubkey],
          '#d': [dTag],
          limit: 1,
        };

        // Use unified query utility
        const events = await queryNostr(nostr, [filter], {
          timeout: isSafari() ? TIMEOUTS.SAFARI_QUERY : TIMEOUTS.STANDARD_QUERY,
          maxRetries: isSafari() ? 2 : 3,
          signal: c.signal,
        });
        

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
          limit: isSafari() ? QUERY_LIMITS.SAFARI_LOGS / 2 : QUERY_LIMITS.STANDARD_LOGS / 2,
        };
        
        const commentLogFilter: NostrFilter = {
          kinds: [NIP_GC_KINDS.COMMENT_LOG],
          '#a': [geocacheCoordinate],
          '#A': [geocacheCoordinate],
          limit: isSafari() ? QUERY_LIMITS.SAFARI_LOGS / 2 : QUERY_LIMITS.STANDARD_LOGS / 2,
        };

        // Use unified query utility with error handling
        let logEvents: NostrEvent[] = [];
        try {
          const [foundEvents, commentEvents] = await Promise.all([
            queryNostr(nostr, [foundLogFilter], {
              timeout: isSafari() ? TIMEOUTS.SAFARI_QUERY : TIMEOUTS.STANDARD_QUERY,
              maxRetries: 1,
              signal: c.signal,
            }),
            queryNostr(nostr, [commentLogFilter], {
              timeout: isSafari() ? TIMEOUTS.SAFARI_QUERY : TIMEOUTS.STANDARD_QUERY,
              maxRetries: 1,
              signal: c.signal,
            }),
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
        console.warn('Online geocache query failed, using offline data:', error);
        // Return offline data instead of throwing error
        if (offlineGeocache) {
          return {
            ...offlineGeocache,
            foundCount: 0,
            logCount: 0,
          };
        }
        throw error;
      }
    },
    enabled: !!naddr,
  });
}