import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';
import { NostrEvent } from '@nostrify/nostrify';
import type { Geocache } from '@/types/geocache';
import { TIMEOUTS, QUERY_LIMITS } from '@/lib/constants';
import { useOfflineMode } from '@/hooks/useOfflineStorage';
import { offlineStorage, type CachedGeocache } from '@/lib/offlineStorage';
import { 
  NIP_GC_KINDS, 
  parseGeocacheEvent, 
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
  const { nostr } = useNostr();
  const { isOnline, isConnected } = useOfflineMode();

  return useQuery({
    queryKey: ['geocache-by-dtag', dTag, isOnline && isConnected && navigator.onLine],
    queryFn: async (c) => {
      if (!dTag) return null;

      try {
        const signal = AbortSignal.any([c.signal, AbortSignal.timeout(TIMEOUTS.QUERY)]);
        
        // Query for the geocache by d-tag
        const geocacheEvents = await nostr.query([{
          kinds: [NIP_GC_KINDS.GEOCACHE],
          '#d': [dTag],
          limit: 1,
        }], { signal });

        let geocache: Geocache | null = null;

        if (geocacheEvents.length > 0) {
          geocache = parseGeocacheEvent(geocacheEvents[0]);
          if (geocache) {
            // Cache the geocache offline for future use
            await cacheGeocacheOffline(geocache, geocacheEvents[0]);
          }
        }

        // If not found online, try to get offline data
        if (!geocache) {
          geocache = await getOfflineGeocache(dTag);
          if (!geocache) {
            return null;
          }
        }

        // Query for logs to get counts
        let foundCount = 0;
        let logCount = 0;

        try {
          const coordinate = createGeocacheCoordinate(geocache.pubkey, geocache.dTag);
          
          // Get found logs
          const foundLogs = await nostr.query([{
            kinds: [NIP_GC_KINDS.FOUND_LOG],
            '#a': [coordinate],
            limit: QUERY_LIMITS.LOGS / 2,
          }], { signal });

          foundCount = foundLogs.length;

          // Get comment logs
          const commentLogs = await nostr.query([{
            kinds: [NIP_GC_KINDS.COMMENT_LOG],
            '#a': [coordinate],
            '#A': [coordinate],
            limit: QUERY_LIMITS.LOGS / 2,
          }], { signal });

          logCount = foundLogs.length + commentLogs.length;
        } catch (logError) {
          console.warn('Failed to fetch logs for geocache:', logError);
        }

        return {
          ...geocache,
          foundCount,
          logCount,
        };
      } catch (error) {
        console.warn('Failed to fetch geocache by dTag:', error);
        
        // Try to get offline data as fallback
        return await getOfflineGeocache(dTag);
      }
    },
    enabled: !!dTag,
    staleTime: (isOnline && isConnected && navigator.onLine) ? 30000 : Infinity,
    gcTime: 300000,
    retry: false,
    refetchOnReconnect: true,
    networkMode: 'always',
  });

  // Helper function to get offline geocache
  async function getOfflineGeocache(dTag: string): Promise<Geocache | null> {
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
  async function cacheGeocacheOffline(geocache: Geocache, event: NostrEvent): Promise<void> {
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
