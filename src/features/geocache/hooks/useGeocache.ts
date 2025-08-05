import { useQuery } from '@tanstack/react-query';
import { useGeocacheStoreContext } from '@/shared/stores/hooks';
import { useOfflineMode } from '@/features/offline/hooks/useOfflineStorage';
import { offlineStorage, type CachedGeocache } from '@/features/offline/utils/offlineStorage';
import type { Geocache } from '@/shared/types';
import type { NostrEvent } from '@nostrify/nostrify';

export function useGeocache(id: string) {
  const geocacheStore = useGeocacheStoreContext();
  const { isOnline, isConnected } = useOfflineMode();

  return useQuery({
    queryKey: ['geocache', id, isOnline && isConnected && navigator.onLine],
    queryFn: async () => {
      if (!id) return null;

      // Try offline first
      let offlineGeocache: Geocache | null = null;
      try {
        await offlineStorage.init();
        const cached = await offlineStorage.getGeocache(id);
        if (cached) {
          offlineGeocache = {
            ...cached,
            foundCount: 0,
            logCount: 0,
            pubkey: cached.event?.pubkey || '',
            created_at: cached.event?.created_at || 0,
            dTag: cached.event?.tags?.find((tag: string[]) => tag[0] === 'd')?.[1] || '',
            name: cached.event?.tags?.find((tag: string[]) => tag[0] === 'title')?.[1] || 'Unknown Cache',
            description: cached.event?.content || '',
            location: {
              lat: cached.coordinates?.[0] || 0,
              lng: cached.coordinates?.[1] || 0,
            },
            difficulty: cached.difficulty || 1,
            terrain: cached.terrain || 1,
            size: 'regular',
            type: (cached.type as Geocache['type']) || 'traditional',
          };
        }
      } catch (error) {
        console.warn('Failed to get offline geocache:', error);
      }

      // If offline, return offline data
      if (!navigator.onLine || !isOnline || !isConnected) {
        return offlineGeocache;
      }

      try {
        const result = await geocacheStore.fetchGeocache(id);
        if (!result.success) {
          // If online fetch fails, return offline data
          return offlineGeocache;
        }

        const geocache = result.data;
        
        // Cache offline
        if (geocache) {
          try {
            const cachedGeocache: CachedGeocache = {
              id: geocache.id,
              event: geocache as unknown as NostrEvent, // Note: This should be the raw event, but we'll adapt
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
        }

        return geocache;
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