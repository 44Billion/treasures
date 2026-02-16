import { useCallback, useMemo } from 'react';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Geocache } from '@/types/geocache';
import {
  NIP_GC_KINDS,
  parseGeocacheEvent,
} from '@/utils/nip-gc';
import { TIMEOUTS } from '@/config';
import { NostrEvent } from '@nostrify/nostrify';


interface SavedCache {
  id: string;
  dTag: string;
  pubkey: string;
  name: string;
  description: string;
  savedAt: number;
  location: {
    lat: number;
    lng: number;
  };
  difficulty: number;
  terrain: number;
  size: "micro" | "small" | "regular" | "large" | "other";
  type: "traditional" | "multi" | "mystery";
  foundCount?: number;
  logCount?: number;
  hidden?: boolean;
  created_at: number;
}

const CACHE_BOOKMARK_KIND = 10003;

export function useSavedCachesStore() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const { mutateAsync: publishEvent } = useNostrPublish();
  const queryClient = useQueryClient();

  const {
    data: bookmarkListEvent,
    isLoading: isLoadingBookmarks,
  } = useQuery({
    queryKey: ['cache-bookmark-list', user?.pubkey],
    queryFn: async c => {
      if (!user?.pubkey) return null;
      const signal = AbortSignal.any([
        c.signal,
        AbortSignal.timeout(TIMEOUTS.QUERY),
      ]);
      const events = await nostr.query(
        [
          {
            kinds: [CACHE_BOOKMARK_KIND],
            authors: [user.pubkey],
            limit: 1,
          },
        ],
        { signal }
      );
      return events.sort((a, b) => b.created_at - a.created_at)[0] || null;
    },
    enabled: !!user?.pubkey,
    staleTime: 30000,
    retry: false,
  });

  const savedCacheCoords = useMemo(() => {
    if (!bookmarkListEvent) return [];
    return bookmarkListEvent.tags
      .filter(tag => tag[0] === 'a' && (tag[1]?.startsWith(`${NIP_GC_KINDS.GEOCACHE}:`) || tag[1]?.startsWith(`${NIP_GC_KINDS.GEOCACHE_LEGACY}:`)))
      .map(tag => tag[1]);
  }, [bookmarkListEvent]);

  const { data: savedGeocacheEvents, isLoading: isLoadingCaches } = useQuery({
    queryKey: ['saved-geocaches', savedCacheCoords],
    queryFn: async c => {
      if (savedCacheCoords.length === 0) return [];
      const signal = AbortSignal.any([
        c.signal,
        AbortSignal.timeout(TIMEOUTS.QUERY),
      ]);
      const filters = savedCacheCoords
        .map(coord => {
          const [kind, pubkey, dTag] = coord?.split(':') || ['', '', ''];
          if (!kind || !pubkey || !dTag) return null;
          return {
            kinds: [parseInt(kind)],
            authors: [pubkey],
            '#d': [dTag],
            limit: 1,
          };
        })
        .filter(Boolean) as Array<{ kinds: number[]; authors: string[]; '#d': string[]; limit: number }>;
      if (filters.length === 0) return [];
      const events = await nostr.query(filters, { signal });
      return events;
    },
    enabled: savedCacheCoords.length > 0,
    staleTime: 60000,
    retry: false,
  });

  const onlineSavedCaches = useMemo(() => {
    if (!savedGeocacheEvents) return [];
    return savedGeocacheEvents
      .map(event => {
        const parsed = parseGeocacheEvent(event);
        if (!parsed) return null;
        return {
          id: parsed.id,
          dTag: parsed.dTag,
          pubkey: event.pubkey,
          name: event.tags.find(tag => tag[0] === 'title')?.[1] || parsed.name,
          description: parsed.description,
          savedAt: parsed.created_at * 1000,
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
      .filter((cache): cache is SavedCache => cache !== null);
  }, [savedGeocacheEvents]);

  

  const savedCaches = useMemo(() => {
    return onlineSavedCaches.sort((a, b) => b.savedAt - a.savedAt);
  }, [onlineSavedCaches]);

  

  const isCacheSavedOffline = useCallback(
    (_naddr: string) => {
      return false;
    },
    []
  );

  const isCacheSaved = useCallback(
    (cacheId: string, dTag?: string, pubkey?: string, kind?: number) => {
      if (!user) return false;
      const actualKind = kind || NIP_GC_KINDS.GEOCACHE;
      const naddr = `${actualKind}:${pubkey}:${dTag}`;
      if (dTag && pubkey) {
        return savedCacheCoords.includes(naddr);
      }
      return savedCaches.some(cache => cache.id === cacheId);
    },
    [savedCacheCoords, savedCaches, user]
  );

  const updateBookmarkList = useCallback(
    async (newTags: string[][]) => {
      if (!user) throw new Error('User must be logged in');
      const newBookmarkEvent = {
        kind: CACHE_BOOKMARK_KIND,
        content: 'A list of saved geocaches from treasures.to',
        tags: newTags,
      };
      await publishEvent(newBookmarkEvent);
      queryClient.setQueryData(
        ['cache-bookmark-list', user.pubkey],
        (oldData: NostrEvent | null) => ({
          ...(oldData || {}),
          ...newBookmarkEvent,
          id: '',
          sig: '',
          created_at: Math.floor(Date.now() / 1000),
        }) as NostrEvent
      );
    },
    [user, publishEvent, queryClient]
  );

  const syncOfflineBookmarks = useCallback(async () => {
    return;
  }, []);



  const saveCache = useCallback(
    async (geocache: Geocache) => {
      const naddr = `${geocache.kind || NIP_GC_KINDS.GEOCACHE}:${geocache.pubkey}:${geocache.dTag}`;
      // Check if already saved using the existing function
      if (isCacheSaved(geocache.id, geocache.dTag, geocache.pubkey, geocache.kind)) return;
      const currentTags = bookmarkListEvent?.tags || [];
      const newTags = [...currentTags, ['a', naddr]];
      await updateBookmarkList(newTags);
    },
    [bookmarkListEvent, updateBookmarkList, isCacheSaved]
  );

  const unsaveCache = useCallback(
    async (geocache: Geocache) => {
      const naddr = `${geocache.kind || NIP_GC_KINDS.GEOCACHE}:${geocache.pubkey}:${geocache.dTag}`;
      
      // Optimistically update the bookmark list event
      queryClient.setQueryData(['cache-bookmark-list', user?.pubkey], (oldData: NostrEvent | null) => {
        if (!oldData) return null;
        return {
          ...oldData,
          tags: oldData.tags.filter(tag => !(tag[0] === 'a' && tag[1] === naddr)),
        };
      });

      const currentTags = bookmarkListEvent?.tags || [];
      const newTags = currentTags.filter(
        tag => !(tag[0] === 'a' && tag[1] === naddr)
      );
      // Publish the update without waiting for it to complete
      updateBookmarkList(newTags).catch(error => {
        console.error("Failed to update bookmark list:", error);
        // Revert optimistic update on failure
        queryClient.invalidateQueries({ queryKey: ['cache-bookmark-list', user?.pubkey] });
      });
    },
    [bookmarkListEvent, updateBookmarkList, user?.pubkey, queryClient]
  );

  const toggleSaveCache = useCallback(
    async (geocache: Geocache) => {
      if (!user) {
        throw new Error('User must be logged in to save caches');
      }
      const isCurrentlySaved = isCacheSaved(
        geocache.id,
        geocache.dTag,
        geocache.pubkey
      );
      if (isCurrentlySaved) {
        await unsaveCache(geocache);
      } else {
        await saveCache(geocache);
      }
    },
    [isCacheSaved, saveCache, unsaveCache, user]
  );

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
    [savedCaches, unsaveCache]
  );

  const clearAllSaved = useCallback(async () => {
    if (!user || !bookmarkListEvent) return;
    const deletionEvent = {
      kind: 5,
      tags: [['e', bookmarkListEvent.id]],
      content: 'Deleting cache bookmark list',
    };
    await publishEvent(deletionEvent);
    queryClient.setQueryData(['cache-bookmark-list', user.pubkey], null);
    await queryClient.invalidateQueries({ queryKey: ['cache-bookmark-list'] });
    await queryClient.invalidateQueries({ queryKey: ['saved-geocaches'] });
  }, [user, bookmarkListEvent, publishEvent, queryClient]);

  return {
    savedCaches,
    isCacheSaved,
    isCacheSavedOffline,
    toggleSaveCache,
    unsaveCache: unsaveCacheById,
    clearAllSaved,
    isNostrEnabled: !!user,
    nostrSavedCount: savedCacheCoords.length,
    isLoading: (isLoadingBookmarks || isLoadingCaches),
    isSyncing: false,
    syncOfflineBookmarks,
  };
}
