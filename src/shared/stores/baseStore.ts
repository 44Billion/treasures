/**
 * Base store implementation with common functionality
 */

import { useCallback, useRef, useEffect } from 'react';
import { useQueryClient, QueryClient } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import type { 
  BaseStoreState, 
  StoreConfig, 
  SyncStatus, 
  CacheStats,
  StoreActionResult 
} from './types';
import { TIMEOUTS, POLLING_INTERVALS } from '@/shared/config';
// Performance imports moved to individual stores to avoid circular dependencies

// Default store configuration
export const DEFAULT_STORE_CONFIG: StoreConfig = {
  enableBackgroundSync: true,
  enablePrefetching: true,
  syncInterval: POLLING_INTERVALS.BACKGROUND_SYNC,
  cacheTimeout: 300000, // 5 minutes
  maxCacheSize: 1000,
};

/**
 * Base store hook with common functionality
 */
export function useBaseStore(
  storeName: string,
  initialConfig: Partial<StoreConfig> = {}
) {
  const { nostr } = useNostr();
  const queryClient = useQueryClient();
  const configRef = useRef<StoreConfig>({ ...DEFAULT_STORE_CONFIG, ...initialConfig });
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const syncStatusRef = useRef<SyncStatus>({
    isActive: false,
    lastSync: null,
    errorCount: 0,
  });

  // Memoized config to prevent unnecessary re-renders
  const memoizedConfig = configRef.current;

  // Base state management
  const createBaseState = useCallback((): BaseStoreState => ({
    isLoading: false,
    isError: false,
    error: null,
    lastUpdate: null,
  }), []);

  // Error handling
  const handleError = useCallback((error: unknown, context: string): Error => {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    console.error(`[${storeName}] ${context}:`, errorObj);
    syncStatusRef.current.errorCount++;
    return errorObj;
  }, [storeName]);

  // Success result helper
  const createSuccessResult = useCallback(<T>(data: T): StoreActionResult<T> => ({
    success: true,
    data,
  }), []);

  // Error result helper
  const createErrorResult = useCallback((error: Error): StoreActionResult => ({
    success: false,
    error,
  }), []);

  // Safe async operation wrapper
  const safeAsyncOperation = useCallback(async <T>(
    operation: () => Promise<T>,
    context: string,
    timeout: number = TIMEOUTS.QUERY
  ): Promise<StoreActionResult<T>> => {
    try {
      const signal = AbortSignal.timeout(timeout);
      const result = await Promise.race([
        operation(),
        new Promise<never>((_, reject) => {
          signal.addEventListener('abort', () => reject(new Error('Operation timeout')));
        })
      ]);
      return createSuccessResult(result);
    } catch (error) {
      return createErrorResult(handleError(error, context));
    }
  }, [handleError, createSuccessResult, createErrorResult]);

  // Query client helpers
  const invalidateQueries = useCallback((queryKey: unknown[]) => {
    queryClient.invalidateQueries({ queryKey });
  }, [queryClient]);

  const setQueryData = useCallback(<T>(queryKey: unknown[], data: T) => {
    queryClient.setQueryData(queryKey, data);
  }, [queryClient]);

  const getQueryData = useCallback(<T>(queryKey: unknown[]): T | undefined => {
    return queryClient.getQueryData(queryKey);
  }, [queryClient]);

  const prefetchQuery = useCallback(async <T>(
    queryKey: unknown[],
    queryFn: () => Promise<T>,
    staleTime?: number
  ) => {
    await queryClient.prefetchQuery({
      queryKey,
      queryFn,
      staleTime: staleTime || memoizedConfig.cacheTimeout,
    });
  }, [queryClient, memoizedConfig.cacheTimeout]);

  // Background sync management
  const startBackgroundSync = useCallback((syncFn: () => Promise<void>) => {
    if (!memoizedConfig.enableBackgroundSync) return;
    
    if (syncIntervalRef.current) {
      clearInterval(syncIntervalRef.current);
    }

    syncStatusRef.current.isActive = true;
    
    syncIntervalRef.current = setInterval(async () => {
      try {
        await syncFn();
        syncStatusRef.current.lastSync = new Date();
        syncStatusRef.current.errorCount = Math.max(0, syncStatusRef.current.errorCount - 1);
      } catch (error) {
        handleError(error, 'Background sync');
      }
    }, memoizedConfig.syncInterval);
  }, [handleError, memoizedConfig]);

  const stopBackgroundSync = useCallback(() => {
    if (syncIntervalRef.current) {
      clearInterval(syncIntervalRef.current);
      syncIntervalRef.current = null;
    }
    syncStatusRef.current.isActive = false;
  }, []);

  // Configuration management
  const updateConfig = useCallback((newConfig: Partial<StoreConfig>) => {
    configRef.current = { ...configRef.current, ...newConfig };
    
    // Restart background sync if interval changed
    if (newConfig.syncInterval && syncIntervalRef.current) {
      stopBackgroundSync();
      // Note: Caller needs to restart sync with their sync function
    }
  }, [stopBackgroundSync]);

  // Cache statistics
  const getCacheStats = useCallback((): CacheStats => {
    return {
      totalItems: 0, // To be overridden by specific stores
      hitRate: 0,
      memoryUsage: 0,
      lastCleanup: null,
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopBackgroundSync();
    };
  }, [stopBackgroundSync]);

  return {
    // Core dependencies
    nostr,
    queryClient,
    
    // Configuration
    config: memoizedConfig,
    updateConfig,
    
    // State helpers
    createBaseState,
    
    // Error handling
    handleError,
    createSuccessResult,
    createErrorResult,
    safeAsyncOperation,
    
    // Query helpers
    invalidateQueries,
    setQueryData,
    getQueryData,
    prefetchQuery,
    
    // Background sync
    startBackgroundSync,
    stopBackgroundSync,
    getSyncStatus: () => syncStatusRef.current,
    
    // Cache stats
    getCacheStats,
  };
}

/**
 * Utility function to create query keys with consistent naming
 */
export function createQueryKey(store: string, operation: string, ...params: unknown[]): unknown[] {
  return [store, operation, ...params.filter(p => p !== undefined)];
}

/**
 * Utility function to check if data is stale
 */
export function isDataStale(lastUpdate: Date | null, maxAge: number): boolean {
  if (!lastUpdate) return true;
  return Date.now() - lastUpdate.getTime() > maxAge;
}

/**
 * Utility function to batch operations
 */
export async function batchOperations<T, R>(
  items: T[],
  operation: (item: T) => Promise<R>,
  batchSize: number = 5
): Promise<R[]> {
  const results: R[] = [];
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.allSettled(
      batch.map(item => operation(item))
    );
    
    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      }
    }
  }
  
  return results;
}

/**
 * Utility function for optimistic updates
 */
export function createOptimisticUpdate<T>(
  queryKey: unknown[],
  updateFn: (oldData: T | undefined) => T,
  queryClient: QueryClient
) {
  const previousData = queryClient.getQueryData(queryKey);
  
  // Apply optimistic update
  queryClient.setQueryData(queryKey, updateFn(previousData));
  
  // Return rollback function
  return () => {
    queryClient.setQueryData(queryKey, previousData);
  };
}