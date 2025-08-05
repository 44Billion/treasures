/**
 * Offline-aware geocache hooks that work seamlessly online and offline
 */

import { useQuery } from '@tanstack/react-query';
import { useGeocacheStoreContext } from '@/shared/stores/hooks';

import { offlineStorage } from '@/features/offline/utils/offlineStorage';
import { parseGeocacheEvent } from '@/features/geocache/utils/nip-gc';
import type { Geocache } from '@/types/geocache';

export function useOfflineGeocaches() {
  const geocacheStore = useGeocacheStoreContext();
  
  return useQuery({
    queryKey: ['geocaches', 'offline-aware', navigator.onLine],
    queryFn: async () => {
      console.log('useOfflineGeocaches query starting...', {
        isOnline: navigator.onLine,
        isConnected: navigator.onLine,
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
          
        // For now, skip deletion filtering in offline mode to avoid complexity
        // TODO: Implement proper deletion event caching for offline mode
        const nonDeletedEvents = parsedWithEvents.map(item => item.event);
        const nonDeletedEventIds = new Set(nonDeletedEvents.map(e => e.id));
        
        offlineGeocaches = parsedWithEvents
          .filter(item => nonDeletedEventIds.has(item.event.id))
          .map(item => item.geocache)
          .filter(g => !g.hidden)
          .map(g => ({ ...g, foundCount: 0, logCount: 0 }));
        
        console.log('Found offline geocaches:', offlineGeocaches.length);
      } catch (error) {
        console.warn('Failed to get offline geocaches:', error);
      }

      // If we're truly offline, return offline data immediately
      if (!navigator.onLine) {
        console.log('Using offline data - not connected to internet');
        return offlineGeocaches;
      }

      try {
        console.log('Fetching online geocaches...');
        const result = await geocacheStore.fetchGeocaches();
        
        if (!result.success) {
          console.warn('Online geocache fetch failed, using offline data:', result.error);
          return offlineGeocaches;
        }

        const onlineGeocaches = (result.data || [])
          .filter((g: Geocache) => !g.hidden)
          .map((g: Geocache) => ({ ...g, foundCount: 0, logCount: 0 }));

        console.log('Online geocache query successful:', onlineGeocaches.length);
        return onlineGeocaches;
      } catch (error) {
        console.warn('Online geocache query failed, using offline data:', error);
        return offlineGeocaches;
      }
    },
    staleTime: navigator.onLine ? 30000 : Infinity, // 30 seconds online, never stale offline
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
  const geocacheStore = useGeocacheStoreContext();

  return useQuery({
    queryKey: ['proximity-geocaches', lat, lon, radiusKm, navigator.onLine],
    queryFn: async () => {
      if (!lat || !lon) return [];

      const result = await geocacheStore.fetchNearbyGeocaches(lat, lon, radiusKm);
      if (!result.success) {
        console.warn('Failed to fetch proximity geocaches:', result.error);
        return [];
      }

      return result.data;
    },
    enabled: lat !== undefined && lon !== undefined,
    staleTime: navigator.onLine ? 60000 : Infinity, // 1 minute online, never stale offline
    gcTime: 300000,
  });
}