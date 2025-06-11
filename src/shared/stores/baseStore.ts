/**
 * Base store implementation with common functionality
 */

import { useCallback, useRef, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import type { 
  BaseStoreState, 
  StoreConfig, 
  SyncStatus, 
  CacheStats,
  StoreActionResult 
} from './types';
import { TIMEOUTS, POLLING_INTERVALS } from '@/shared/config/constants';

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
      const signal = AbortSignal.timeout(timeout);\n      const result = await Promise.race([\n        operation(),\n        new Promise<never>((_, reject) => {\n          signal.addEventListener('abort', () => reject(new Error('Operation timeout')));\n        })\n      ]);\n      return createSuccessResult(result);\n    } catch (error) {\n      return createErrorResult(handleError(error, context));\n    }\n  }, [handleError, createSuccessResult, createErrorResult]);\n\n  // Query client helpers\n  const invalidateQueries = useCallback((queryKey: unknown[]) => {\n    queryClient.invalidateQueries({ queryKey });\n  }, [queryClient]);\n\n  const setQueryData = useCallback(<T>(queryKey: unknown[], data: T) => {\n    queryClient.setQueryData(queryKey, data);\n  }, [queryClient]);\n\n  const getQueryData = useCallback(<T>(queryKey: unknown[]): T | undefined => {\n    return queryClient.getQueryData(queryKey);\n  }, [queryClient]);\n\n  const prefetchQuery = useCallback(async <T>(\n    queryKey: unknown[],\n    queryFn: () => Promise<T>,\n    staleTime?: number\n  ) => {\n    await queryClient.prefetchQuery({\n      queryKey,\n      queryFn,\n      staleTime: staleTime || configRef.current.cacheTimeout,\n    });\n  }, [queryClient]);\n\n  // Background sync management\n  const startBackgroundSync = useCallback((syncFn: () => Promise<void>) => {\n    if (!configRef.current.enableBackgroundSync) return;\n    \n    if (syncIntervalRef.current) {\n      clearInterval(syncIntervalRef.current);\n    }\n\n    syncStatusRef.current.isActive = true;\n    \n    syncIntervalRef.current = setInterval(async () => {\n      try {\n        await syncFn();\n        syncStatusRef.current.lastSync = new Date();\n        syncStatusRef.current.errorCount = Math.max(0, syncStatusRef.current.errorCount - 1);\n      } catch (error) {\n        handleError(error, 'Background sync');\n      }\n    }, configRef.current.syncInterval);\n  }, [handleError]);\n\n  const stopBackgroundSync = useCallback(() => {\n    if (syncIntervalRef.current) {\n      clearInterval(syncIntervalRef.current);\n      syncIntervalRef.current = null;\n    }\n    syncStatusRef.current.isActive = false;\n  }, []);\n\n  // Configuration management\n  const updateConfig = useCallback((newConfig: Partial<StoreConfig>) => {\n    configRef.current = { ...configRef.current, ...newConfig };\n    \n    // Restart background sync if interval changed\n    if (newConfig.syncInterval && syncIntervalRef.current) {\n      stopBackgroundSync();\n      // Note: Caller needs to restart sync with their sync function\n    }\n  }, [stopBackgroundSync]);\n\n  // Cache statistics\n  const getCacheStats = useCallback((): CacheStats => {\n    // This would be implemented by each specific store\n    return {\n      totalItems: 0,\n      hitRate: 0,\n      memoryUsage: 0,\n      lastCleanup: null,\n    };\n  }, []);\n\n  // Cleanup on unmount\n  useEffect(() => {\n    return () => {\n      stopBackgroundSync();\n    };\n  }, [stopBackgroundSync]);\n\n  return {\n    // Core dependencies\n    nostr,\n    queryClient,\n    \n    // Configuration\n    config: configRef.current,\n    updateConfig,\n    \n    // State helpers\n    createBaseState,\n    \n    // Error handling\n    handleError,\n    createSuccessResult,\n    createErrorResult,\n    safeAsyncOperation,\n    \n    // Query helpers\n    invalidateQueries,\n    setQueryData,\n    getQueryData,\n    prefetchQuery,\n    \n    // Background sync\n    startBackgroundSync,\n    stopBackgroundSync,\n    getSyncStatus: () => syncStatusRef.current,\n    \n    // Cache stats\n    getCacheStats,\n  };\n}\n\n/**\n * Utility function to create query keys with consistent naming\n */\nexport function createQueryKey(store: string, operation: string, ...params: unknown[]): unknown[] {\n  return [store, operation, ...params.filter(p => p !== undefined)];\n}\n\n/**\n * Utility function to check if data is stale\n */\nexport function isDataStale(lastUpdate: Date | null, maxAge: number): boolean {\n  if (!lastUpdate) return true;\n  return Date.now() - lastUpdate.getTime() > maxAge;\n}\n\n/**\n * Utility function to batch operations\n */\nexport async function batchOperations<T, R>(\n  items: T[],\n  operation: (item: T) => Promise<R>,\n  batchSize: number = 5\n): Promise<R[]> {\n  const results: R[] = [];\n  \n  for (let i = 0; i < items.length; i += batchSize) {\n    const batch = items.slice(i, i + batchSize);\n    const batchResults = await Promise.allSettled(\n      batch.map(item => operation(item))\n    );\n    \n    for (const result of batchResults) {\n      if (result.status === 'fulfilled') {\n        results.push(result.value);\n      }\n    }\n  }\n  \n  return results;\n}\n\n/**\n * Utility function for optimistic updates\n */\nexport function createOptimisticUpdate<T>(\n  queryKey: unknown[],\n  updateFn: (oldData: T | undefined) => T,\n  queryClient: any\n) {\n  const previousData = queryClient.getQueryData(queryKey);\n  \n  // Apply optimistic update\n  queryClient.setQueryData(queryKey, updateFn(previousData));\n  \n  // Return rollback function\n  return () => {\n    queryClient.setQueryData(queryKey, previousData);\n  };\n}