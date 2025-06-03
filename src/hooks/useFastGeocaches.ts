/**
 * Fast geocache loading hook optimized for performance
 * Prioritizes speed over completeness for initial loads
 */

import { useQuery } from '@tanstack/react-query';
import { NostrEvent, NostrFilter } from '@nostrify/nostrify';
import { useNostr } from '@nostrify/react';
import type { Geocache } from '@/types/geocache';
import { offlineStorage, CachedGeocache } from '@/lib/offlineStorage';
import { queryNostr } from '@/lib/nostrQuery';
import { TIMEOUTS, QUERY_LIMITS } from '@/lib/constants';
import { isSafari } from '@/lib/safariNostr';
import { NIP_GC_KINDS, parseGeocacheEvent } from '@/lib/nip-gc';
import { measureAsync } from '@/lib/performance';

interface FastGeocacheOptions {
  limit?: number;
  offlineFirst?: boolean; // Load offline data immediately, then update
}

export type GeocacheWithDistance = Geocache & { distance?: number };

/**
 * Fast geocache loading that prioritizes speed over completeness
 * Uses aggressive caching and simplified queries
 */
export function useFastGeocaches(options: FastGeocacheOptions = {}) {
  const { nostr } = useNostr();
  const { limit = QUERY_LIMITS.FAST_LOAD_LIMIT, offlineFirst = true } = options;

  return useQuery({
    queryKey: ['fast-geocaches', limit, offlineFirst, isSafari()],
    staleTime: 30000, // 30 seconds - aggressive caching
    gcTime: 300000, // 5 minutes
    retry: false, // No retries for speed
    refetchOnWindowFocus: false, // Don't refetch on focus for speed
    queryFn: async (): Promise<GeocacheWithDistance[]> => {
      return measureAsync('fast-geocache-query', async () => {
        console.log('Fast geocache query starting...');
        
        // If offline-first is enabled, try to get cached data immediately
        if (offlineFirst) {
          try {
            const cachedData = await measureAsync('offline-geocache-load', 
              () => getOfflineGeocachesFast(limit),
              { limit }
            );
            
            if (cachedData.length > 0) {
              console.log(`Fast offline load: ${cachedData.length} geocaches`);
              
              // Start background update but don't wait for it
              updateCacheInBackground(nostr, limit);
              
              return cachedData;
            }
          } catch (error) {
            console.warn('Fast offline load failed:', error);
          }
        }

        // Online query with minimal timeout
        try {
          const events = await measureAsync('online-geocache-query',
            () => queryNostr(nostr, [{
              kinds: [NIP_GC_KINDS.GEOCACHE],
              limit: limit,
            }], {
              timeout: isSafari() ? TIMEOUTS.FAST_QUERY : TIMEOUTS.FAST_QUERY * 2,
              maxRetries: 1, // Single retry only
            }),
            { limit, browser: isSafari() ? 'safari' : 'other' }
          );

          const geocaches = events
            .map(parseGeocacheEvent)
            .filter((g): g is Geocache => g !== null)
            .slice(0, limit);

          // Cache results in background
          cacheGeocachesInBackground(geocaches, events);

          console.log(`Fast online load: ${geocaches.length} geocaches`);
          return geocaches;
        } catch (error) {
          console.warn('Fast online query failed:', error);
          
          // Fallback to any available offline data
          const fallbackData = await measureAsync('fallback-offline-load',
            () => getOfflineGeocachesFast(limit),
            { limit }
          );
          console.log(`Fallback to offline: ${fallbackData.length} geocaches`);
          return fallbackData;
        }
      }, { limit, offlineFirst });
    },
  });
}

/**
 * Get cached geocaches with minimal processing
 */
async function getOfflineGeocachesFast(limit: number): Promise<GeocacheWithDistance[]> {
  try {
    await offlineStorage.init();
    
    // Use optimized method to get recent geocaches directly
    const recentCaches = await offlineStorage.getRecentGeocaches(limit);

    // Convert to Geocache format with minimal processing
    const geocaches = recentCaches
      .map(cached => parseGeocacheEvent(cached.event))
      .filter((g): g is Geocache => g !== null);

    return geocaches;
  } catch (error) {
    console.warn('Fast offline query failed:', error);
    return [];
  }
}

