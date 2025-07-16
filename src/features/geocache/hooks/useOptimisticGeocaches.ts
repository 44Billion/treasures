import { useNostr } from '@nostrify/react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { NIP_GC_KINDS, parseGeocacheEvent } from '@/features/geocache/utils/nip-gc';
import { useCurrentUser } from '@/features/auth/hooks/useCurrentUser';
// Note: Performance optimization functionality has been integrated into the new store system
import { useIsWotEnabled } from '@/shared/utils/wot';
import { useWotStore } from '@/shared/stores/useWotStore';
import { TIMEOUTS, POLLING_INTERVALS, QUERY_LIMITS } from '@/shared/config';
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
    staleWhileRevalidate = true,
  } = options;

  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();
  const isWotEnabled = useIsWotEnabled();
  const { wotPubkeys } = useWotStore();
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  
  // Note: Performance optimizations are now handled by the store system

  // Full query with all geocaches - run in parallel with fast query
  const fullQuery = useQuery({
    queryKey: ['geocaches', isWotEnabled, Array.from(wotPubkeys).sort().join(',')],
    queryFn: async (c) => {
      // Use longer timeout for full load, but still reasonable
      const timeout = c.meta?.isBackground ? TIMEOUTS.QUERY : TIMEOUTS.QUERY * 0.75;
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(timeout)]);
      
      const events = await nostr.query([{
        kinds: [NIP_GC_KINDS.GEOCACHE], 
        limit: QUERY_LIMITS.GEOCACHES
      }], { signal });

      const geocaches = events.map(event => {
        const parsed = parseGeocacheEvent(event);
        if (!parsed) return null;
        if (parsed.hidden && parsed.pubkey !== user?.pubkey) return null;
        return {
          ...parsed,
          naddr: parsed.naddr,
          foundCount: 0,
          logCount: 0,
        };
      }).filter(Boolean);

      if (isWotEnabled && wotPubkeys.size > 0) {
        return geocaches.filter(geocache => wotPubkeys.has(geocache.pubkey));
      }

      return geocaches;
    },
    staleTime: 300000, // 5 minutes - much longer for stability
    gcTime: 1800000, // 30 minutes
    refetchOnWindowFocus: false,
    refetchInterval: enablePolling ? POLLING_INTERVALS.GEOCACHES : false, // Poll every 5 minutes
    refetchIntervalInBackground: false, // Don't poll in background
    // Keep data stable
    placeholderData: (previousData) => previousData,
    enabled: true,
    networkMode: 'online',
  });

  // Track when data was last updated
  useEffect(() => {
    if (fullQuery.dataUpdatedAt) {
      setLastUpdated(new Date(fullQuery.dataUpdatedAt));
    }
  }, [fullQuery.dataUpdatedAt]);

  // Prefetch logs for visible geocaches
  const prefetchLogs = useCallback((geocacheIds: string[]) => {
    if (!enablePrefetching) return;

    geocacheIds.slice(0, 5).forEach(geocacheId => {
      const geocache = (fullQuery.data)?.find((g: any) => g.id === geocacheId);
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
  }, [enablePrefetching, queryClient, nostr, fullQuery.data]);

  // Auto-prefetch for top geocaches
  useEffect(() => {
    const geocaches = fullQuery.data;
    if (geocaches && geocaches.length > 0) {
      const topGeocacheIds = geocaches.slice(0, 3).map((g: any) => g.id);
      prefetchLogs(topGeocacheIds);
    }
  }, [fullQuery.data, prefetchLogs]);

  // Manual refresh function
  const refresh = useCallback(async () => {
    // Force immediate refetch of both queries
    await fullQuery.refetch();
  }, [fullQuery]);

  // Determine which data to use
  const geocaches = fullQuery.data || [];
  
  // Ensure we always have an array and track if we have attempted to load data
  const hasAttemptedLoad = fullQuery.isFetched;
  
  // Smart loading states
  const isInitialLoading = (fullQuery.isLoading && !fullQuery.data);
  
  // Only show fetching for manual refreshes, not background polling
  const isFetching = (fullQuery.isFetching && !fullQuery.isRefetching);
  const isError = fullQuery.isError;
  const error = fullQuery.error as Error | null;
  const hasInitialData = hasAttemptedLoad; // True if we've attempted to load data, regardless of results
  
  // Data is stale only if we're showing fast data while full data loads
  // Don't show stale state for background polling/refetching
  const isStale = staleWhileRevalidate && (fullQuery.isStale && !fullQuery.isFetching && !fullQuery.isRefetching);

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