/**
 * Offline-aware geocache hooks that work seamlessly online and offline
 */

import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';
import type { Geocache } from '@/types/geocache';
import { useOfflineMode } from '@/hooks/useOfflineStorage';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useDeletionFilter } from '@/hooks/useDeletionFilter';
import { offlineStorage, type CachedGeocache } from '@/lib/offlineStorage';
import { NIP_GC_KINDS, parseGeocacheEvent } from '@/lib/nip-gc';
import { TIMEOUTS, QUERY_LIMITS } from '@/lib/constants';

export function useOfflineGeocaches() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const { isOnline, isConnected } = useOfflineMode();
  
  // Get deletion filter for filtering deleted geocaches
  const { filterDeleted } = useDeletionFilter();

  return useQuery({
    queryKey: ['geocaches', 'offline-aware', isOnline && isConnected],
    queryFn: async (c) => {
      console.log('useOfflineGeocaches query starting...', {
        isOnline,
        isConnected,
        navigatorOnline: navigator.onLine
      });

      // Always try to get offline data first as a fallback
      let offlineGeocaches: Geocache[] = [];
      try {
        await offlineStorage.init();
        const cachedGeocaches = await offlineStorage.getAllGeocaches();
        
        // Parse geocaches first, then filter out deleted ones using the raw events
        const parsedWithEvents = cachedGeocaches
          .map(cached => {
            const parsed = parseGeocacheEvent(cached.event);
            return parsed ? { geocache: parsed, event: cached.event } : null;
          })
          .filter((item): item is NonNullable<typeof item> => item !== null);
          
        // Filter out deleted geocaches using the raw events
        const nonDeletedEvents = filterDeleted.fast(parsedWithEvents.map(item => item.event));
        const nonDeletedEventIds = new Set(nonDeletedEvents.map(e => e.id));
        
        offlineGeocaches = parsedWithEvents
          .filter(item => nonDeletedEventIds.has(item.event.id))
          .map(item => item.geocache)
          .filter(g => !g.hidden || g.pubkey === user?.pubkey)
          .map(g => ({ ...g, foundCount: 0, logCount: 0 }));
        
        console.log('Found offline geocaches:', offlineGeocaches.length);
      } catch (error) {
        console.warn('Failed to get offline geocaches:', error);
      }

      // If we're truly offline, return offline data immediately
      if (!navigator.onLine || !isOnline || !isConnected) {
        console.log('Using offline data - not connected to internet');
        return offlineGeocaches;
      }

      try {
        console.log('Fetching online geocaches...');
        const signal = AbortSignal.any([c.signal, AbortSignal.timeout(TIMEOUTS.QUERY)]);
        const events = await nostr.query([{
          kinds: [NIP_GC_KINDS.GEOCACHE],
          limit: QUERY_LIMITS.GEOCACHES,
        }], { signal });

        console.log('Retrieved online events:', events.length);

        // Filter out deleted events first
        const nonDeletedEvents = filterDeleted.fast(events);

        // Parse online geocaches
        const onlineGeocaches = nonDeletedEvents
          .map(parseGeocacheEvent)
          .filter((g): g is Geocache => g !== null)
          .filter(g => !g.hidden || g.pubkey === user?.pubkey)
          .map(g => ({ ...g, foundCount: 0, logCount: 0 }));

        // Cache online geocaches for offline use (only non-deleted ones)
        const cachePromises = nonDeletedEvents.map(event => {
          const geocache = parseGeocacheEvent(event);
          if (!geocache) return Promise.resolve();

          const cachedGeocache: CachedGeocache = {
            id: geocache.id,
            event: event,
            lastUpdated: Date.now(),
            coordinates: geocache.location ? [geocache.location.lat, geocache.location.lng] as [number, number] : undefined,
            difficulty: geocache.difficulty,
            terrain: geocache.terrain,
            type: geocache.type,
          };
          
          return offlineStorage.storeGeocache(cachedGeocache).catch(error => 
            console.warn('Failed to cache geocache:', geocache.id, error)
          );
        });

        // Don't wait for caching to complete
        Promise.all(cachePromises);

        console.log('Online geocache query successful:', onlineGeocaches.length);
        return onlineGeocaches;
      } catch (error) {
        console.warn('Online geocache query failed, using offline data:', error);
        return offlineGeocaches;
      }
    },
    staleTime: isOnline && isConnected ? 30000 : Infinity, // 30 seconds online, never stale offline
    gcTime: 300000, // 5 minutes
    retry: false, // Disable retries to prevent cache invalidation
    refetchOnReconnect: true, // Refetch when connection is restored
    networkMode: 'always', // Always run queries regardless of network status
  });
}

/**
 * Hook for offline-aware proximity geocaches
 */
export function useOfflineProximityGeocaches(
  lat?: number, 
  lon?: number, 
  radiusKm: number = 10
) {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const { isOnline, isConnected } = useOfflineMode();
  
  // Get deletion filter for filtering deleted geocaches
  const { filterDeleted } = useDeletionFilter();

  return useQuery({
    queryKey: ['proximity-geocaches', lat, lon, radiusKm, isOnline && isConnected],
    queryFn: async (c) => {
      if (!lat || !lon) return [];

      // Get all geocaches (using cache)
      const allGeocaches = await getAllGeocachesFromCache(filterDeleted);
      
      // Filter by proximity
      const proximityGeocaches = allGeocaches.filter(geocache => {
        if (!geocache.location) return false;
        
        const distance = calculateDistance(
          lat, lon, 
          geocache.location.lat, geocache.location.lng
        );
        
        return distance <= radiusKm;
      });

      return proximityGeocaches.sort((a, b) => {
        const distA = calculateDistance(lat, lon, a.location!.lat, a.location!.lng);
        const distB = calculateDistance(lat, lon, b.location!.lat, b.location!.lng);
        return distA - distB;
      });
    },
    enabled: lat !== undefined && lon !== undefined,
    staleTime: isOnline && isConnected ? 60000 : Infinity, // 1 minute online, never stale offline
    gcTime: 300000,
  });
}

/**
 * Helper function to get all geocaches from cache or network
 */
async function getAllGeocachesFromCache(filterDeleted?: any): Promise<Geocache[]> {
  try {
    await offlineStorage.init();
    const cachedGeocaches = await offlineStorage.getAllGeocaches();
    
    // Parse geocaches first, then filter out deleted ones using raw events
    const parsedWithEvents = cachedGeocaches
      .map(cached => {
        const parsed = parseGeocacheEvent(cached.event);
        return parsed ? { geocache: parsed, event: cached.event } : null;
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
      
    // Apply deletion filter if provided
    if (filterDeleted) {
      const nonDeletedEvents = filterDeleted.fast(parsedWithEvents.map(item => item.event));
      const nonDeletedEventIds = new Set(nonDeletedEvents.map((e: any) => e.id));
      
      return parsedWithEvents
        .filter(item => nonDeletedEventIds.has(item.event.id))
        .map(item => item.geocache)
        .map(g => ({ ...g, foundCount: 0, logCount: 0 }));
    }
      
    return parsedWithEvents.map(item => ({ ...item.geocache, foundCount: 0, logCount: 0 }));
  } catch (error) {
    console.warn('Failed to get geocaches from cache:', error);
    return [];
  }
}

/**
 * Calculate distance between two points in kilometers
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function deg2rad(deg: number): number {
  return deg * (Math.PI/180);
}