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
import { cacheManager } from '@/lib/cacheManager';
import { useNostr } from '@nostrify/react';
import { NIP_GC_KINDS } from '@/lib/nip-gc';
import { POLLING_INTERVALS, TIMEOUTS } from '@/lib/constants';

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
    cacheStatus: Object;
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

  const { nostr } = useNostr();

  // Background sync functions
  const backgroundSync = {
    syncGeocaches: useCallback(async () => {
      try {
        const signal = AbortSignal.timeout(TIMEOUTS.FAST_QUERY);
        const events = await nostr.query([{
          kinds: [NIP_GC_KINDS.GEOCACHE],
          limit: 100,
          since: Math.floor(Date.now() / 1000) - 3600, // Last hour
        }], { signal });

        let updatedCount = 0;
        
        // Only process if we actually got events
        if (events && events.length > 0) {
          events.forEach(event => {
            // Only update if this is actually newer data
            const wasUpdated = cacheManager.updateIfNewer(
              'geocache',
              event.id,
              event, // Store the raw event for now
              event.created_at * 1000
            );
            
            if (wasUpdated) {
              updatedCount++;
            }
          });

          // Only invalidate React Query if we actually got NEW data
          if (updatedCount > 0) {
            // Use refetchType: 'none' to update cache without triggering UI loading states
            queryClient.invalidateQueries({ 
              queryKey: ['geocaches'],
              refetchType: 'none' // Don't trigger loading states
            });
          }
        }

        return updatedCount;
      } catch (error) {
        // Don't log warnings for timeout errors in background sync
        if (!error?.message?.includes('timeout')) {
          console.warn('Background geocache sync failed:', error);
        }
        return 0;
      }
    }, [nostr, queryClient]),

    syncLogs: useCallback(async (geocacheIds: string[]) => {
      if (geocacheIds.length === 0) return 0;

      try {
        const signal = AbortSignal.timeout(TIMEOUTS.FAST_QUERY);
        const events = await nostr.query([{
          kinds: [NIP_GC_KINDS.FOUND_LOG, NIP_GC_KINDS.COMMENT_LOG],
          '#a': geocacheIds.map(id => `${NIP_GC_KINDS.GEOCACHE}:${id}`),
          since: Math.floor(Date.now() / 1000) - 1800, // Last 30 minutes
          limit: 100,
        }], { signal });

        let updatedCount = 0;
        const logsByGeocache = new Map<string, any[]>();

        // Only process if we actually got events
        if (events && events.length > 0) {
          // Group logs by geocache
          events.forEach(event => {
            const aTag = event.tags.find(tag => tag[0] === 'a')?.[1];
            if (aTag) {
              const geocacheId = aTag.split(':')[2];
              if (!logsByGeocache.has(geocacheId)) {
                logsByGeocache.set(geocacheId, []);
              }
              logsByGeocache.get(geocacheId)!.push(event);
            }
          });

          // Update cache for each geocache
          logsByGeocache.forEach((logs, geocacheId) => {
            const existingLogs = cacheManager.getLogs(geocacheId) || [];
            const newLogs = logs.filter(log => 
              !existingLogs.some(existing => existing.id === log.id)
            );

            if (newLogs.length > 0) {
              const allLogs = [...newLogs, ...existingLogs]
                .sort((a, b) => b.created_at - a.created_at);
              
              cacheManager.setLogs(geocacheId, allLogs);
              updatedCount += newLogs.length;
              
              // Only invalidate React Query if we have NEW logs
              // Use refetchType: 'none' to update cache without triggering UI loading states
              queryClient.invalidateQueries({ 
                queryKey: ['geocache-logs', geocacheId],
                refetchType: 'none' // Don't trigger loading states
              });
            }
          });
        }

        return updatedCount;
      } catch (error) {
        // Don't log warnings for timeout errors in background sync
        if (!error?.message?.includes('timeout')) {
          console.warn('Background log sync failed:', error);
        }
        return 0;
      }
    }, [nostr, queryClient]),
  };

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
      // Force refresh by invalidating React Query cache
      await queryClient.invalidateQueries({ 
        queryKey: ['geocaches'],
        refetchType: 'active' // Only refetch if actively being used
      });
      
      // Don't clear LRU cache on manual refresh - let background sync handle updates
      // The LRU cache will be updated with fresh data when queries run
      
      // Trigger background sync to get latest data
      const updatedGeocaches = await backgroundSync.syncGeocaches();
      
      // Trigger prefetch for visible data only
      if (geocachesQuery.data && geocachesQuery.data.length > 0) {
        const topGeocacheIds = geocachesQuery.data.slice(0, 5).map((g: any) => g.id);
        await prefetchManager.triggerPrefetch(topGeocacheIds);
        
        // Sync logs for top geocaches
        await backgroundSync.syncLogs(topGeocacheIds);
      }
      
      setLastUpdate(new Date());
      setErrorCount(0);
      
      console.log(`Manual refresh completed. Updated ${updatedGeocaches} geocaches.`);
    } catch (error) {
      console.error('Failed to refresh all data:', error);
      setErrorCount(prev => prev + 1);
    }
  }, [queryClient, prefetchManager, geocachesQuery.data, backgroundSync]);

  /**
   * Refresh specific geocache and its logs
   */
  const refreshGeocache = useCallback(async (geocacheId: string) => {
    try {
      // Mark cache entries for background update (don't clear immediately)
      cacheManager.markForBackgroundUpdate('geocache', geocacheId);
      cacheManager.markForBackgroundUpdate('logs', geocacheId);
      
      // Invalidate React Query to trigger refetch
      await queryClient.invalidateQueries({ queryKey: ['geocache', geocacheId] });
      await queryClient.invalidateQueries({ 
        queryKey: ['geocache-logs'],
        predicate: (query) => {
          return query.queryKey.includes(geocacheId);
        }
      });
      
      // Trigger background sync for this specific geocache
      await backgroundSync.syncLogs([geocacheId]);
      
      // Trigger prefetch for this geocache
      await prefetchManager.triggerPrefetch([geocacheId]);
    } catch (error) {
      console.error('Failed to refresh geocache:', geocacheId, error);
    }
  }, [queryClient, prefetchManager, backgroundSync]);

  /**
   * Get current data status
   */
  const getStatus = useCallback((): DataManagerStatus => {
    const prefetchStatus = prefetchManager.getPrefetchStatus();
    const cacheStats = cacheManager.getStats();
    
    return {
      isLoading: geocachesQuery.isLoading,
      isPolling: enablePolling && isOnline && isConnected,
      isPrefetching: enablePrefetching && isOnline,
      lastUpdate,
      errorCount,
      prefetchStatus: {
        ...prefetchStatus,
        cacheStats, // Include LRU cache statistics
      },
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

    // Debounce visibility changes to prevent rapid firing
    let visibilityTimeout: NodeJS.Timeout | null = null;

    const handleVisibilityChange = () => {
      if (visibilityTimeout) {
        clearTimeout(visibilityTimeout);
      }
      
      visibilityTimeout = setTimeout(() => {
        if (document.visibilityState === 'visible') {
          // User returned to tab, trigger immediate refresh
          refreshAll();
        }
      }, 500); // Debounce for 500ms
    };

    const handleFocus = () => {
      // Window gained focus, resume normal polling
      resumePolling();
    };

    const handleBlur = () => {
      // Window lost focus, reduce polling frequency
      pausePolling();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange, { passive: true });
    window.addEventListener('focus', handleFocus, { passive: true });
    window.addEventListener('blur', handleBlur, { passive: true });

    return () => {
      if (visibilityTimeout) {
        clearTimeout(visibilityTimeout);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
    };
  }, [user, isOnline, refreshAll, resumePolling, pausePolling]);

  /**
   * Background sync effect for LRU cache
   */
  useEffect(() => {
    if (!user || !isOnline || !enablePolling) return;

    const interval = setInterval(async () => {
      try {
        // Background sync geocaches
        const updatedGeocaches = await backgroundSync.syncGeocaches();
        
        // Sync logs for visible geocaches (top 10)
        if (geocachesQuery.data && geocachesQuery.data.length > 0) {
          const visibleGeocacheIds = geocachesQuery.data
            .slice(0, 10)
            .map((g: any) => g.id);
          
          const updatedLogs = await backgroundSync.syncLogs(visibleGeocacheIds);
          
          if (updatedGeocaches > 0 || updatedLogs > 0) {
            console.log(`Background sync: ${updatedGeocaches} geocaches, ${updatedLogs} logs updated`);
            setLastUpdate(new Date());
          }
        }
      } catch (error) {
        console.warn('Background sync failed:', error);
      }
    }, POLLING_INTERVALS.BACKGROUND_SYNC);

    return () => clearInterval(interval);
  }, [user, isOnline, enablePolling, backgroundSync, geocachesQuery.data]);

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

