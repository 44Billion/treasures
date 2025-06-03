import { NostrFilter } from '@nostrify/nostrify';
import type { Geocache } from '@/types/geocache';
import { useNostrQuery, useNostrBatchQuery } from '@/hooks/useUnifiedNostr';
import { TIMEOUTS, QUERY_LIMITS } from '@/lib/constants';
import { useOfflineMode } from '@/hooks/useOfflineStorage';
import { useCacheInvalidation } from '@/hooks/useCacheInvalidation';
import { offlineStorage, type CachedGeocache } from '@/lib/offlineStorage';
import { 
  NIP_GC_KINDS, 
  parseGeocacheEvent, 
  parseLogEvent, 
  createGeocacheCoordinate 
} from '@/lib/nip-gc';

export function useGeocache(id: string) {
  const { isOnline, isConnected, connectionQuality } = useOfflineMode();
  
  // Enable cache invalidation monitoring
  useCacheInvalidation();

  // Query for the geocache by ID
  const { data: result, ...queryState } = useNostrQuery(
    ['geocache', id, isOnline && isConnected && navigator.onLine],
    id ? [{
      ids: [id],
      kinds: [NIP_GC_KINDS.GEOCACHE],
      limit: 1,
    }] : [],
    {
      enabled: !!id,
      timeout: TIMEOUTS.QUERY,
      staleTime: (isOnline && isConnected && navigator.onLine) ? 30000 : Infinity,
      gcTime: 300000,
      retry: false,
      refetchOnReconnect: true,
      networkMode: 'always',
    }
  );

  // Process the geocache data
  const processedData = (() => {
    if (!result?.events || result.events.length === 0) {
      // Try to get offline data
      return getOfflineGeocache(id);
    }

    const geocache = parseGeocacheEvent(result.events[0]);
    if (!geocache) {
      return getOfflineGeocache(id);
    }

    // Cache the geocache offline for future use
    cacheGeocacheOffline(geocache, result.events[0]);

    return {
      ...geocache,
      foundCount: 0, // Will be updated by log query
      logCount: 0,   // Will be updated by log query
    };
  })();

  // Query for logs if we have a geocache
  const geocache = processedData;
  const { data: logEvents } = useNostrBatchQuery(
    ['geocache-logs-count', id],
    geocache ? [
      // Found logs
      [{
        kinds: [NIP_GC_KINDS.FOUND_LOG],
        '#a': [createGeocacheCoordinate(geocache.pubkey, geocache.dTag)],
        limit: QUERY_LIMITS.LOGS / 2,
      }],
      // Comment logs
      [{
        kinds: [NIP_GC_KINDS.COMMENT_LOG],
        '#a': [createGeocacheCoordinate(geocache.pubkey, geocache.dTag)],
        '#A': [createGeocacheCoordinate(geocache.pubkey, geocache.dTag)],
        limit: QUERY_LIMITS.LOGS / 2,
      }]
    ] : [],
    {
      enabled: !!geocache,
      timeout: TIMEOUTS.QUERY,
      staleTime: 30000,
    }
  );

  // Calculate final result with log counts
  const finalResult = (() => {
    if (!geocache) return null;

    let foundCount = 0;
    const logCount = logEvents?.length || 0;
    
    if (logEvents) {
      logEvents.forEach(event => {
        const log = parseLogEvent(event);
        if (log && log.type === 'found') {
          foundCount++;
        }
      });
    }

    return {
      ...geocache,
      foundCount,
      logCount,
    };
  })();

  return {
    ...queryState,
    data: finalResult,
  };

  // Helper function to get offline geocache
  async function getOfflineGeocache(id: string) {
    try {
      await offlineStorage.init();
      const cached = await offlineStorage.getGeocache(id);
      
      if (cached) {
        const offlineGeocache = parseGeocacheEvent(cached.event);
        if (offlineGeocache) {
          return {
            ...offlineGeocache,
            foundCount: 0,
            logCount: 0,
          };
        }
      }
      return null;
    } catch (error) {
      console.warn('Failed to get offline geocache:', error);
      return null;
    }
  }

  // Helper function to cache geocache offline
  async function cacheGeocacheOffline(geocache: Geocache, event: NostrEvent) {
    try {
      const cachedGeocache: CachedGeocache = {
        id: geocache.id,
        event: event,
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
}


// parseGeocacheEvent is now imported from @/lib/nip-gc