/**
 * Update cache in background without blocking UI
 */
function updateCacheInBackground(nostr: any, limit: number) {
  // Use setTimeout to ensure this runs after the main query resolves
  setTimeout(async () => {
    try {
      const events = await queryNostr(nostr, [{
        kinds: [NIP_GC_KINDS.GEOCACHE],
        limit: limit * 2, // Get more for background update
      }], {
        timeout: isSafari() ? TIMEOUTS.SAFARI_QUERY : TIMEOUTS.STANDARD_QUERY,
        maxRetries: 1,
      });

      const geocaches = events
        .map(parseGeocacheEvent)
        .filter((g): g is Geocache => g !== null);

      await cacheGeocachesInBackground(geocaches, events);
      console.log(`Background cache update: ${geocaches.length} geocaches`);
    } catch (error) {
      console.warn('Background cache update failed:', error);
    }
  }, 100);
}

/**
 * Cache geocaches in background without blocking
 */
async function cacheGeocachesInBackground(geocaches: Geocache[], events: NostrEvent[]) {
  // Use setTimeout to ensure this doesn't block the main thread
  setTimeout(async () => {
    try {
      for (const geocache of geocaches) {
        const event = events.find(e => e.id === geocache.id);
        if (event) {
          const cachedGeocache: CachedGeocache = {
            id: geocache.id,
            event: event,
            lastUpdated: Date.now(),
            lastValidated: Date.now(),
            coordinates: geocache.location ? [geocache.location.lat, geocache.location.lng] : undefined,
            difficulty: geocache.difficulty,
            terrain: geocache.terrain,
            type: geocache.type,
          };
          await offlineStorage.storeGeocache(cachedGeocache);
        }
      }
    } catch (error) {
      console.warn('Background caching failed:', error);
    }
  }, 50);
}

/**
 * Hook for home page that loads minimal data very quickly
 */
export function useHomePageGeocaches() {
  return useFastGeocaches({
    limit: QUERY_LIMITS.HOME_PAGE_LIMIT,
    offlineFirst: true,
  });
}

/**
 * Hook that loads geocaches progressively
 * First loads a small set quickly, then loads more in background
 */
export function useProgressiveGeocaches(fullLimit: number = 50) {
  const fastQuery = useFastGeocaches({
    limit: QUERY_LIMITS.FAST_LOAD_LIMIT,
    offlineFirst: true,
  });

  // Load more data in background after initial load
  const fullQuery = useQuery({
    queryKey: ['progressive-geocaches-full', fullLimit],
    staleTime: 60000, // 1 minute
    enabled: fastQuery.isSuccess && fastQuery.data && fastQuery.data.length > 0,
    queryFn: async (): Promise<GeocacheWithDistance[]> => {
      const { nostr } = useNostr();
      
      try {
        const events = await queryNostr(nostr, [{
          kinds: [NIP_GC_KINDS.GEOCACHE],
          limit: fullLimit,
        }], {
          timeout: isSafari() ? TIMEOUTS.SAFARI_QUERY : TIMEOUTS.STANDARD_QUERY,
          maxRetries: 2,
        });

        const geocaches = events
          .map(parseGeocacheEvent)
          .filter((g): g is Geocache => g !== null);

        // Cache in background
        cacheGeocachesInBackground(geocaches, events);

        return geocaches;
      } catch (error) {
        console.warn('Progressive full query failed:', error);
        return fastQuery.data || [];
      }
    },
  });

  // Return fast data initially, then full data when available
  return {
    data: fullQuery.data || fastQuery.data,
    isLoading: fastQuery.isLoading,
    isLoadingMore: fullQuery.isLoading,
    error: fullQuery.error || fastQuery.error,
    isSuccess: fastQuery.isSuccess,
  };
}