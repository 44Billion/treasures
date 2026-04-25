/**
 * Base store implementation with common functionality
 */

import { useCallback, useRef, useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import type { 
  BaseStoreState, 
  StoreConfig, 
  SyncStatus, 
  CacheStats,
  StoreActionResult 
} from './types';

import { TIMEOUTS, POLLING_INTERVALS } from '@/config';
// Performance imports moved to individual stores to avoid circular dependencies

// Default store configuration
const DEFAULT_STORE_CONFIG: StoreConfig = {
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
  const memoizedConfig = useMemo(() => configRef.current, []);

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
    timeout: number = TIMEOUTS.FAST_QUERY * 5
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
      return createErrorResult(handleError(error, context)) as StoreActionResult<T>;
    }
  }, [handleError, createSuccessResult, createErrorResult]);

  // Batch query method
  const batchQuery = useCallback(async (
    filters: any[],
    context: string,
    timeout: number = TIMEOUTS.QUERY
  ): Promise<StoreActionResult<any[]>> => {
    return safeAsyncOperation(async () => {
      // Try to get the current relay URL from the Nostr context
      let currentRelay = 'unknown';
      try {
        // Note: This depends on the nostr implementation having a relay property
        if ('relay' in nostr && (nostr as any).relay) {
          currentRelay = (nostr as any).relay;
        } else if ('pool' in nostr && (nostr as any).pool && 'relays' in (nostr as any).pool) {
          const relays = Object.keys((nostr as any).pool.relays || {});
          currentRelay = relays[0] || 'unknown';
        }
      } catch (e) {
        // Ignore errors when trying to get relay info
      }
      
      const signal = AbortSignal.timeout(timeout);
      
      const events = await nostr.query(filters, { signal });
      return events;
    }, context);
  }, [safeAsyncOperation, nostr]);



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
    if (!memoizedConfig.enableBackgroundSync || syncIntervalRef.current) return;
    
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

  return useMemo(() => ({
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
    batchQuery,
    
    // Background sync
    startBackgroundSync,
    stopBackgroundSync,
    getSyncStatus: () => syncStatusRef.current,
    
    // Cache stats
    getCacheStats,
  }), [
    nostr,
    queryClient,
    memoizedConfig,
    updateConfig,
    createBaseState,
    handleError,
    createSuccessResult,
    createErrorResult,
    safeAsyncOperation,
    invalidateQueries,
    setQueryData,
    getQueryData,
    prefetchQuery,
    batchQuery,
    startBackgroundSync,
    stopBackgroundSync,
    getCacheStats,
  ]);
}

/**
 * Utility function to create query keys with consistent naming
 */
export function createQueryKey(store: string, operation: string, ...params: unknown[]): unknown[] {
  return [store, operation, ...params.filter(p => p !== undefined)];
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

