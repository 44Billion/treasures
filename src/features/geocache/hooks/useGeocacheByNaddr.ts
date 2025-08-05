import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useGeocacheStoreContext } from '@/shared/stores/hooks';
import { parseNaddr } from '@/shared/utils/naddr';
import { useOfflineMode } from '@/features/offline/hooks/useOfflineStorage';
import { offlineStorage } from '@/features/offline/utils/offlineStorage';
import { parseGeocacheEvent } from '@/features/geocache/utils/nip-gc';
import { useNostr } from '@nostrify/react';
import { TIMEOUTS } from '@/lib/constants';
import { NIP_GC_KINDS } from '@/features/geocache/utils/nip-gc';
import { nip19, nip57 } from 'nostr-tools';
import { useZapStore } from '@/shared/stores/useZapStore';
import type { Geocache } from '@/shared/types';

export function useGeocacheByNaddr(naddr: string) {
  const geocacheStore = useGeocacheStoreContext();
  const { isOnline, isConnected, connectionQuality } = useOfflineMode();
  const queryClient = useQueryClient();
  const { nostr } = useNostr();
  const { setZaps } = useZapStore();

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

    queryFn: async () => {
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
      
      const { pubkey, dTag } = parsed;

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
      let offlineGeocache: Geocache | undefined = undefined;
      try {
        await offlineStorage.init();
        const cachedGeocaches = await offlineStorage.getAllGeocaches();
        const cached = cachedGeocaches.find(c => 
          c.event.pubkey === pubkey && 
          c.event.tags.find(t => t[0] === 'd')?.[1] === dTag
        );
        
        if (cached) {
          offlineGeocache = parseGeocacheEvent(cached.event) || undefined;
          console.log('Found offline geocache:', offlineGeocache?.name);
        }
      } catch (error) {
        console.warn('Failed to get offline geocache:', error);
      }

      // Always attempt network fetch first when accessing direct links
      try {
        // Try to find the geocache in the current store data first (for performance)
        const currentGeocaches = geocacheStore.geocaches;
        const existingGeocache = currentGeocaches.find(
          g => g.pubkey === pubkey && g.dTag === dTag
        );
        
        let geocache: Geocache | undefined = existingGeocache;
        
        // If not found in current data, query directly for this specific geocache
        if (!geocache) {
          console.log(`Geocache not found in store, querying directly: ${pubkey}:${dTag}`);
          
          // Query directly for this specific geocache using naddr coordinates
          const signal = AbortSignal.any([AbortSignal.timeout(TIMEOUTS.QUERY)]);
          const events = await nostr.query([{
            kinds: [NIP_GC_KINDS.GEOCACHE, NIP_GC_KINDS.GEOCACHE_LEGACY],
            authors: [pubkey],
            '#d': [dTag],
            limit: 1,
          }], { signal });
          
          if (events.length === 0) {
            console.warn(`Geocache not found on relay: ${pubkey}:${dTag}`);
            // If we have offline data, use that
            if (offlineGeocache) {
              console.log('Using offline geocache as fallback');
              geocache = offlineGeocache || undefined;
            } else {
              // Return null instead of throwing error - this allows the UI to handle create scenarios
              console.log('No geocache found and no offline data - returning null for potential create scenario');
              return null;
            }
          } else {
            if (!events[0]) {
              throw new Error('No event returned from query');
            }
            const parsedGeocache = parseGeocacheEvent(events[0]);
            if (!parsedGeocache) {
              throw new Error('Failed to parse geocache event');
            }
            geocache = parsedGeocache;
          }
        }
        
        // Cache the geocache offline for future use
        try {
          // If we have the raw event (from direct query), cache it offline
          if (!existingGeocache && geocache) {
            await offlineStorage.init();
            // Note: We don't have the raw event here, so we'll skip offline caching for direct queries
            console.log('Skipping offline caching for direct naddr query');
          }
        } catch (error) {
          console.warn('Failed to cache geocache offline:', error);
        }
        
        // If we returned null early (no geocache found), skip logs/zaps processing
        if (!geocache) {
          return null;
        }

        // Get logs and zaps for this specific geocache - query directly instead of using store
        // Use the actual kind from the geocache event
        const actualKind = (geocache?.kind as number) || NIP_GC_KINDS.GEOCACHE;
        const geocacheCoordinate = `${actualKind}:${pubkey}:${dTag}`;
        const logSignal = AbortSignal.any([AbortSignal.timeout(TIMEOUTS.QUERY)]);
        
        // Fetch logs
        const logEvents = await nostr.query([{
          kinds: [NIP_GC_KINDS.FOUND_LOG, NIP_GC_KINDS.COMMENT_LOG],
          '#a': [geocacheCoordinate],
          limit: 100, // Reasonable limit for logs
        }], { signal: logSignal });
        
        // Fetch zaps
        const zapSignal = AbortSignal.any([AbortSignal.timeout(TIMEOUTS.QUERY)]);
        const zapEvents = await nostr.query([{
          kinds: [9735],
          '#a': [geocacheCoordinate],
        }], { signal: zapSignal });
        
        let foundCount = 0;
        const logCount = logEvents.length;
        let zapTotal = 0;
        
        // Count found logs (unique by pubkey)
        const uniqueFinders = new Set<string>();
        logEvents.forEach(event => {
          if (event.kind === NIP_GC_KINDS.FOUND_LOG) {
            uniqueFinders.add(event.pubkey);
          }
        });
        foundCount = uniqueFinders.size;
        
        // Calculate zap total
        zapEvents.forEach(event => {
          const bolt11 = event.tags.find((t: string[]) => t[0] === 'bolt11')?.[1];
          if (bolt11) {
            try {
              zapTotal += nip57.getSatoshisAmountFromBolt11(bolt11);
            } catch (e) {
              console.error("Invalid bolt11 invoice", bolt11, e);
            }
          }
        });
        
        // Construct the correct naddr based on the actual geocache's kind
        const correctNaddr = nip19.naddrEncode({
          kind: geocache?.kind || NIP_GC_KINDS.GEOCACHE,
          pubkey: geocache?.pubkey || '',
          identifier: geocache?.dTag || '',
          relays: geocache?.relays || []
        });
        
        // Update zap store with fetched zaps
        const zapKey = `naddr:${correctNaddr}`;
        setZaps(zapKey, zapEvents);
        
        console.log('DEBUG: naddr correction:', {
          originalNaddr: naddr,
          originalKind: parsed?.kind,
          actualKind: geocache?.kind,
          correctNaddr,
          geocacheName: geocache?.name
        });

        const resultGeocache = {
          ...geocache,
          naddr: correctNaddr,
          foundCount,
          logCount,
          zapTotal,
        };

        console.log('Online geocache query successful:', resultGeocache.name);
        return resultGeocache;
      } catch (error) {
        console.warn('Online geocache query failed:', error);
        // Return offline data if available, otherwise throw a more specific error
        if (offlineGeocache) {
          console.log('Falling back to offline data');
          return {
            ...offlineGeocache,
            foundCount: 0,
            logCount: 0,
            zapTotal: 0,
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