/**
 * Unified data management hook that coordinates all polling, prefetching, and caching
 * This is the main hook that components should use for optimal data management
 */

import { useEffect, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useGeocaches } from '@/hooks/useGeocaches';
import { usePrefetchManager } from '@/hooks/usePrefetchManager';
import { useCacheInvalidation } from '@/hooks/useCacheInvalidation';
import { useOnlineStatus } from '@/hooks/useConnectivity';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useGeocacheNavigation } from '@/hooks/useGeocacheNavigation';
import { POLLING_INTERVALS } from '@/lib/constants';

interface DataManagerOptions {
  enablePolling?: boolean;
  enablePrefetching?: boolean;
  priorityGeocaches?: string[];
}

interface DataManagerStatus {
  isLoading: boolean;
  isPolling: boolean;
  isPrefetching: boolean;
  lastUpdate: Date | null;
  errorCount: number;
  prefetchStatus: {
    totalGeocaches: number;
    prefetchedLogs: number;
    prefetchedAuthors: number;
  };
}

/**
 * Main data management hook that provides unified control over all data operations
 */
export function useDataManager(options: DataManagerOptions = {}) {
  const {
    enablePolling = true,
    enablePrefetching = true,
    priorityGeocaches = [],
  } = options;

  const { user } = useCurrentUser();
  const { isOnline, isConnected } = useOnlineStatus();
  const queryClient = useQueryClient();
  const { prePopulateGeocaches } = useGeocacheNavigation();

  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [errorCount, setErrorCount] = useState(0);

  // Main geocaches query with adaptive polling
  const geocachesQuery = useGeocaches();

  // Prefetch manager
  const prefetchManager = usePrefetchManager({
    enableBackgroundPolling: enablePolling && isOnline && isConnected,
    enablePrefetching: enablePrefetching && isOnline,
    priorityGeocaches,
  });

  // Cache invalidation
  const cacheInvalidation = useCacheInvalidation();

  // Track successful updates and pre-populate cache
  useEffect(() => {
    if (geocachesQuery.dataUpdatedAt) {
      setLastUpdate(new Date(geocachesQuery.dataUpdatedAt));
      if (geocachesQuery.isSuccess && geocachesQuery.data) {
        setErrorCount(0);
        // Pre-populate individual geocache caches for faster navigation
        prePopulateGeocaches(geocachesQuery.data);
      }
    }
  }, [geocachesQuery.dataUpdatedAt, geocachesQuery.isSuccess, geocachesQuery.data, prePopulateGeocaches]);

  // Track errors
  useEffect(() => {
    if (geocachesQuery.isError) {
      setErrorCount(prev => prev + 1);
    }
  }, [geocachesQuery.isError]);

  /**
   * Manual refresh of all data
   */
  const refreshAll = useCallback(async () => {
    try {
      // Invalidate and refetch all geocache queries
      await queryClient.invalidateQueries({ queryKey: ['geocaches'] });
      await queryClient.invalidateQueries({ queryKey: ['geocaches-fast'] });
      await queryClient.invalidateQueries({ queryKey: ['geocache-logs'] });
      
      // Also invalidate proximity and adaptive queries
      await queryClient.invalidateQueries({ queryKey: ['proximity-geocaches'] });
      await queryClient.invalidateQueries({ queryKey: ['adaptive-geocaches'] });
      
      // Trigger prefetch
      await prefetchManager.triggerPrefetch();
      
      // Validate cached data
      await cacheInvalidation.validateCachedGeocaches();
      
      setLastUpdate(new Date());
      setErrorCount(0);
    } catch (error) {
      console.error('Failed to refresh all data:', error);
      setErrorCount(prev => prev + 1);
    }
  }, [queryClient, prefetchManager, cacheInvalidation]);

  /**
   * Refresh specific geocache and its logs
   */
  const refreshGeocache = useCallback(async (geocacheId: string) => {
    try {
      // Invalidate specific geocache queries
      await queryClient.invalidateQueries({ queryKey: ['geocache', geocacheId] });
      await queryClient.invalidateQueries({ 
        queryKey: ['geocache-logs'],
        predicate: (query) => {
          // Invalidate logs for this geocache
          return query.queryKey.includes(geocacheId);
        }
      });
      
      // Trigger prefetch for this geocache
      await prefetchManager.triggerPrefetch([geocacheId]);
    } catch (error) {
      console.error('Failed to refresh geocache:', geocacheId, error);
    }
  }, [queryClient, prefetchManager]);

  /**
   * Get current data status
   */
  const getStatus = useCallback((): DataManagerStatus => {
    const prefetchStatus = prefetchManager.getPrefetchStatus();
    
    return {
      isLoading: geocachesQuery.isLoading,
      isPolling: enablePolling && isOnline && isConnected,
      isPrefetching: enablePrefetching && isOnline,
      lastUpdate,
      errorCount,
      prefetchStatus,
    };
  }, [
    geocachesQuery.isLoading,
    enablePolling,
    enablePrefetching,
    isOnline,
    isConnected,
    lastUpdate,
    errorCount,
    prefetchManager,
  ]);

  /**
   * Pause/resume polling
   */
  const pausePolling = useCallback(() => {
    // Invalidate queries to stop current polling
    queryClient.invalidateQueries({ queryKey: ['geocaches'] });
    queryClient.invalidateQueries({ queryKey: ['geocaches-fast'] });
    queryClient.invalidateQueries({ queryKey: ['geocache-logs'] });
  }, [queryClient]);

  const resumePolling = useCallback(() => {
    // Force refetch to restart polling with current intervals
    queryClient.invalidateQueries({ queryKey: ['geocaches'] });
    queryClient.invalidateQueries({ queryKey: ['geocaches-fast'] });
    queryClient.invalidateQueries({ queryKey: ['geocache-logs'] });
  }, [queryClient]);

  /**
   * Smart data management based on user activity
   */
  useEffect(() => {
    if (!user || !isOnline) return;

    // Increase polling frequency when user is active
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // User returned to tab, trigger immediate refresh
        refreshAll();
      }
    };

    const handleFocus = () => {
      // Window gained focus, resume normal polling
      resumePolling();
    };

    const handleBlur = () => {
      // Window lost focus, reduce polling frequency
      pausePolling();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
    };
  }, [user, isOnline, refreshAll, resumePolling, pausePolling]);

  return {
    // Data
    geocaches: geocachesQuery.data || [],
    isLoading: geocachesQuery.isLoading,
    isError: geocachesQuery.isError,
    error: geocachesQuery.error,
    
    // Actions
    refreshAll,
    refreshGeocache,
    pausePolling,
    resumePolling,
    
    // Status
    getStatus,
    
    // Sub-managers
    prefetchManager,
    cacheInvalidation,
    
    // Computed status
    isActive: enablePolling && isOnline && isConnected,
    lastUpdate,
    errorCount,
  };
}

