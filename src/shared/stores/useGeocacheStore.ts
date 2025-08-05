/**
 * Unified Geocache Store
 * Consolidates all geocache-related data management
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { 
  useBaseStore, 
  createQueryKey, 
  batchOperations
} from './baseStore';
import { useMemoizedArray } from './memoization';
import { QueryOptimizer } from './performanceMonitor';
import type { 
  GeocacheStore, 
  GeocacheStoreState, 
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
} from '@/features/geocache/utils/nip-gc';
import { generateVerificationKeyPair } from '@/features/geocache/utils/verification';
import { getGeocachingRelays } from '@/shared/utils/naddrrelays';
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

  // Update state helper - use useCallback to make it stable


  // Main geocaches query with performance optimization and batching
  const geocachesQuery = useQuery({
    queryKey: createQueryKey('geocache', 'list'),
    queryFn: async () => {
      console.log('🚀 Geocache store query starting...', {
        timestamp: new Date().toISOString(),
        userPubkey: user?.pubkey,
        timeout: TIMEOUTS.QUERY
      });
      
      const cacheKey = `geocaches-${user?.pubkey || 'anonymous'}`;
      
      // Check query optimizer cache first
      const cached = QueryOptimizer.getCachedResult<Geocache[]>(cacheKey);
      if (cached) {
        console.log('🎯 Using cached geocaches:', {
          count: cached.length,
          cacheKey
        });
        return cached;
      }

      console.log('📡 Fetching geocaches from relay...', {
        kinds: [NIP_GC_KINDS.GEOCACHE, NIP_GC_KINDS.GEOCACHE_LEGACY],
        limit: QUERY_LIMITS.GEOCACHES,
        queryLimits: QUERY_LIMITS.GEOCACHES,
        fullFilter: {
          kinds: [NIP_GC_KINDS.GEOCACHE, NIP_GC_KINDS.GEOCACHE_LEGACY],
          limit: QUERY_LIMITS.GEOCACHES
        }
      });

      const startTime = Date.now();
      const { data: events } = await baseStore.batchQuery([{
        kinds: [NIP_GC_KINDS.GEOCACHE, NIP_GC_KINDS.GEOCACHE_LEGACY],
        limit: QUERY_LIMITS.GEOCACHES,
      }], 'fetchGeocaches');
      
      const queryDuration = Date.now() - startTime;
      
      console.log('📊 Relay query completed:', {
        eventCount: events?.length || 0,
        queryDuration: `${queryDuration}ms`,
        timeout: TIMEOUTS.QUERY
      });

      const geocaches = (events || [])
        .map(parseGeocacheEvent)
        .filter((g: Geocache | null): g is Geocache => {
          if (!g) return false;
          // Show hidden caches to their creator only
          if (g.hidden && g.pubkey !== user?.pubkey) return false;
          return true;
        })
        .sort((a: Geocache, b: Geocache) => b.created_at - a.created_at);

      console.log('✅ Geocache processing completed:', {
        originalEvents: events?.length || 0,
        validGeocaches: geocaches.length,
        filteredOut: (events?.length || 0) - geocaches.length
      });

      // Cache the result
      QueryOptimizer.setCachedResult(cacheKey, geocaches);
      
      return geocaches;
    },
    staleTime: 300000, // 5 minutes
    gcTime: 1800000, // 30 minutes
    refetchInterval: false, // No background sync
  });

  // Update state when query data changes
  useEffect(() => {
    if (geocachesQuery.data) {
      setState(prev => ({
        ...prev,
        geocaches: geocachesQuery.data,
        isLoading: geocachesQuery.isLoading,
        isError: geocachesQuery.isError,
        error: geocachesQuery.error as Error | null,
        lastUpdate: geocachesQuery.dataUpdatedAt ? new Date(geocachesQuery.dataUpdatedAt) : null,
      }));
    }
  }, [geocachesQuery.data, geocachesQuery.isLoading, geocachesQuery.isError, geocachesQuery.error, geocachesQuery.dataUpdatedAt]);

  // Optimized data fetching actions
  const fetchGeocaches = useCallback(async (): Promise<StoreActionResult<Geocache[]>> => {
    return baseStore.safeAsyncOperation(async () => {
      console.log('🔄 STORE FETCH: Returning current query data...');
      
      // If the query has data, return it directly
      if (geocachesQuery.data) {
        console.log('🔄 STORE FETCH: Using existing query data:', {
          dataLength: geocachesQuery.data.length,
          queryStatus: geocachesQuery.status
        });
        return geocachesQuery.data;
      }
      
      // If no data but query is loading, wait for it
      if (geocachesQuery.isLoading) {
        console.log('🔄 STORE FETCH: Query is loading, waiting for completion...');
        try {
          const result = await geocachesQuery.refetch();
          console.log('🔄 STORE FETCH: Loading query completed:', {
            dataLength: result.data?.length || 0,
            isError: result.isError
          });
          return result.data || [];
        } catch (error) {
          console.error('🔄 STORE FETCH: Loading query failed:', error);
          throw error;
        }
      }
      
      // If no data and not loading, trigger a fresh fetch
      console.log('🔄 STORE FETCH: No data and not loading, triggering fresh fetch...');
      const result = await geocachesQuery.refetch();
      console.log('🔄 STORE FETCH: Fresh fetch completed:', {
        dataLength: result.data?.length || 0,
        isError: result.isError
      });
      return result.data || [];
    }, 'fetchGeocaches');
  }, [geocachesQuery, baseStore]);

  const fetchGeocache = useCallback(async (id: string): Promise<StoreActionResult<Geocache>> => {
    return baseStore.safeAsyncOperation(async () => {
      const { data: events } = await baseStore.batchQuery([{
        ids: [id],
        kinds: [NIP_GC_KINDS.GEOCACHE, NIP_GC_KINDS.GEOCACHE_LEGACY],
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
      const { data: events } = await baseStore.batchQuery([{
        kinds: [NIP_GC_KINDS.GEOCACHE, NIP_GC_KINDS.GEOCACHE_LEGACY],
        authors: [pubkey],
        limit: QUERY_LIMITS.GEOCACHES,
      }], 'fetchUserGeocaches');

      const userGeocaches = (events || [])
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
      // Get current geocaches from state
      const currentGeocaches = state.geocaches;
      const nearby = currentGeocaches.filter(geocache => {
        if (!geocache.location?.lat || !geocache.location?.lng) return false;
        const distance = calculateDistance(lat, lon, geocache.location.lat, geocache.location.lng);
        return distance <= radius;
      });

      return nearby;
    }, 'fetchNearbyGeocaches');
  }, [baseStore, state.geocaches]);

  

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
      // Use provided dTag if available (for claim URLs), otherwise generate new one
      const dTag = geocacheData.dTag || `cache-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
      const relayPreferences = getGeocachingRelays();

      // Generate verification key pair or use provided one
      const verificationKeyPair = (geocacheData as any).verificationKeyPair || await generateVerificationKeyPair();
      
      console.log('🔑 Verification key pair:', {
        hasProvidedKeyPair: !!(geocacheData as any).verificationKeyPair,
        publicKey: verificationKeyPair.publicKey,
        keyPairStructure: verificationKeyPair
      });

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
        images: geocacheData.images,
        relays: relayPreferences,
        verificationPubkey: verificationKeyPair.publicKey,
        hidden: geocacheData.hidden,
        kind: geocacheData.kind, // Pass the kind to determine tag format
      });

      const event = {
        kind: geocacheData.kind || NIP_GC_KINDS.GEOCACHE, // Use provided kind or default to new kind
        content: geocacheData.description.trim(),
        tags,
        created_at: Math.floor(Date.now() / 1000),
      };

      const signedEvent = await user.signer.signEvent(event);
      
      // Publish to relay
      const signal = AbortSignal.timeout(TIMEOUTS.QUERY);
      await baseStore.nostr.event(signedEvent, { signal });

      return { event: signedEvent, verificationKeyPair };
    },
    onSuccess: ({ event }) => {
      // Parse the new geocache from the event
      const newGeocache = parseGeocacheEvent(event);
      if (newGeocache) {
        setState(prev => ({
          ...prev,
          geocaches: [newGeocache, ...prev.geocaches],
          userGeocaches: user?.pubkey === newGeocache.pubkey 
            ? [newGeocache, ...prev.userGeocaches] 
            : prev.userGeocaches,
        }));
      }
    },
  });

  const updateGeocacheMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Geocache> }) => {
      if (!user?.signer) {
        throw new Error('You must be logged in to update geocaches');
      }

      // Find the original geocache
      const originalGeocache = state.geocaches.find(g => g.id === id);
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
        images: updates.images !== undefined ? updates.images : originalGeocache.images,
        hidden: updates.hidden !== undefined ? updates.hidden : originalGeocache.hidden,
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
        images: updatedData.images,
        relays: originalGeocache.relays,
        verificationPubkey: originalGeocache.verificationPubkey, // Preserve verification key
        hidden: updatedData.hidden,
        kind: originalGeocache.kind || NIP_GC_KINDS.GEOCACHE, // Preserve original kind
      });

      const event = {
        kind: originalGeocache.kind || NIP_GC_KINDS.GEOCACHE, // Preserve original kind
        content: updatedData.description,
        tags,
        created_at: Math.floor(Date.now() / 1000),
      };

      const signedEvent = await user.signer.signEvent(event);
      
      // Publish to relay
      const signal = AbortSignal.timeout(TIMEOUTS.QUERY);
      await baseStore.nostr.event(signedEvent, { signal });

      return signedEvent;
    },
    onMutate: () => {
      // Optimistic update handled by React Query
      return {};
    },
    onSuccess: (event, { id }) => {
      // Parse the updated geocache from the event
      const updatedGeocache = parseGeocacheEvent(event);
      if (updatedGeocache) {
        setState(prev => ({
          ...prev,
          geocaches: prev.geocaches.map(g => g.id === id ? updatedGeocache : g),
          userGeocaches: prev.userGeocaches.map(g => g.id === id ? updatedGeocache : g),
        }));
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
      const geocacheToDelete = state.geocaches.find(g => g.id === id);
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

      const signedEvent = await user.signer.signEvent(deletionEvent);

      // Fire-and-forget deletion: send to relays without strict verification
      try {
        await baseStore.nostr.event(signedEvent, { 
          signal: AbortSignal.timeout(TIMEOUTS.DELETE_OPERATION) 
        });
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

  // Selection and navigation
  const selectGeocache = useCallback((geocache: Geocache | null) => {
    setState(prev => ({ ...prev, selectedGeocache: geocache }));
  }, []);

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
      totalItems: state.geocaches.length,
    };
  }, [baseStore, state.geocaches.length]);

  // Background sync removed - no auto-start

  // Memoized geocaches array for performance
  const memoizedGeocaches = useMemoizedArray(state.geocaches, (geocache) => geocache.id);

  // Memoized store object with performance optimizations
  const store = useMemo((): GeocacheStore => ({
    // State with memoized arrays
    ...state,
    geocaches: memoizedGeocaches,
    
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
    memoizedGeocaches,
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