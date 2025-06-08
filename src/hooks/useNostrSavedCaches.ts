import { useCallback, useMemo } from 'react';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Geocache } from '@/types/geocache';
import { 
  parseGeocacheEvent 
} from '@/lib/nip-gc';
import { TIMEOUTS } from '@/lib/constants';

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
  hidden?: boolean;
}

// Use a custom event kind for cache bookmarks
const CACHE_BOOKMARK_KIND = 1985; // Use kind 1985 (labeling) for bookmark actions

export function useNostrSavedCaches() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const { mutateAsync: publishEvent } = useNostrPublish();
  const queryClient = useQueryClient();

  // Query user's cache bookmark and deletion events
  const { data: bookmarkEvents, refetch: refetchBookmarks, isLoading: isLoadingBookmarks } = useQuery({
    queryKey: ['cache-bookmarks', user?.pubkey],
    queryFn: async (c) => {
      if (!user?.pubkey) return [];
      
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(TIMEOUTS.QUERY)]);
      
      // Query both bookmark events (kind 1985) and deletion events (kind 5)
      const events = await nostr.query([
        { 
          kinds: [CACHE_BOOKMARK_KIND], 
          authors: [user.pubkey],
          '#l': ['treasures/cache-bookmark'],
          limit: 1000
        },
        {
          kinds: [5], // Deletion events
          authors: [user.pubkey],
          limit: 1000
        }
      ], { signal });
      
      // Filter to only cache bookmark events and relevant deletion events
      const relevantEvents = events.filter(event => {
        if (event.kind === CACHE_BOOKMARK_KIND) {
          // Include bookmark events for caches
          return event.tags.some(tag => tag[0] === 'a' && tag[1]?.startsWith('37515:'));
        } else if (event.kind === 5) {
          // Include deletion events that reference bookmark events
          return event.tags.some(tag => tag[0] === 'e');
        }
        return false;
      });
      
      return relevantEvents.sort((a, b) => b.created_at - a.created_at);
    },
    enabled: !!user?.pubkey,
    staleTime: 30000, // 30 seconds
    retry: false,
  });

  // Extract saved cache coordinates from bookmark events, considering deletions
  const savedCacheCoords = useMemo(() => {
    if (!bookmarkEvents || bookmarkEvents.length === 0) {
      return [];
    }
    
    // Separate bookmark events and deletion events
    const bookmarks = bookmarkEvents.filter(event => event.kind === CACHE_BOOKMARK_KIND);
    const deletions = bookmarkEvents.filter(event => event.kind === 5);
    
    // Create a set of deleted event IDs
    const deletedEventIds = new Set<string>();
    deletions.forEach(deletion => {
      deletion.tags.forEach(tag => {
        if (tag[0] === 'e') {
          deletedEventIds.add(tag[1]);
        }
      });
    });
    
    // Filter out deleted bookmark events
    const activeBookmarks = bookmarks.filter(event => !deletedEventIds.has(event.id));
    
    // Extract coordinates from active bookmark events with 'save' action
    const savedCoords: string[] = [];
    activeBookmarks.forEach((event) => {
      const aTag = event.tags.find(tag => tag[0] === 'a' && tag[1]?.startsWith('37515:'));
      const actionTag = event.tags.find(tag => tag[0] === 'action');
      
      if (aTag && actionTag && actionTag[1] === 'save') {
        savedCoords.push(aTag[1]);
      }
    });
    
    return savedCoords;
  }, [bookmarkEvents]);

  // Query the actual geocache events for saved caches
  const { data: savedGeocacheEvents, isLoading: isLoadingCaches } = useQuery({
    queryKey: ['saved-geocaches', savedCacheCoords],
    queryFn: async (c) => {
      if (savedCacheCoords.length === 0) return [];
      
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(TIMEOUTS.QUERY)]);
      
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
      
      const events = await nostr.query(filters, { signal });
      return events;
    },
    enabled: savedCacheCoords.length > 0,
    staleTime: 60000, // 1 minute
    retry: false,
  });

  // Convert geocache events to SavedCache format
  const savedCaches = useMemo(() => {
    if (!savedGeocacheEvents) return [];
    
    return savedGeocacheEvents.map(event => {
      const parsed = parseGeocacheEvent(event);
      if (!parsed) {
        return null;
      }
      
      return {
        id: parsed.id,
        dTag: parsed.dTag,
        pubkey: parsed.pubkey,
        name: parsed.name,
        savedAt: parsed.created_at * 1000, // Convert to milliseconds
        location: parsed.location,
        difficulty: parsed.difficulty,
        terrain: parsed.terrain,
        size: parsed.size,
        type: parsed.type,
        foundCount: 0,
        logCount: 0,
        hidden: parsed.hidden,
      } as SavedCache;
    }).filter((cache): cache is SavedCache => cache !== null)
      .sort((a, b) => b.savedAt - a.savedAt); // Sort by most recently saved
  }, [savedGeocacheEvents]);

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

    const bookmarkEvent = {
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
    };

    await publishEvent(bookmarkEvent);

    // Refetch bookmarks to update UI
    await refetchBookmarks();
    queryClient.invalidateQueries({ queryKey: ['saved-geocaches'] });
  }, [user, savedCacheCoords, publishEvent, refetchBookmarks, queryClient]);

  // Unsave cache by deleting the bookmark event
  const unsaveCache = useCallback(async (geocache: Geocache) => {
    if (!user) throw new Error('User must be logged in to unsave caches');

    const coord = `37515:${geocache.pubkey}:${geocache.dTag}`;
    
    // Find the bookmark event to delete
    const bookmarkEvent = bookmarkEvents?.find(event => {
      const aTag = event.tags.find(tag => tag[0] === 'a' && tag[1] === coord);
      const actionTag = event.tags.find(tag => tag[0] === 'action' && tag[1] === 'save');
      return aTag && actionTag;
    });

    if (bookmarkEvent) {
      const deletionEvent = {
        kind: 5, // Event deletion request
        content: `Removed bookmark for cache: ${geocache.name}`,
        tags: [
          ['e', bookmarkEvent.id], // Reference to the bookmark event to delete
          ['client', 'treasures']
        ],
      };

      await publishEvent(deletionEvent);
    }

    // Refetch bookmarks to update UI
    await refetchBookmarks();
    queryClient.invalidateQueries({ queryKey: ['saved-geocaches'] });
  }, [user, bookmarkEvents, publishEvent, refetchBookmarks, queryClient]);

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
        size: cache.size as "micro" | "small" | "regular" | "large" | "other",
        type: cache.type as "traditional" | "multi" | "mystery",
        created_at: Math.floor(cache.savedAt / 1000), // Convert to seconds
        description: '', // Not stored in saved cache
        foundCount: cache.foundCount || 0,
        logCount: cache.logCount || 0,
      };
      await toggleSaveCache(geocache);
    }
  }, [savedCaches, toggleSaveCache]);

  // Clear all saved caches by deleting all bookmark events
  const clearAllSaved = useCallback(async () => {
    if (!user) return;
    
    // Find all bookmark events with 'save' action
    const saveBookmarkEvents = bookmarkEvents?.filter(event => {
      const actionTag = event.tags.find(tag => tag[0] === 'action' && tag[1] === 'save');
      const aTag = event.tags.find(tag => tag[0] === 'a' && tag[1]?.startsWith('37515:'));
      return actionTag && aTag;
    }) || [];

    if (saveBookmarkEvents.length > 0) {
      // Publish a deletion event for all bookmark events
      await publishEvent({
        kind: 5, // Event deletion request
        content: 'Cleared all saved caches',
        tags: [
          ...saveBookmarkEvents.map(event => ['e', event.id]), // Reference all bookmark events to delete
          ['client', 'treasures']
        ],
      });
    }
    
    // Force immediate cache invalidation
    queryClient.invalidateQueries({ queryKey: ['cache-bookmarks', user.pubkey] });
    queryClient.invalidateQueries({ queryKey: ['saved-geocaches'] });
    
    // Also refetch the bookmarks
    await refetchBookmarks();
  }, [user, bookmarkEvents, publishEvent, refetchBookmarks, queryClient]);

  return {
    savedCaches,
    isCacheSaved,
    toggleSaveCache,
    unsaveCache: unsaveCacheById,
    clearAllSaved,
    isNostrEnabled: !!user,
    nostrSavedCount: savedCacheCoords.length,
    isLoading: isLoadingBookmarks || isLoadingCaches,
  };
}