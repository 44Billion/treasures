/**
 * Fast geocache loading hook optimized for performance
 * Prioritizes speed over completeness for initial loads
 */

import { NostrEvent } from '@nostrify/nostrify';
import type { Geocache } from '@/types/geocache';
import { offlineStorage, CachedGeocache } from '@/lib/offlineStorage';
import { useNostrQuery } from '@/hooks/useUnifiedNostr';
import { QUERY_LIMITS } from '@/lib/constants';
import { NIP_GC_KINDS, parseGeocacheEvent } from '@/lib/nip-gc';

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
  const { limit = QUERY_LIMITS.FAST_LOAD_LIMIT } = options;

  // Use unified query system with fast timeout
  const { data: result, ...queryState } = useNostrQuery(
    ['fast-geocaches', limit],
    [{
      kinds: [NIP_GC_KINDS.GEOCACHE],
      limit: limit,
    }],
    {
      timeout: 3000, // Fast timeout
      staleTime: 30000, // 30 seconds - aggressive caching
      gcTime: 300000, // 5 minutes
      retry: false, // No retries for speed
      refetchOnWindowFocus: false, // Don't refetch on focus for speed
    }
  );

  // Process the data
  const processedData = (() => {
    if (!result?.events) return [];

    const geocaches = result.events
      .map(parseGeocacheEvent)
      .filter((g): g is Geocache => g !== null)
      .slice(0, limit);

    // Cache in background
    cacheGeocachesInBackground(geocaches, result.events);

    return geocaches;
  })();

  return {
    ...queryState,
    data: processedData,
  };
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
  });
}