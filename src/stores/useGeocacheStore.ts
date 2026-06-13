/**
 * Unified Geocache Store
 * Consolidates all geocache-related data management
 */

import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  useBaseStore,
  createQueryKey,
  batchOperations
} from './baseStore';

import type {
  GeocacheStore,
  StoreConfig,
  StoreActionResult
} from './types';
import type { Geocache } from '@/types/geocache';
import {
  NIP_GC_KINDS,
  parseGeocacheEvent,
  buildGeocacheTags,
  validateCacheType,
  validateCacheSize,
  validateCoordinates,
  createGeocacheCoordinate,
  type ValidCacheType,
  type ValidCacheSize
} from '@/utils/nip-gc';
import { generateVerificationKeyPair } from '@/utils/verification';
import { generateCompactDTag } from '@/utils/dTag';
import { useAppContext } from '@/hooks/useAppContext';
import { getEffectiveRelays } from '@/lib/appRelays';
import { resilientPublish } from '@/lib/resilientPublish';
import { signEventWithTimeout } from '@/lib/publishErrors';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { QUERY_LIMITS, TIMEOUTS, LEGACY_GEOCACHE_IDS } from '@/config';
import { calculateDistance } from '@/utils/geo';

/**
 * Unified geocache store hook
 */
export function useGeocacheStore(config: Partial<StoreConfig> = {}): GeocacheStore {
  const baseStore = useBaseStore('geocache', config);
  const { user } = useCurrentUser();
  const { config: appConfig } = useAppContext();

  // Pagination state
  const [hasMore, setHasMore] = useState(true);
  const [oldestTimestamp, setOldestTimestamp] = useState<number | null>(null);

  // Main geocaches query with performance optimization and batching
  const geocachesQuery = useQuery({
    queryKey: createQueryKey('geocache', 'list'),
    queryFn: async () => {
      // Query for specific legacy kind 37515 geocaches by ID
      const { data: legacyGeocacheEvents } = await baseStore.batchQuery([{
        kinds: [NIP_GC_KINDS.GEOCACHE_LEGACY],
        ids: [...LEGACY_GEOCACHE_IDS],
      }], 'fetchLegacyGeocaches');

      // Paginate kind 37516 geocaches until GEOCACHES_MAX total are fetched
      const allNewEvents: typeof legacyGeocacheEvents = [];
      let until: number | undefined = undefined;

      while (allNewEvents.length < QUERY_LIMITS.GEOCACHES_MAX) {
        const filter: Record<string, unknown> = {
          kinds: [NIP_GC_KINDS.GEOCACHE],
          limit: QUERY_LIMITS.GEOCACHES,
        };
        if (until !== undefined) filter['until'] = until;

        const { data: page } = await baseStore.batchQuery([filter], 'fetchGeocaches');
        const pageEvents = page || [];

        allNewEvents.push(...pageEvents);

        // Stop if we got fewer than a full page (no more results)
        if (pageEvents.length < QUERY_LIMITS.GEOCACHES) break;

        // Advance cursor to oldest event in this page
        const oldestInPage = pageEvents.reduce(
          (min: number, e: { created_at: number }) => Math.min(min, e.created_at),
          Infinity
        );
        until = oldestInPage - 1;
      }

      // Combine both result sets
      const events = [...allNewEvents, ...(legacyGeocacheEvents || [])];

      const geocaches = events
        .map(parseGeocacheEvent)
        .filter((g: Geocache | null): g is Geocache => {
          if (!g) return false;
          // Show hidden caches to their creator only
          if (g.hidden && g.pubkey !== user?.pubkey) return false;
          return true;
        })
        .sort((a: Geocache, b: Geocache) => b.created_at - a.created_at);

      // Update pagination state
      if (geocaches.length > 0) {
        const oldest = geocaches[geocaches.length - 1]!.created_at;
        setOldestTimestamp(oldest);
        // Has more only if we hit the total cap exactly
        setHasMore(allNewEvents.length >= QUERY_LIMITS.GEOCACHES_MAX);
      } else {
        setHasMore(false);
      }

      return geocaches;
    },
    staleTime: 300000, // 5 minutes
    gcTime: 1800000, // 30 minutes
    refetchInterval: false, // No background sync
  });

  // Geocache list derived directly from the query cache (single source of truth).
  // Mutations and pagination write into the cache via setQueryData below.
  const geocaches = useMemo(() => geocachesQuery.data ?? [], [geocachesQuery.data]);

  /** Write an updated geocache list into the query cache. */
  const setGeocacheList = useCallback((updater: (prev: Geocache[]) => Geocache[]) => {
    const key = createQueryKey('geocache', 'list');
    const prev = baseStore.getQueryData<Geocache[]>(key) ?? [];
    baseStore.setQueryData(key, updater(prev));
  }, [baseStore]);

  // Optimized data fetching actions
  const fetchGeocaches = useCallback(async (): Promise<StoreActionResult<Geocache[]>> => {
    return baseStore.safeAsyncOperation(async () => {
      // If the query has data, return it directly
      if (geocachesQuery.data) {
        return geocachesQuery.data;
      }

      // If no data but query is loading, wait for it
      if (geocachesQuery.isLoading) {
        const result = await geocachesQuery.refetch();
        return result.data || [];
      }

      // If no data and not loading, trigger a fresh fetch
      const result = await geocachesQuery.refetch();
      return result.data || [];
    }, 'fetchGeocaches');
  }, [geocachesQuery, baseStore]);

  const loadMoreGeocaches = useCallback(async (): Promise<StoreActionResult<Geocache[]>> => {
    return baseStore.safeAsyncOperation(async () => {
      if (!hasMore || !oldestTimestamp) {
        return geocaches;
      }

      // Query for kind 37516 geocaches before the oldest timestamp
      const { data: newGeocacheEvents } = await baseStore.batchQuery([{
        kinds: [NIP_GC_KINDS.GEOCACHE],
        until: oldestTimestamp,
        limit: QUERY_LIMITS.GEOCACHES,
      }], 'loadMoreGeocaches');

      // Query for specific legacy kind 37515 geocaches by ID (if any remain to load)
      const { data: legacyGeocacheEvents } = await baseStore.batchQuery([{
        kinds: [NIP_GC_KINDS.GEOCACHE_LEGACY],
        ids: [...LEGACY_GEOCACHE_IDS],
        until: oldestTimestamp,
      }], 'loadMoreLegacyGeocaches');

      // Combine both result sets
      const events = [...(newGeocacheEvents || []), ...(legacyGeocacheEvents || [])];

      const newGeocaches = events
        .map(parseGeocacheEvent)
        .filter((g: Geocache | null): g is Geocache => {
          if (!g) return false;
          // Show hidden caches to their creator only
          if (g.hidden && g.pubkey !== user?.pubkey) return false;
          return true;
        })
        .sort((a: Geocache, b: Geocache) => b.created_at - a.created_at);

      // Update pagination state
      if (newGeocaches.length > 0) {
        const oldest = newGeocaches[newGeocaches.length - 1]!.created_at;
        setOldestTimestamp(oldest);
        // If we got fewer results than the per-page limit, we've reached the end
        setHasMore(events.length >= QUERY_LIMITS.GEOCACHES);
      } else {
        setHasMore(false);
      }

      // Combine with existing geocaches and write into the query cache
      const allGeocaches = [...geocaches, ...newGeocaches];
      setGeocacheList(() => allGeocaches);

      return allGeocaches;
    }, 'loadMoreGeocaches');
  }, [baseStore, hasMore, oldestTimestamp, geocaches, setGeocacheList, user?.pubkey]);

  const fetchGeocache = useCallback(async (id: string): Promise<StoreActionResult<Geocache>> => {
    return baseStore.safeAsyncOperation(async () => {
      // Determine which kind to search for based on whether this is a legacy ID
      const isLegacyId = LEGACY_GEOCACHE_IDS.includes(id as typeof LEGACY_GEOCACHE_IDS[number]);
      const kindsToSearch = isLegacyId
        ? [NIP_GC_KINDS.GEOCACHE_LEGACY]
        : [NIP_GC_KINDS.GEOCACHE];

      const { data: events } = await baseStore.batchQuery([{
        ids: [id],
        kinds: kindsToSearch,
        limit: 1,
      }], 'fetchGeocache');

      const geocache = events?.[0] ? parseGeocacheEvent(events[0]) : null;
      if (!geocache) {
        throw new Error(`Geocache not found: ${id}`);
      }

      return geocache;
    }, 'fetchGeocache');
  }, [baseStore]);

  const fetchUserGeocaches = useCallback(async (pubkey: string): Promise<StoreActionResult<Geocache[]>> => {
    return baseStore.safeAsyncOperation(async () => {
      // Search kind 37516 by author
      const { data: newEvents } = await baseStore.batchQuery([{
        kinds: [NIP_GC_KINDS.GEOCACHE],
        authors: [pubkey],
        limit: QUERY_LIMITS.GEOCACHES,
      }], 'fetchUserGeocaches');

      // Also check if any legacy IDs belong to this author
      const { data: legacyEvents } = await baseStore.batchQuery([{
        kinds: [NIP_GC_KINDS.GEOCACHE_LEGACY],
        ids: [...LEGACY_GEOCACHE_IDS],
        authors: [pubkey],
      }], 'fetchUserLegacyGeocaches');

      const events = [...(newEvents || []), ...(legacyEvents || [])];

      const userGeocaches = events
        .map(parseGeocacheEvent)
        .filter((g: Geocache | null): g is Geocache => g !== null)
        .sort((a: Geocache, b: Geocache) => b.created_at - a.created_at);

      return userGeocaches;
    }, 'fetchUserGeocaches');
  }, [baseStore]);

  const fetchNearbyGeocaches = useCallback(async (
    lat: number,
    lon: number,
    radius: number = 50
  ): Promise<StoreActionResult<Geocache[]>> => {
    return baseStore.safeAsyncOperation(async () => {
      const nearby = geocaches.filter(geocache => {
        if (!geocache.location?.lat || !geocache.location?.lng) return false;
        const distance = calculateDistance(lat, lon, geocache.location.lat, geocache.location.lng);
        return distance <= radius;
      });

      return nearby;
    }, 'fetchNearbyGeocaches');
  }, [baseStore, geocaches]);



  // CRUD operations - Real implementations
  const createGeocacheMutation = useMutation({
    mutationFn: async (geocacheData: Partial<Geocache>) => {
      if (!user?.signer) {
        throw new Error('You must be logged in to create geocaches');
      }

      // Validate data
      if (!geocacheData.name?.trim()) {
        throw new Error("Cache name is required");
      }
      if (!geocacheData.description?.trim()) {
        throw new Error("Cache description is required");
      }
      if (!geocacheData.location || typeof geocacheData.location.lat !== 'number' || typeof geocacheData.location.lng !== 'number') {
        throw new Error("Valid location coordinates are required");
      }
      if (!geocacheData.difficulty || geocacheData.difficulty < 1 || geocacheData.difficulty > 5) {
        throw new Error("Difficulty must be between 1 and 5");
      }
      if (!geocacheData.terrain || geocacheData.terrain < 1 || geocacheData.terrain > 5) {
        throw new Error("Terrain must be between 1 and 5");
      }

      // Validate inputs according to NIP-GC
      if (!geocacheData.type || !validateCacheType(geocacheData.type)) {
        throw new Error(`Invalid cache type: ${geocacheData.type}`);
      }
      if (!geocacheData.size || !validateCacheSize(geocacheData.size)) {
        throw new Error(`Invalid cache size: ${geocacheData.size}`);
      }
      if (!validateCoordinates(geocacheData.location.lat, geocacheData.location.lng)) {
        throw new Error(`Invalid coordinates: ${geocacheData.location.lat}, ${geocacheData.location.lng}`);
      }

      // Create the geocache event according to NIP-GC
      // Use provided dTag if available (for claim URLs), otherwise generate a new
      // 6-char random hex d-tag (compact and URL-friendly).
      const dTag = geocacheData.dTag || generateCompactDTag();
      // Relay hints for the event's `r` tags: the user's effective write relays
      const relayPreferences = getEffectiveRelays(appConfig.relayMetadata, appConfig.useAppRelays)
        .relays.filter((r) => r.write)
        .map((r) => r.url)
        .slice(0, 4);

      // Generate verification key pair or use provided one
      const verificationKeyPair = (geocacheData as any).verificationKeyPair || await generateVerificationKeyPair();

      // Build tags using consolidated utility
      const tags = buildGeocacheTags({
        dTag,
        name: geocacheData.name.trim(),
        location: geocacheData.location,
        difficulty: geocacheData.difficulty,
        terrain: geocacheData.terrain,
        size: geocacheData.size as ValidCacheSize,
        type: geocacheData.type as ValidCacheType,
        hint: geocacheData.hint,
        mission: geocacheData.mission,
        images: geocacheData.images,
        contentWarning: geocacheData.contentWarning,
        relays: relayPreferences,
        verificationPubkey: verificationKeyPair.publicKey,
        hidden: geocacheData.hidden,
        status: geocacheData.status,
        modifiers: geocacheData.modifiers,
        ftfWinner: geocacheData.ftfWinner,
        kind: geocacheData.kind, // Pass the kind to determine tag format
      });

      const event = {
        kind: geocacheData.kind || NIP_GC_KINDS.GEOCACHE, // Use provided kind or default to new kind
        content: geocacheData.description.trim(),
        tags,
        created_at: Math.floor(Date.now() / 1000),
      };

      const signedEvent = await signEventWithTimeout(
        () => user.signer.signEvent(event),
        TIMEOUTS.SIGNER,
      );

      // Publish with retry + offline queueing (shared primitive). A failed
      // delivery on a flaky connection is queued and re-broadcast when
      // connectivity returns instead of being lost.
      await resilientPublish(baseStore.nostr, signedEvent);

      return { event: signedEvent, verificationKeyPair };
    },
    onSuccess: ({ event }) => {
      // Parse the new geocache from the event and prepend to the cached list
      const newGeocache = parseGeocacheEvent(event);
      if (newGeocache) {
        setGeocacheList(prev => [newGeocache, ...prev]);
      }
    },
  });

  const updateGeocacheMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Geocache> }) => {
      if (!user?.signer) {
        throw new Error('You must be logged in to update geocaches');
      }

      // Find the original geocache
      const originalGeocache = geocaches.find(g => g.id === id);
      if (!originalGeocache) {
        throw new Error("Geocache not found");
      }

      // Validate data according to NIP-GC
      if (updates.name !== undefined && !updates.name?.trim()) {
        throw new Error("Cache name is required");
      }
      if (updates.description !== undefined && !updates.description?.trim()) {
        throw new Error("Cache description is required");
      }
      if (updates.difficulty !== undefined && (updates.difficulty < 1 || updates.difficulty > 5)) {
        throw new Error("Difficulty must be between 1 and 5");
      }
      if (updates.terrain !== undefined && (updates.terrain < 1 || updates.terrain > 5)) {
        throw new Error("Terrain must be between 1 and 5");
      }

      // Validate inputs according to NIP-GC
      if (updates.type !== undefined && !validateCacheType(updates.type)) {
        throw new Error(`Invalid cache type: ${updates.type}`);
      }
      if (updates.size !== undefined && !validateCacheSize(updates.size)) {
        throw new Error(`Invalid cache size: ${updates.size}`);
      }

      // Merge updates with original data
      const updatedData = {
        name: updates.name?.trim() || originalGeocache.name,
        description: updates.description?.trim() || originalGeocache.description,
        location: updates.location || originalGeocache.location,
        difficulty: updates.difficulty || originalGeocache.difficulty,
        terrain: updates.terrain || originalGeocache.terrain,
        size: updates.size || originalGeocache.size,
        type: updates.type || originalGeocache.type,
        hint: updates.hint !== undefined ? updates.hint : originalGeocache.hint,
        mission: updates.mission !== undefined ? updates.mission : originalGeocache.mission,
        images: updates.images !== undefined ? updates.images : originalGeocache.images,
        contentWarning: updates.contentWarning !== undefined ? updates.contentWarning : originalGeocache.contentWarning,
        hidden: updates.hidden !== undefined ? updates.hidden : originalGeocache.hidden,
        status: updates.status !== undefined ? updates.status : originalGeocache.status,
        modifiers: updates.modifiers !== undefined ? updates.modifiers : originalGeocache.modifiers,
        ftfWinner: updates.ftfWinner !== undefined ? updates.ftfWinner : originalGeocache.ftfWinner,
      };

      // Build tags using consolidated utility
      const tags = buildGeocacheTags({
        dTag: originalGeocache.dTag, // Use original d-tag for replacement
        name: updatedData.name,
        location: updatedData.location,
        difficulty: updatedData.difficulty,
        terrain: updatedData.terrain,
        size: updatedData.size as ValidCacheSize,
        type: updatedData.type as ValidCacheType,
        hint: updatedData.hint,
        mission: updatedData.mission,
        images: updatedData.images,
        contentWarning: updatedData.contentWarning,
        relays: originalGeocache.relays,
        verificationPubkey: originalGeocache.verificationPubkey, // Preserve verification key
        hidden: updatedData.hidden,
        status: updatedData.status,
        modifiers: updatedData.modifiers,
        ftfWinner: updatedData.ftfWinner,
        kind: originalGeocache.kind || NIP_GC_KINDS.GEOCACHE, // Preserve original kind
      });

      const event = {
        kind: originalGeocache.kind || NIP_GC_KINDS.GEOCACHE, // Preserve original kind
        content: updatedData.description,
        tags,
        created_at: Math.floor(Date.now() / 1000),
      };

      const signedEvent = await signEventWithTimeout(
        () => user.signer.signEvent(event),
        TIMEOUTS.SIGNER,
      );

      // Publish with retry + offline queueing (shared primitive).
      await resilientPublish(baseStore.nostr, signedEvent);

      return signedEvent;
    },
    onMutate: () => {
      // Optimistic update handled by React Query
      return {};
    },
    onSuccess: (event, { id }) => {
      // Parse the updated geocache from the event and replace it in the cached list
      const updatedGeocache = parseGeocacheEvent(event);
      if (updatedGeocache) {
        setGeocacheList(prev => prev.map(g => g.id === id ? updatedGeocache : g));
      }
    },
    onError: () => {
      // Error handled by React Query
    },
  });

  const deleteGeocacheMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      if (!user?.signer) {
        throw new Error('You must be logged in to delete geocaches');
      }

      // Find the geocache to delete
      const geocacheToDelete = geocaches.find(g => g.id === id);
      if (!geocacheToDelete) {
        throw new Error("Geocache not found");
      }

      // Create deletion event - we need to get the actual kind from the original event
      // For now, we'll use the new kind as default since we don't store the original kind
      const deletionTags: string[][] = [
        ['e', id],
        ['k', NIP_GC_KINDS.GEOCACHE.toString()],
        ['client', 'treasures'],
      ];

      // Add coordinate tag for replaceable events
      if (geocacheToDelete.dTag) {
        const coordinate = createGeocacheCoordinate(geocacheToDelete.pubkey, geocacheToDelete.dTag);
        deletionTags.push(['a', coordinate]);
      }

      const deletionEvent = {
        kind: 5,
        content: reason || 'Geocache deleted by author',
        tags: deletionTags,
        created_at: Math.floor(Date.now() / 1000),
      };

      const signedEvent = await signEventWithTimeout(
        () => user.signer.signEvent(deletionEvent),
        TIMEOUTS.SIGNER,
      );

      // Fire-and-forget deletion: publish with retry + offline queueing, but
      // never block the optimistic local removal if relays are unreachable.
      try {
        await resilientPublish(baseStore.nostr, signedEvent);
      } catch (publishError) {
        // Don't throw here - the event was signed and some relays might have received it
        console.warn('Deletion event publish warning (continuing optimistically):', publishError);
      }

      return signedEvent;
    },
    onMutate: () => {
      // Optimistic update handled by React Query
      return {};
    },
    onError: () => {
      // Error handled by React Query
    },
  });

  // Action implementations
  const createGeocache = useCallback(async (geocache: Partial<Geocache>): Promise<StoreActionResult<{ event: any; geocache: Geocache }>> => {
    try {
      const { event } = await createGeocacheMutation.mutateAsync(geocache);
      const newGeocache = parseGeocacheEvent(event);
      if (!newGeocache) {
        throw new Error('Failed to parse created geocache');
      }
      return baseStore.createSuccessResult({ event, geocache: newGeocache });
    } catch (error) {
      return baseStore.createErrorResult(baseStore.handleError(error, 'createGeocache')) as StoreActionResult<{ event: any; geocache: Geocache }>;
    }
  }, [createGeocacheMutation, baseStore]);

  const updateGeocache = useCallback(async (id: string, updates: Partial<Geocache>): Promise<StoreActionResult<Geocache>> => {
    try {
      const event = await updateGeocacheMutation.mutateAsync({ id, updates });
      const updatedGeocache = parseGeocacheEvent(event);
      if (!updatedGeocache) {
        throw new Error('Failed to parse updated geocache');
      }
      return baseStore.createSuccessResult(updatedGeocache);
    } catch (error) {
      return baseStore.createErrorResult(baseStore.handleError(error, 'updateGeocache')) as StoreActionResult<Geocache>;
    }
  }, [updateGeocacheMutation, baseStore]);

  const deleteGeocache = useCallback(async (id: string, reason?: string): Promise<StoreActionResult<void>> => {
    try {
      await deleteGeocacheMutation.mutateAsync({ id, reason });
      return baseStore.createSuccessResult(undefined);
    } catch (error) {
      return baseStore.createErrorResult(baseStore.handleError(error, 'deleteGeocache')) as StoreActionResult<void>;
    }
  }, [deleteGeocacheMutation, baseStore]);

  const batchDeleteGeocaches = useCallback(async (ids: string[], reason?: string): Promise<StoreActionResult<void>> => {
    try {
      await batchOperations(
        ids,
        async (id) => {
          const result = await deleteGeocache(id, reason);
          if (!result.success) {
            throw result.error || new Error(`Failed to delete geocache ${id}`);
          }
        },
        3 // Batch size
      );
      return baseStore.createSuccessResult(undefined);
    } catch (error) {
      return baseStore.createErrorResult(baseStore.handleError(error, 'batchDeleteGeocaches')) as StoreActionResult<void>;
    }
  }, [deleteGeocache, baseStore]);

  // Cache management
  const invalidateGeocache = useCallback((id: string) => {
    baseStore.invalidateQueries(createQueryKey('geocache', 'single', id));
  }, [baseStore]);

  const invalidateAll = useCallback(() => {
    baseStore.invalidateQueries(createQueryKey('geocache', 'list'));
  }, [baseStore]);

  const refreshGeocache = useCallback(async (id: string): Promise<StoreActionResult<Geocache>> => {
    invalidateGeocache(id);
    return fetchGeocache(id);
  }, [invalidateGeocache, fetchGeocache]);

  const refreshAll = useCallback(async (): Promise<StoreActionResult<Geocache[]>> => {
    invalidateAll();
    return fetchGeocaches();
  }, [invalidateAll, fetchGeocaches]);

  // Navigation
  const preloadGeocache = useCallback(async (id: string): Promise<void> => {
    await baseStore.prefetchQuery(
      createQueryKey('geocache', 'single', id),
      () => fetchGeocache(id).then(result => result.data!)
    );
  }, [baseStore, fetchGeocache]);

  // Background sync - removed for simplicity
  const startBackgroundSync = useCallback(() => {
    // No-op - background sync removed
  }, []);

  const stopBackgroundSync = useCallback(() => {
    // No-op - background sync removed
  }, []);

  const triggerSync = useCallback(async (): Promise<StoreActionResult<void>> => {
    try {
      await geocachesQuery.refetch();
      return baseStore.createSuccessResult(undefined);
    } catch (error) {
      return baseStore.createErrorResult(baseStore.handleError(error, 'triggerSync')) as StoreActionResult<void>;
    }
  }, [geocachesQuery, baseStore]);

  // Configuration
  const updateConfig = useCallback((newConfig: Partial<StoreConfig>) => {
    baseStore.updateConfig(newConfig);
  }, [baseStore]);

  const getStats = useCallback(() => {
    return {
      ...baseStore.getCacheStats(),
      totalItems: geocaches.length,
    };
  }, [baseStore, geocaches.length]);

  // Background sync removed - no auto-start

  // Memoized store object — all state is derived from the TanStack Query cache,
  // so consumers re-render only when the underlying query data changes.
  const store = useMemo((): GeocacheStore => ({
    // Base state (derived from the query)
    geocaches,
    isLoading: geocachesQuery.isLoading,
    isError: geocachesQuery.isError,
    error: (geocachesQuery.error as Error | null) ?? null,
    lastUpdate: geocachesQuery.dataUpdatedAt ? new Date(geocachesQuery.dataUpdatedAt) : null,
    syncStatus: baseStore.getSyncStatus(),
    cacheStats: baseStore.getCacheStats(),

    // Data fetching
    fetchGeocaches,
    fetchGeocache,
    fetchUserGeocaches,
    fetchNearbyGeocaches,
    loadMoreGeocaches,

    // CRUD operations
    createGeocache,
    updateGeocache,
    deleteGeocache,
    batchDeleteGeocaches,

    // Cache management
    invalidateGeocache,
    invalidateAll,
    refreshGeocache,
    refreshAll,

    // Navigation
    preloadGeocache,

    // Background sync
    startBackgroundSync,
    stopBackgroundSync,
    triggerSync,

    // Configuration
    updateConfig,
    getStats,

    // Pagination
    hasMore,
  }), [
    geocaches,
    geocachesQuery.isLoading,
    geocachesQuery.isError,
    geocachesQuery.error,
    geocachesQuery.dataUpdatedAt,
    baseStore,
    fetchGeocaches,
    fetchGeocache,
    fetchUserGeocaches,
    fetchNearbyGeocaches,
    loadMoreGeocaches,

    createGeocache,
    updateGeocache,
    deleteGeocache,
    batchDeleteGeocaches,
    invalidateGeocache,
    invalidateAll,
    refreshGeocache,
    refreshAll,
    preloadGeocache,
    startBackgroundSync,
    stopBackgroundSync,
    triggerSync,
    updateConfig,
    getStats,
    hasMore,
  ]);

  return store;
}