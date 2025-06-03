import { NostrEvent, NostrFilter } from '@nostrify/nostrify';
import type { Geocache } from '@/types/geocache';
import { decodeHint } from '@/lib/rot13';
import { useNostrQuery, useNostrBatchQuery } from '@/hooks/useUnifiedNostr';
import { TIMEOUTS, QUERY_LIMITS } from '@/lib/constants';
import { useOfflineMode } from '@/hooks/useOfflineStorage';
import { offlineStorage, type CachedGeocache } from '@/lib/offlineStorage';
import { 
  NIP_GC_KINDS, 
  parseGeocacheEvent, 
  parseLogEvent, 
  createGeocacheCoordinate 
} from '@/lib/nip-gc';

// Simple heuristic to detect if text is likely ROT13 encoded
// ROT13 encoded text often has unusual character patterns
function isRot13Encoded(text: string): boolean {
  // If the text contains common English words, it's probably not encoded
  const commonWords = ['the', 'and', 'to', 'of', 'a', 'in', 'is', 'it', 'you', 'that', 'he', 'was', 'for', 'on', 'are', 'as', 'with', 'his', 'they', 'i', 'at', 'be', 'this', 'have', 'from', 'or', 'one', 'had', 'by', 'word', 'but', 'not', 'what', 'all'];
  const lowerText = text.toLowerCase();
  
  const foundCommonWords = commonWords.filter(word => 
    lowerText.includes(word) || lowerText.includes(' ' + word + ' ')
  ).length;
  
  // If we find multiple common English words, it's likely plaintext
  if (foundCommonWords >= 2) {
    return false;
  }
  
  // If it's a very short hint (under 5 chars), assume plaintext
  if (text.length < 5) {
    return false;
  }
  
  // Otherwise, assume it might be encoded (this is a conservative approach)
  // We could improve this heuristic later
  return true;
}

export function useGeocacheByDTag(dTag: string) {
  const { isOnline, isConnected, connectionQuality } = useOfflineMode();

  // Query for the geocache by d-tag
  const { data: result, ...queryState } = useNostrQuery(
    ['geocache-by-dtag', dTag, isOnline && isConnected && navigator.onLine],
    dTag ? [{
      kinds: [NIP_GC_KINDS.GEOCACHE],
      '#d': [dTag],
      limit: 1,
    }] : [],
    {
      enabled: !!dTag,
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
      return getOfflineGeocache(dTag);
    }

    const geocache = parseGeocacheEvent(result.events[0]);
    if (!geocache) {
      return getOfflineGeocache(dTag);
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
    ['geocache-logs-count', dTag],
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
  async function getOfflineGeocache(dTag: string) {
    try {
      await offlineStorage.init();
      const cachedGeocaches = await offlineStorage.getAllGeocaches();
      const cached = cachedGeocaches.find(c => 
        c.event.tags.find(t => t[0] === 'd')?.[1] === dTag
      );
      
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
      console.warn('Failed to get offline geocache by dTag:', error);
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
