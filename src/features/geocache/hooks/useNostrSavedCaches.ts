import { useCallback, useMemo } from 'react';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from '@/features/auth/hooks/useCurrentUser';
import { useNostrPublish } from '@/shared/hooks/useNostrPublish';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Geocache } from '@/types/geocache';
import {
  NIP_GC_KINDS,
  parseGeocacheEvent,
} from '@/features/geocache/utils/nip-gc';
import { TIMEOUTS } from '@/shared/config';
import { NostrEvent } from '@nostrify/nostrify';

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
const CACHE_BOOKMARK_KIND = 10003; // Use kind 10003 (bookmark list) for saved caches

export function useNostrSavedCaches() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const { mutateAsync: publishEvent } = useNostrPublish();
  const queryClient = useQueryClient();

  // Query user's single cache bookmark list
  const {
    data: bookmarkListEvent,
    refetch: refetchBookmarks,
    isLoading: isLoadingBookmarks,
  } = useQuery({
    queryKey: ['cache-bookmark-list', user?.pubkey],
    queryFn: async c => {
      if (!user?.pubkey) return null;

      const signal = AbortSignal.any([
        c.signal,
        AbortSignal.timeout(TIMEOUTS.QUERY),
      ]);

      // Fetch the single kind 10003 list for this user
      const events = await nostr.query(
        [
          {
            kinds: [CACHE_BOOKMARK_KIND],
            authors: [user.pubkey],
            limit: 1,
          },
        ],
        { signal },
      );

      // Return the latest event, or null if none exists
      return events.sort((a, b) => b.created_at - a.created_at)[0] || null;
    },
    enabled: !!user?.pubkey,
    staleTime: 30000, // 30 seconds
    retry: false,
  });

  // Extract saved cache coordinates from the single bookmark list event
  const savedCacheCoords = useMemo(() => {
    if (!bookmarkListEvent) {
      return [];
    }

    // Extract all 'a' tags which are the naddrs of the saved geocaches
    return bookmarkListEvent.tags
      .filter(tag => tag[0] === 'a' && tag[1]?.startsWith(`${NIP_GC_KINDS.GEOCACHE}:`))
      .map(tag => tag[1]);
  }, [bookmarkListEvent]);

  // Query the actual geocache events for saved caches
  const { data: savedGeocacheEvents, isLoading: isLoadingCaches } = useQuery({
    queryKey: ['saved-geocaches', savedCacheCoords],
    queryFn: async c => {
      if (savedCacheCoords.length === 0) return [];

      const signal = AbortSignal.any([
        c.signal,
        AbortSignal.timeout(TIMEOUTS.QUERY),
      ]);

      // Build filters for each saved geocache coordinate
      const filters = savedCacheCoords.map(coord => {
        const [kind, pubkey, dTag] = coord.split(':');
        return {
          kinds: [parseInt(kind || '')],
          authors: [pubkey],
          '#d': [dTag],
          limit: 1,
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

    return savedGeocacheEvents
      .map(event => {
        const parsed = parseGeocacheEvent(event);
        if (!parsed) {
          return null;
        }

        return {
          id: parsed.id,
          dTag: parsed.dTag,
          pubkey: parsed.pubkey,
          name: event.tags.find(tag => tag[0] === 'title')?.[1] || parsed.name,
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
      })
      .filter((cache): cache is SavedCache => cache !== null)
      .sort((a, b) => b.savedAt - a.savedAt); // Sort by most recently saved
  }, [savedGeocacheEvents]);

  // Check if a cache is saved
  const isCacheSaved = useCallback(
    (cacheId: string, dTag?: string, pubkey?: string) => {
      if (!user) return false;

      if (dTag && pubkey) {
        const coord = `${NIP_GC_KINDS.GEOCACHE}:${pubkey}:${dTag}`;
        return savedCacheCoords.includes(coord);
      }

      // Fallback: check by cache ID in saved events
      return savedCaches.some(cache => cache.id === cacheId);
    },
    [savedCacheCoords, savedCaches, user],
  );

  // Function to update the bookmark list
  const updateBookmarkList = useCallback(
    async (newTags: string[][]) => {
      if (!user) throw new Error('User must be logged in');

      const newBookmarkEvent = {
        kind: CACHE_BOOKMARK_KIND,
        content: 'A list of saved geocaches from treasures.to',
        tags: newTags,
      };

      await publishEvent(newBookmarkEvent);

      // Optimistically update the local cache and then refetch
      queryClient.setQueryData(
        ['cache-bookmark-list', user.pubkey],
        (oldData: NostrEvent | null) => {
            return {
                ...(oldData || {}),
                ...newBookmarkEvent,
                id: '', // No ID until it's published
                sig: '', // No sig until it's published
                created_at: Math.floor(Date.now() / 1000),
            } as NostrEvent;
        }
      );

      await refetchBookmarks();
      queryClient.invalidateQueries({ queryKey: ['saved-geocaches'] });
    },
    [user, publishEvent, refetchBookmarks, queryClient],
  );

  // Save cache by adding to the bookmark list
  const saveCache = useCallback(
    async (geocache: Geocache) => {
      const naddr = `${NIP_GC_KINDS.GEOCACHE}:${geocache.pubkey}:${geocache.dTag}`;
      if (savedCacheCoords.includes(naddr)) return;

      const currentTags = bookmarkListEvent?.tags || [];
      const newTags = [...currentTags, ['a', naddr]];
      await updateBookmarkList(newTags);
    },
    [bookmarkListEvent, savedCacheCoords, updateBookmarkList],
  );

  // Unsave cache by removing from the bookmark list
  const unsaveCache = useCallback(
    async (geocache: Geocache) => {
      const naddrToRemove = `${NIP_GC_KINDS.GEOCACHE}:${geocache.pubkey}:${geocache.dTag}`;
      if (!savedCacheCoords.includes(naddrToRemove)) return;

      const currentTags = bookmarkListEvent?.tags || [];
      const newTags = currentTags.filter(
        tag => !(tag[0] === 'a' && tag[1] === naddrToRemove),
      );
      await updateBookmarkList(newTags);
    },
    [bookmarkListEvent, savedCacheCoords, updateBookmarkList],
  );

  // Toggle save cache
  const toggleSaveCache = useCallback(
    async (geocache: Geocache) => {
      if (!user) {
        throw new Error('User must be logged in to save caches');
      }

      const isCurrentlySaved = isCacheSaved(
        geocache.id,
        geocache.dTag,
        geocache.pubkey,
      );

      if (isCurrentlySaved) {
        await unsaveCache(geocache);
      } else {
        await saveCache(geocache);
      }
    },
    [isCacheSaved, saveCache, unsaveCache, user],
  );

  // Unsave cache by ID (for compatibility with existing components)
  const unsaveCacheById = useCallback(
    async (cacheId: string) => {
      const cache = savedCaches.find(c => c.id === cacheId);
      if (cache) {
        const geocache: Geocache = {
          id: cache.id,
          dTag: cache.dTag,
          pubkey: cache.pubkey,
          name: cache.name,
          location: cache.location,
          difficulty: cache.difficulty,
          terrain: cache.terrain,
          size: cache.size as 'micro' | 'small' | 'regular' | 'large' | 'other',
          type: cache.type as 'traditional' | 'multi' | 'mystery',
          created_at: Math.floor(cache.savedAt / 1000),
          description: '',
          foundCount: cache.foundCount || 0,
          logCount: cache.logCount || 0,
        };
        await unsaveCache(geocache);
      }
    },
    [savedCaches, unsaveCache],
  );

  // Clear all saved caches by publishing a kind 5 deletion event
  const clearAllSaved = useCallback(async () => {
    if (!user || !bookmarkListEvent) return;

    // Create a kind 5 deletion event referencing the bookmark list
    const deletionEvent = {
      kind: 5,
      tags: [['e', bookmarkListEvent.id]],
      content: 'Deleting cache bookmark list',
    };

    await publishEvent(deletionEvent);

    // Optimistically remove the bookmark list from the cache
    queryClient.setQueryData(['cache-bookmark-list', user.pubkey], null);

    // Invalidate queries to ensure data is fresh
    await queryClient.invalidateQueries({ queryKey: ['cache-bookmark-list'] });
    await queryClient.invalidateQueries({ queryKey: ['saved-geocaches'] });
  }, [user, bookmarkListEvent, publishEvent, queryClient]);

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
