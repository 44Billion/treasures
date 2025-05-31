import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Geocache } from '@/types/geocache';
import { NostrFilter } from '@nostrify/nostrify';

interface SavedCache {
  id: string;
  dTag: string;
  pubkey: string;
  name: string;
  savedAt: number;
  location: {
    lat: number;
    lng: number;
  };
  difficulty: number;
  terrain: number;
  size: string;
  type: string;
  foundCount?: number;
  logCount?: number;
}

// Use a custom event kind for cache bookmarks
const CACHE_BOOKMARK_KIND = 1985; // Use kind 1985 (labeling) for bookmark actions

export function useNostrSavedCaches() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const { mutateAsync: publishEvent } = useNostrPublish();
  const queryClient = useQueryClient();

  // Query user's cache bookmark events
  const { data: bookmarkEvents, refetch: refetchBookmarks, isLoading: isLoadingBookmarks } = useQuery({
    queryKey: ['cache-bookmarks', user?.pubkey],
    queryFn: async () => {
      if (!user?.pubkey || !nostr) return [];
      
      try {
        // Simple query for bookmark events
        const query = { 
          kinds: [CACHE_BOOKMARK_KIND], 
          authors: [user.pubkey],
          '#l': ['treasures/cache-bookmark'],
          limit: 1000
        };
        
        // Safari-compatible query with shorter timeout
        const events = await Promise.race([
          nostr.query([query]),
          new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('Bookmark query timeout')), 5000)
          )
        ]);
        
        // Filter to only cache bookmark events (including clear-all events)
        const cacheBookmarkEvents = events.filter(event => 
          event.tags.some(tag => tag[0] === 'a' && tag[1]?.startsWith('37515:')) ||
          event.tags.some(tag => tag[0] === 'action' && tag[1] === 'clear-all')
        );
        
        return cacheBookmarkEvents.sort((a, b) => b.created_at - a.created_at);
      } catch (error) {
        console.warn('Failed to fetch bookmark events:', error);
        return [];
      }
    },
    enabled: !!user?.pubkey && !!nostr,
    staleTime: 30000, // 30 seconds
  });

  // Extract saved cache coordinates from bookmark events
  const savedCacheCoords = useMemo(() => {
    if (!bookmarkEvents || bookmarkEvents.length === 0) {
      return [];
    }
    
    // Track the latest action for each cache
    const cacheActions = new Map<string, { action: string; timestamp: number }>();
    
    // First, find if there's a clear-all event and get its timestamp
    let clearAllTimestamp = 0;
    bookmarkEvents.forEach((event) => {
      const actionTag = event.tags.find(tag => tag[0] === 'action');
      if (actionTag && actionTag[1] === 'clear-all') {
        clearAllTimestamp = Math.max(clearAllTimestamp, event.created_at);
      }
    });
    
    bookmarkEvents.forEach((event) => {
      const aTag = event.tags.find(tag => tag[0] === 'a' && tag[1]?.startsWith('37515:'));
      const actionTag = event.tags.find(tag => tag[0] === 'action');
      
      if (aTag && actionTag) {
        const coord = aTag[1];
        const action = actionTag[1];
        const timestamp = event.created_at;
        
        // Skip actions that happened before the most recent clear-all
        if (timestamp <= clearAllTimestamp) {
          return;
        }
        
        // Only keep the most recent action for each cache after clear-all
        const existing = cacheActions.get(coord);
        if (!existing || timestamp > existing.timestamp) {
          cacheActions.set(coord, { action, timestamp });
        }
      }
    });
    
    // Return only caches that have 'save' as their latest action after clear-all
    const savedCoords: string[] = [];
    cacheActions.forEach((actionData, coord) => {
      if (actionData.action === 'save') {
        savedCoords.push(coord);
      }
    });
    
    return savedCoords;
  }, [bookmarkEvents]);

  // Query the actual geocache events for saved caches
  const { data: savedGeocacheEvents, isLoading: isLoadingCaches } = useQuery({
    queryKey: ['saved-geocaches', savedCacheCoords],
    queryFn: async () => {
      if (!nostr || savedCacheCoords.length === 0) return [];
      
      try {
        // Build filters for each saved geocache coordinate
        const filters = savedCacheCoords.map(coord => {
          const [kind, pubkey, dTag] = coord.split(':');
          return {
            kinds: [parseInt(kind)],
            authors: [pubkey],
            '#d': [dTag],
            limit: 1
          };
        });
        
        // Safari-compatible query with batch processing
        const events: any[] = [];
        
        // Process filters in smaller batches for Safari
        const batchSize = 5;
        for (let i = 0; i < filters.length; i += batchSize) {
          const batch = filters.slice(i, i + batchSize);
          try {
            const batchEvents = await Promise.race([
              nostr.query(batch),
              new Promise<never>((_, reject) => 
                setTimeout(() => reject(new Error('Batch query timeout')), 5000)
              )
            ]);
            events.push(...batchEvents);
          } catch (error) {
            console.warn(`Batch ${i / batchSize + 1} failed:`, error);
            // Continue with other batches
          }
        }
        
        return events;
      } catch (error) {
        console.warn('Failed to fetch saved geocache events:', error);
        return [];
      }
    },
    enabled: savedCacheCoords.length > 0 && !!nostr,
    staleTime: 60000, // 1 minute
  });

  // Query log counts for saved caches
  const { data: savedCacheLogCounts, isLoading: isLoadingLogCounts } = useQuery({
    queryKey: ['saved-cache-log-counts', savedCacheCoords],
    queryFn: async () => {
      if (!nostr || savedCacheCoords.length === 0) return new Map();
      
      try {
        // Single filter for all log events
        const logFilter: NostrFilter = {
          kinds: [37516], // Log events
          '#a': savedCacheCoords,
          limit: 1000,
        };
        
        // Safari-compatible log query with reduced scope
        const allLogEvents = await Promise.race([
          nostr.query([logFilter]),
          new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('Log count query timeout')), 4000)
          )
        ]);
        
        // Group logs by geocache and count them
        const logCounts = new Map<string, { total: number; found: number }>();
        
        for (const logEvent of allLogEvents) {
          const aTag = logEvent.tags.find(t => t[0] === 'a')?.[1];
          if (aTag) {
            const logType = logEvent.tags.find(t => t[0] === 'log-type')?.[1];
            
            if (!logCounts.has(aTag)) {
              logCounts.set(aTag, { total: 0, found: 0 });
            }
            
            const counts = logCounts.get(aTag)!;
            counts.total++;
            
            if (logType === 'found') {
              counts.found++;
            }
          }
        }
        
        return logCounts;
      } catch (error) {
        console.warn('Failed to fetch log counts:', error);
        return new Map();
      }
    },
    enabled: savedCacheCoords.length > 0 && !!nostr,
    staleTime: 60000, // 1 minute
  });

  // Convert geocache events to SavedCache format
  const savedCaches = useMemo(() => {
    if (!savedGeocacheEvents) return [];
    
    return savedGeocacheEvents.map(event => {
      const name = event.tags.find(tag => tag[0] === 'name')?.[1] || 'Unknown Cache';
      const location = {
        lat: parseFloat(event.tags.find(tag => tag[0] === 'lat')?.[1] || '0'),
        lng: parseFloat(event.tags.find(tag => tag[0] === 'lng')?.[1] || '0'),
      };
      const difficulty = parseInt(event.tags.find(tag => tag[0] === 'difficulty')?.[1] || '1');
      const terrain = parseInt(event.tags.find(tag => tag[0] === 'terrain')?.[1] || '1');
      const size = event.tags.find(tag => tag[0] === 'size')?.[1] || 'regular';
      const type = event.tags.find(tag => tag[0] === 'type')?.[1] || 'traditional';
      const dTag = event.tags.find(tag => tag[0] === 'd')?.[1] || '';
      
      // Get log counts for this cache
      const coord = `37515:${event.pubkey}:${dTag}`;
      const counts = savedCacheLogCounts?.get(coord) || { total: 0, found: 0 };
      
      return {
        id: event.id,
        dTag,
        pubkey: event.pubkey,
        name,
        savedAt: event.created_at * 1000, // Convert to milliseconds
        location,
        difficulty,
        terrain,
        size,
        type,
        foundCount: counts.found,
        logCount: counts.total,
      } as SavedCache;
    }).sort((a, b) => b.savedAt - a.savedAt); // Sort by most recently saved
  }, [savedGeocacheEvents, savedCacheLogCounts]);

  // Check if a cache is saved
  const isCacheSaved = useCallback((cacheId: string, dTag?: string, pubkey?: string) => {
    if (!user) return false;
    
    if (dTag && pubkey) {
      const coord = `37515:${pubkey}:${dTag}`;
      return savedCacheCoords.includes(coord);
    }
    
    // Fallback: check by cache ID in saved events
    return savedCaches.some(cache => cache.id === cacheId);
  }, [savedCacheCoords, savedCaches, user]);

  // Save cache by publishing a bookmark event
  const saveCache = useCallback(async (geocache: Geocache) => {
    if (!user) throw new Error('User must be logged in to save caches');

    const coord = `37515:${geocache.pubkey}:${geocache.dTag}`;
    
    // Check if already saved
    if (savedCacheCoords.includes(coord)) {
      return;
    }

    // Publish a bookmark event for this cache
    await publishEvent({
      kind: CACHE_BOOKMARK_KIND,
      content: `Saved cache: ${geocache.name}`,
      tags: [
        ['L', 'treasures/cache-bookmark'],
        ['l', 'treasures/cache-bookmark'],
        ['a', coord],
        ['name', geocache.name],
        ['action', 'save'],
        ['client', 'treasures']
      ],
    });

    // Refetch bookmarks to update UI
    await refetchBookmarks();
    queryClient.invalidateQueries({ queryKey: ['saved-geocaches'] });
  }, [user, savedCacheCoords, publishEvent, refetchBookmarks, queryClient]);

  // Unsave cache by publishing a removal bookmark event
  const unsaveCache = useCallback(async (geocache: Geocache) => {
    if (!user) throw new Error('User must be logged in to unsave caches');

    const coord = `37515:${geocache.pubkey}:${geocache.dTag}`;
    
    // Publish a bookmark removal event for this cache
    await publishEvent({
      kind: CACHE_BOOKMARK_KIND,
      content: `Removed cache: ${geocache.name}`,
      tags: [
        ['L', 'treasures/cache-bookmark'],
        ['l', 'treasures/cache-bookmark'],
        ['a', coord],
        ['name', geocache.name],
        ['action', 'remove'],
        ['client', 'treasures']
      ],
    });

    // Refetch bookmarks to update UI
    await refetchBookmarks();
    queryClient.invalidateQueries({ queryKey: ['saved-geocaches'] });
  }, [user, publishEvent, refetchBookmarks, queryClient]);

  // Toggle save cache
  const toggleSaveCache = useCallback(async (geocache: Geocache) => {
    if (!user) {
      throw new Error('User must be logged in to save caches');
    }

    const isCurrentlySaved = isCacheSaved(geocache.id, geocache.dTag, geocache.pubkey);
    
    if (isCurrentlySaved) {
      await unsaveCache(geocache);
    } else {
      await saveCache(geocache);
    }
  }, [isCacheSaved, saveCache, unsaveCache, user]);

  // Clear all saved caches
  const clearAllSaved = useCallback(async () => {
    if (!user) return;
    
    // Publish a clear all event
    await publishEvent({
      kind: CACHE_BOOKMARK_KIND,
      content: 'Cleared all saved caches',
      tags: [
        ['L', 'treasures/cache-bookmark'],
        ['l', 'treasures/cache-bookmark'],
        ['action', 'clear-all'],
        ['client', 'treasures']
      ],
    });
    
    // Force immediate cache invalidation
    queryClient.invalidateQueries({ queryKey: ['cache-bookmarks', user.pubkey] });
    queryClient.invalidateQueries({ queryKey: ['saved-geocaches'] });
    queryClient.invalidateQueries({ queryKey: ['saved-cache-log-counts'] });
    
    // Also refetch the bookmarks
    await refetchBookmarks();
  }, [user, publishEvent, refetchBookmarks, queryClient]);

  // Unsave cache by ID (for compatibility with existing components)
  const unsaveCacheById = useCallback(async (cacheId: string) => {
    // Find the cache in saved caches to get its details
    const cache = savedCaches.find(c => c.id === cacheId);
    if (cache) {
      // Use the full geocache object for proper unsaving
      const geocache: Geocache = {
        id: cache.id,
        dTag: cache.dTag,
        pubkey: cache.pubkey,
        name: cache.name,
        location: cache.location,
        difficulty: cache.difficulty,
        terrain: cache.terrain,
        size: cache.size as "micro" | "small" | "regular" | "large",
        type: cache.type as "traditional" | "multi" | "mystery" | "earth" | "virtual" | "letterbox" | "event",
        created_at: Math.floor(cache.savedAt / 1000), // Convert to seconds
        description: '', // Not stored in saved cache
        foundCount: cache.foundCount || 0,
        logCount: cache.logCount || 0,
      };
      await toggleSaveCache(geocache);
    }
  }, [savedCaches, toggleSaveCache]);

  return {
    savedCaches,
    isCacheSaved,
    toggleSaveCache,
    unsaveCache: unsaveCacheById,
    clearAllSaved,
    isNostrEnabled: !!user,
    nostrSavedCount: savedCacheCoords.length,
    isLoading: isLoadingBookmarks || isLoadingCaches || isLoadingLogCounts,
  };
}