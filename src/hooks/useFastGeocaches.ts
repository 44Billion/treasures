/**
 * Fast geocache loading hook optimized for performance
 * Prioritizes speed over completeness for initial loads
 */

import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';
import { NostrEvent } from '@nostrify/nostrify';
import type { Geocache } from '@/types/geocache';
import { offlineStorage, CachedGeocache } from '@/lib/offlineStorage';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { QUERY_LIMITS, TIMEOUTS, POLLING_INTERVALS } from '@/lib/constants';
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
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const { limit = QUERY_LIMITS.FAST_LOAD_LIMIT } = options;

  return useQuery({
    queryKey: ['fast-geocaches', limit],
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(TIMEOUTS.FAST_QUERY)]);
      const events = await nostr.query([{
        kinds: [NIP_GC_KINDS.GEOCACHE],
        limit: limit,
      }], { signal });

      const geocaches = events
        .map(parseGeocacheEvent)
        .filter((g): g is Geocache => g !== null)
        .filter(g => !g.hidden || g.pubkey === user?.pubkey) // Show hidden caches to their creator
        .slice(0, limit);

      // Cache in background
      cacheGeocachesInBackground(geocaches, events);

      return geocaches;
    },
    staleTime: 30000, // 30 seconds - aggressive caching
    gcTime: 300000, // 5 minutes
    retry: false, // No retries for speed
    refetchOnWindowFocus: false, // Don't refetch on focus for speed
    refetchInterval: POLLING_INTERVALS.GEOCACHES, // Poll every minute
    refetchIntervalInBackground: true, // Continue polling in background
  });
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