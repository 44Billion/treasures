import { useNostr } from '@nostrify/react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { NIP_GC_KINDS, parseGeocacheEvent } from '@/lib/nip-gc';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { usePerformanceOptimization } from '@/hooks/usePerformanceOptimization';
import { TIMEOUTS, POLLING_INTERVALS, QUERY_LIMITS } from '@/lib/constants';
import { useEffect, useState, useCallback } from 'react';

interface OptimisticGeocachesOptions {
  enablePolling?: boolean;
  enablePrefetching?: boolean;
  fastInitialLoad?: boolean;
  staleWhileRevalidate?: boolean;
}

interface OptimisticGeocachesResult {
  geocaches: any[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  isStale: boolean;
  isFetching: boolean;
  hasInitialData: boolean;
  lastUpdated: Date | null;
  refresh: () => Promise<void>;
  prefetchLogs: (geocacheIds: string[]) => void;
}

/**
 * Optimistic geocaches hook with progressive loading and smart caching
 */
export function useOptimisticGeocaches(
  options: OptimisticGeocachesOptions = {}
): OptimisticGeocachesResult {
  const {
    enablePolling = true,
    enablePrefetching = true,
    fastInitialLoad = true,
    staleWhileRevalidate = true,
  } = options;

  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  
  // Performance optimizations
  const { warmCache } = usePerformanceOptimization({
    enableBackgroundPrefetch: enablePrefetching,
    enableSmartCaching: true,
    enableMemoryOptimization: true,
  });

  // Fast initial load with smaller limit - prioritize speed over completeness
  const fastQuery = useQuery({
    queryKey: ['geocaches-fast'],
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(TIMEOUTS.OPTIMISTIC_LOAD)]);
      const events = await nostr.query([{
        kinds: [NIP_GC_KINDS.GEOCACHE], 
        limit: QUERY_LIMITS.FAST_LOAD_LIMIT // Load first 8 quickly
      }], { signal });

      const geocaches = events.map(event => {
        const parsed = parseGeocacheEvent(event);
        if (!parsed) return null;
        if (parsed.hidden && parsed.pubkey !== user?.pubkey) return null;
        return {
          ...parsed,
          foundCount: 0,
          logCount: 0,
        };
      }).filter(Boolean);

      // Warm cache for visible geocaches
      if (geocaches.length > 0) {
        const geocacheIds = geocaches.slice(0, 3).map((g: any) => g.id);
        warmCache(geocacheIds);
      }

      return geocaches;
    },
    enabled: fastInitialLoad,
    staleTime: 30000, // 30 seconds - short for fast updates
    gcTime: 300000, // 5 minutes
    refetchOnWindowFocus: false,
    // Start immediately without waiting
    networkMode: 'online',
  });

  // Full query with all geocaches - run in parallel with fast query
  const fullQuery = useQuery({
    queryKey: ['geocaches'],
    queryFn: async (c) => {
      // Use longer timeout for full load, but still reasonable
      const timeout = c.meta?.isBackground ? TIMEOUTS.QUERY : TIMEOUTS.QUERY * 0.75;
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(timeout)]);
      
      const events = await nostr.query([{
        kinds: [NIP_GC_KINDS.GEOCACHE], 
        limit: QUERY_LIMITS.GEOCACHES
      }], { signal });

      return events.map(event => {
        const parsed = parseGeocacheEvent(event);
        if (!parsed) return null;
        if (parsed.hidden && parsed.pubkey !== user?.pubkey) return null;
        return {
          ...parsed,
          foundCount: 0,
          logCount: 0,
        };
      }).filter(Boolean);
    },
    staleTime: staleWhileRevalidate ? 60000 : 120000, // 1-2 minutes
    gcTime: 900000, // 15 minutes
    refetchOnWindowFocus: false,
    refetchInterval: enablePolling ? POLLING_INTERVALS.GEOCACHES : false,
    refetchIntervalInBackground: true,
    // Run in parallel - don't wait for fast query to complete
    enabled: true,
    networkMode: 'online',
  });

  // Track when data was last updated
  useEffect(() => {
    const query = fullQuery.data ? fullQuery : fastQuery;
    if (query.dataUpdatedAt) {
      setLastUpdated(new Date(query.dataUpdatedAt));
    }
  }, [fullQuery.dataUpdatedAt, fastQuery.dataUpdatedAt, fullQuery.data, fastQuery.data]);

  // Prefetch logs for visible geocaches
  const prefetchLogs = useCallback((geocacheIds: string[]) => {
    if (!enablePrefetching) return;

    geocacheIds.slice(0, 5).forEach(geocacheId => {
      const geocache = (fullQuery.data || fastQuery.data)?.find((g: any) => g.id === geocacheId);
      if (!geocache?.dTag || !geocache?.pubkey) return;

      queryClient.prefetchQuery({
        queryKey: ['geocache-logs', geocache.dTag, geocache.pubkey],
        queryFn: async () => {
          const signal = AbortSignal.timeout(TIMEOUTS.FAST_QUERY);
          const geocacheCoordinate = `${NIP_GC_KINDS.GEOCACHE}:${geocache.pubkey}:${geocache.dTag}`;
          
          try {
            const [foundLogs, commentLogs] = await Promise.all([
              nostr.query([{
                kinds: [NIP_GC_KINDS.FOUND_LOG],
                '#a': [geocacheCoordinate],
                limit: 20,
              }], { signal }),
              nostr.query([{
                kinds: [NIP_GC_KINDS.COMMENT_LOG],
                '#a': [geocacheCoordinate],
                '#A': [geocacheCoordinate],
                limit: 20,
              }], { signal })
            ]);
            
            return [...foundLogs, ...commentLogs];
          } catch (error) {
            console.warn('Prefetch failed for geocache logs:', geocacheId, error);
            return [];
          }
        },
        staleTime: 60000,
      });
    });
  }, [enablePrefetching, queryClient, nostr, fullQuery.data, fastQuery.data]);

  // Auto-prefetch for top geocaches
  useEffect(() => {
    const geocaches = fullQuery.data || fastQuery.data;
    if (geocaches && geocaches.length > 0) {
      const topGeocacheIds = geocaches.slice(0, 3).map((g: any) => g.id);
      prefetchLogs(topGeocacheIds);
    }
  }, [fullQuery.data, fastQuery.data, prefetchLogs]);

  // Manual refresh function
  const refresh = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['geocaches'] }),
      queryClient.invalidateQueries({ queryKey: ['geocaches-fast'] }),
    ]);
  }, [queryClient]);

  // Determine which data to use
  const primaryQuery = fullQuery.data ? fullQuery : fastQuery;
  const geocaches = primaryQuery.data || [];
  
  // Smart loading states
  const isInitialLoading = fastInitialLoad 
    ? (fastQuery.isLoading && !fastQuery.data)
    : (fullQuery.isLoading && !fullQuery.data);
  
  const isFetching = fastQuery.isFetching || fullQuery.isFetching;
  const isError = primaryQuery.isError;
  const error = primaryQuery.error as Error | null;
  const hasInitialData = !!(fastQuery.data || fullQuery.data);
  
  // Data is stale if we're showing fast data while full data loads
  const isStale = staleWhileRevalidate && (
    (fastQuery.data && fullQuery.isLoading) ||
    (primaryQuery.isStale && !primaryQuery.isFetching)
  );

  return {
    geocaches,
    isLoading: isInitialLoading,
    isError,
    error,
    isStale,
    isFetching,
    hasInitialData,
    lastUpdated,
    refresh,
    prefetchLogs,
  };
}

/**
 * Hook for home page with optimized loading
 */
export function useHomePageGeocaches() {
  const result = useOptimisticGeocaches({
    enablePolling: true,
    enablePrefetching: true,
    fastInitialLoad: true,
    staleWhileRevalidate: true,
  });

  // Return only first 3 for home page
  return {
    ...result,
    geocaches: result.geocaches.slice(0, QUERY_LIMITS.HOME_PAGE_LIMIT),
  };
}

/**
 * Hook for map page with progressive loading
 */
export function useMapPageGeocaches() {
  return useOptimisticGeocaches({
    enablePolling: true,
    enablePrefetching: true,
    fastInitialLoad: true,
    staleWhileRevalidate: true,
  });
}