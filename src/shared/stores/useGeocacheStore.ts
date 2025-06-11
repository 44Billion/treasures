/**
 * Unified Geocache Store
 * Consolidates all geocache-related data management
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { 
  useBaseStore, 
  createQueryKey, 
  isDataStale, 
  batchOperations,
  createOptimisticUpdate 
} from './baseStore';
import type { 
  GeocacheStore, 
  GeocacheStoreState, 
  StoreConfig, 
  StoreActionResult 
} from './types';
import type { Geocache } from '@/types/geocache';
import { NIP_GC_KINDS, parseGeocacheEvent } from '@/lib/nip-gc';
import { useCurrentUser } from '@/features/auth/hooks/useCurrentUser';
import { QUERY_LIMITS, TIMEOUTS } from '@/shared/config';
import { calculateDistance } from '@/features/map/utils/geo';

/**
 * Unified geocache store hook
 */
export function useGeocacheStore(config: Partial<StoreConfig> = {}): GeocacheStore {
  const baseStore = useBaseStore('geocache', config);
  const { user } = useCurrentUser();
  
  // Store state
  const [state, setState] = useState<GeocacheStoreState>(() => ({
    ...baseStore.createBaseState(),
    geocaches: [],
    userGeocaches: [],
    nearbyGeocaches: [],
    selectedGeocache: null,
    syncStatus: baseStore.getSyncStatus(),
    cacheStats: baseStore.getCacheStats(),
  }));

  // Update state helper
  const updateState = useCallback((updates: Partial<GeocacheStoreState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  // Main geocaches query
  const geocachesQuery = useQuery({
    queryKey: createQueryKey('geocache', 'list'),
    queryFn: async () => {
      const signal = AbortSignal.timeout(TIMEOUTS.QUERY);
      const events = await baseStore.nostr.query([{
        kinds: [NIP_GC_KINDS.GEOCACHE],
        limit: QUERY_LIMITS.GEOCACHES,
      }], { signal });

      const geocaches = events
        .map(parseGeocacheEvent)
        .filter((g): g is Geocache => {
          if (!g) return false;
          // Show hidden caches to their creator only
          if (g.hidden && g.pubkey !== user?.pubkey) return false;
          return true;
        })
        .sort((a, b) => b.createdAt - a.createdAt);

      return geocaches;
    },
    staleTime: baseStore.config.cacheTimeout,
    gcTime: baseStore.config.cacheTimeout ? baseStore.config.cacheTimeout * 2 : undefined,
    refetchInterval: baseStore.config.enableBackgroundSync ? baseStore.config.syncInterval : false,
  });

  // Update state when query data changes
  useEffect(() => {
    if (geocachesQuery.data) {
      updateState({
        geocaches: geocachesQuery.data,
        isLoading: geocachesQuery.isLoading,
        isError: geocachesQuery.isError,
        error: geocachesQuery.error as Error | null,
        lastUpdate: geocachesQuery.dataUpdatedAt ? new Date(geocachesQuery.dataUpdatedAt) : null,
      });
    }
  }, [geocachesQuery.data, geocachesQuery.isLoading, geocachesQuery.isError, geocachesQuery.error, geocachesQuery.dataUpdatedAt, updateState]);

  // Data fetching actions
  const fetchGeocaches = useCallback(async (): Promise<StoreActionResult<Geocache[]>> => {
    try {
      await geocachesQuery.refetch();
      return baseStore.createSuccessResult(state.geocaches);
    } catch (error) {
      return baseStore.createErrorResult(baseStore.handleError(error, 'fetchGeocaches'));
    }
  }, [geocachesQuery, baseStore, state.geocaches]);

  const fetchGeocache = useCallback(async (id: string): Promise<StoreActionResult<Geocache>> => {
    return baseStore.safeAsyncOperation(async () => {
      // Check if already in cache
      const cached = state.geocaches.find(g => g.id === id);
      if (cached && !isDataStale(state.lastUpdate, baseStore.config.cacheTimeout!)) {
        return cached;
      }

      const signal = AbortSignal.timeout(TIMEOUTS.QUERY);
      const events = await baseStore.nostr.query([{
        ids: [id],
        kinds: [NIP_GC_KINDS.GEOCACHE],
        limit: 1,
      }], { signal });

      const geocache = events[0] ? parseGeocacheEvent(events[0]) : null;
      if (!geocache) {
        throw new Error(`Geocache not found: ${id}`);
      }

      // Update cache
      updateState({
        geocaches: state.geocaches.map(g => g.id === id ? geocache : g),
      });

      return geocache;
    }, 'fetchGeocache');
  }, [baseStore, state.geocaches, state.lastUpdate, updateState]);

  const fetchUserGeocaches = useCallback(async (pubkey: string): Promise<StoreActionResult<Geocache[]>> => {
    return baseStore.safeAsyncOperation(async () => {
      const signal = AbortSignal.timeout(TIMEOUTS.QUERY);
      const events = await baseStore.nostr.query([{
        kinds: [NIP_GC_KINDS.GEOCACHE],
        authors: [pubkey],
        limit: QUERY_LIMITS.GEOCACHES,
      }], { signal });

      const userGeocaches = events
        .map(parseGeocacheEvent)
        .filter((g): g is Geocache => g !== null)
        .sort((a, b) => b.createdAt - a.createdAt);

      updateState({ userGeocaches });
      return userGeocaches;
    }, 'fetchUserGeocaches');
  }, [baseStore, updateState]);

  const fetchNearbyGeocaches = useCallback(async (
    lat: number, 
    lon: number, 
    radius: number = 50
  ): Promise<StoreActionResult<Geocache[]>> => {
    return baseStore.safeAsyncOperation(async () => {
      // Filter from existing geocaches first
      const nearby = state.geocaches.filter(geocache => {
        if (!geocache.latitude || !geocache.longitude) return false;
        const distance = calculateDistance(lat, lon, geocache.latitude, geocache.longitude);
        return distance <= radius;
      });

      updateState({ nearbyGeocaches: nearby });
      return nearby;
    }, 'fetchNearbyGeocaches');
  }, [baseStore, state.geocaches, updateState]);

  // CRUD operations (placeholder implementations)
  const createGeocacheMutation = useMutation({
    mutationFn: async (geocacheData: Partial<Geocache>) => {
      // This would integrate with the existing useCreateGeocache logic
      throw new Error('Create geocache not implemented yet');
    },
    onSuccess: (newGeocache) => {
      updateState({
        geocaches: [newGeocache, ...state.geocaches],
        userGeocaches: user?.pubkey === newGeocache.pubkey 
          ? [newGeocache, ...state.userGeocaches] 
          : state.userGeocaches,
      });
    },
  });

  const updateGeocacheMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Geocache> }) => {
      // This would integrate with the existing useEditGeocache logic
      throw new Error('Update geocache not implemented yet');
    },
    onMutate: ({ id, updates }) => {
      // Optimistic update
      const rollback = createOptimisticUpdate(
        createQueryKey('geocache', 'list'),
        (oldData: Geocache[] | undefined) => {
          if (!oldData) return [];
          return oldData.map(g => g.id === id ? { ...g, ...updates } : g);
        },
        baseStore.queryClient
      );
      return { rollback };
    },
    onError: (error, variables, context) => {
      context?.rollback();
    },
  });

  const deleteGeocacheMutation = useMutation({
    mutationFn: async (id: string) => {
      // This would integrate with the existing useDeleteGeocache logic
      throw new Error('Delete geocache not implemented yet');
    },
    onMutate: (id) => {
      // Optimistic update
      const rollback = createOptimisticUpdate(
        createQueryKey('geocache', 'list'),
        (oldData: Geocache[] | undefined) => {
          if (!oldData) return [];
          return oldData.filter(g => g.id !== id);
        },
        baseStore.queryClient
      );
      return { rollback };
    },
    onError: (error, variables, context) => {
      context?.rollback();
    },
  });

  // Action implementations
  const createGeocache = useCallback(async (geocache: Partial<Geocache>): Promise<StoreActionResult<Geocache>> => {
    try {
      const result = await createGeocacheMutation.mutateAsync(geocache);
      return baseStore.createSuccessResult(result);
    } catch (error) {
      return baseStore.createErrorResult(baseStore.handleError(error, 'createGeocache'));
    }
  }, [createGeocacheMutation, baseStore]);

  const updateGeocache = useCallback(async (id: string, updates: Partial<Geocache>): Promise<StoreActionResult<Geocache>> => {
    try {
      const result = await updateGeocacheMutation.mutateAsync({ id, updates });
      return baseStore.createSuccessResult(result);
    } catch (error) {
      return baseStore.createErrorResult(baseStore.handleError(error, 'updateGeocache'));
    }
  }, [updateGeocacheMutation, baseStore]);

  const deleteGeocache = useCallback(async (id: string): Promise<StoreActionResult<void>> => {
    try {
      await deleteGeocacheMutation.mutateAsync(id);
      return baseStore.createSuccessResult(undefined);
    } catch (error) {
      return baseStore.createErrorResult(baseStore.handleError(error, 'deleteGeocache'));
    }
  }, [deleteGeocacheMutation, baseStore]);

  const batchDeleteGeocaches = useCallback(async (ids: string[]): Promise<StoreActionResult<void>> => {
    try {
      await batchOperations(ids, deleteGeocache, 3);
      return baseStore.createSuccessResult(undefined);
    } catch (error) {
      return baseStore.createErrorResult(baseStore.handleError(error, 'batchDeleteGeocaches'));
    }
  }, [deleteGeocache, baseStore]);

  // Cache management
  const invalidateGeocache = useCallback((id: string) => {
    baseStore.invalidateQueries(createQueryKey('geocache', 'single', id));
  }, [baseStore]);

  const invalidateAll = useCallback(() => {
    baseStore.invalidateQueries(createQueryKey('geocache'));
  }, [baseStore]);

  const refreshGeocache = useCallback(async (id: string): Promise<StoreActionResult<Geocache>> => {
    invalidateGeocache(id);
    return fetchGeocache(id);
  }, [invalidateGeocache, fetchGeocache]);

  const refreshAll = useCallback(async (): Promise<StoreActionResult<Geocache[]>> => {
    invalidateAll();
    return fetchGeocaches();
  }, [invalidateAll, fetchGeocaches]);

  // Selection and navigation
  const selectGeocache = useCallback((geocache: Geocache | null) => {
    updateState({ selectedGeocache: geocache });
  }, [updateState]);

  const preloadGeocache = useCallback(async (id: string): Promise<void> => {
    await baseStore.prefetchQuery(
      createQueryKey('geocache', 'single', id),
      () => fetchGeocache(id).then(result => result.data!)
    );
  }, [baseStore, fetchGeocache]);

  // Background sync
  const backgroundSyncFn = useCallback(async () => {
    await fetchGeocaches();
  }, [fetchGeocaches]);

  const startBackgroundSync = useCallback(() => {
    baseStore.startBackgroundSync(backgroundSyncFn);
    updateState({ syncStatus: baseStore.getSyncStatus() });
  }, [baseStore, backgroundSyncFn, updateState]);

  const stopBackgroundSync = useCallback(() => {
    baseStore.stopBackgroundSync();
    updateState({ syncStatus: baseStore.getSyncStatus() });
  }, [baseStore, updateState]);

  const triggerSync = useCallback(async (): Promise<StoreActionResult<void>> => {
    try {
      await backgroundSyncFn();
      return baseStore.createSuccessResult(undefined);
    } catch (error) {
      return baseStore.createErrorResult(baseStore.handleError(error, 'triggerSync'));
    }
  }, [backgroundSyncFn, baseStore]);

  // Configuration
  const updateConfig = useCallback((newConfig: Partial<StoreConfig>) => {
    baseStore.updateConfig(newConfig);
  }, [baseStore]);

  const getStats = useCallback(() => {
    return {
      ...baseStore.getCacheStats(),
      totalItems: state.geocaches.length,
    };
  }, [baseStore, state.geocaches.length]);

  // Auto-start background sync
  useEffect(() => {
    if (baseStore.config.enableBackgroundSync) {
      startBackgroundSync();
    }
    return () => stopBackgroundSync();
  }, [baseStore.config.enableBackgroundSync, startBackgroundSync, stopBackgroundSync]);

  // Memoized store object
  const store = useMemo((): GeocacheStore => ({
    // State
    ...state,
    
    // Data fetching
    fetchGeocaches,
    fetchGeocache,
    fetchUserGeocaches,
    fetchNearbyGeocaches,
    
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
    
    // Selection and navigation
    selectGeocache,
    preloadGeocache,
    
    // Background sync
    startBackgroundSync,
    stopBackgroundSync,
    triggerSync,
    
    // Configuration
    updateConfig,
    getStats,
  }), [
    state,
    fetchGeocaches,
    fetchGeocache,
    fetchUserGeocaches,
    fetchNearbyGeocaches,
    createGeocache,
    updateGeocache,
    deleteGeocache,
    batchDeleteGeocaches,
    invalidateGeocache,
    invalidateAll,
    refreshGeocache,
    refreshAll,
    selectGeocache,
    preloadGeocache,
    startBackgroundSync,
    stopBackgroundSync,
    triggerSync,
    updateConfig,
    getStats,
  ]);

  return store;
}