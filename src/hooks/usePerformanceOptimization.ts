import { useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useOnlineStatus } from '@/hooks/useConnectivity';

interface PerformanceOptimizationOptions {
  enableBackgroundPrefetch?: boolean;
  enableSmartCaching?: boolean;
  enableMemoryOptimization?: boolean;
}

/**
 * Hook for performance optimizations including smart caching and memory management
 */
export function usePerformanceOptimization(options: PerformanceOptimizationOptions = {}) {
  const {
    enableBackgroundPrefetch = true,
    enableSmartCaching = true,
    enableMemoryOptimization = true,
  } = options;

  const queryClient = useQueryClient();
  const { isOnline } = useOnlineStatus();
  const prefetchTimeoutRef = useRef<NodeJS.Timeout>();

  // Smart cache cleanup based on memory pressure
  const optimizeMemory = useCallback(() => {
    if (!enableMemoryOptimization) return;

    // Get memory info if available (Chrome only)
    const memory = (performance as any).memory;
    if (memory) {
      const memoryUsage = memory.usedJSHeapSize / memory.jsHeapSizeLimit;
      
      // If memory usage is high (>80%), aggressively clean cache
      if (memoryUsage > 0.8) {
        queryClient.clear();
        console.log('Memory optimization: Cleared query cache due to high memory usage');
      } else if (memoryUsage > 0.6) {
        // If moderate usage (>60%), clean old queries
        queryClient.invalidateQueries({
          predicate: (query) => {
            const lastUpdated = query.state.dataUpdatedAt;
            const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
            return lastUpdated < fiveMinutesAgo;
          }
        });
        console.log('Memory optimization: Cleaned old queries');
      }
    }
  }, [enableMemoryOptimization, queryClient]);

  // Background prefetching with intelligent scheduling
  const scheduleBackgroundPrefetch = useCallback(() => {
    if (!enableBackgroundPrefetch || !isOnline) return;

    // Clear existing timeout
    if (prefetchTimeoutRef.current) {
      clearTimeout(prefetchTimeoutRef.current);
    }

    // Schedule prefetch when browser is idle
    prefetchTimeoutRef.current = setTimeout(() => {
      if ('requestIdleCallback' in window) {
        requestIdleCallback(() => {
          // Prefetch author metadata for cached geocaches
          const geocacheQueries = queryClient.getQueriesData({ queryKey: ['geocaches'] });
          geocacheQueries.forEach(([, data]) => {
            if (Array.isArray(data)) {
              const uniqueAuthors = [...new Set(data.map((cache: any) => cache.pubkey))];
              uniqueAuthors.slice(0, 10).forEach(pubkey => {
                queryClient.prefetchQuery({
                  queryKey: ['author', pubkey],
                  staleTime: 300000, // 5 minutes
                });
              });
            }
          });
        });
      }
    }, 2000); // Wait 2 seconds before prefetching
  }, [enableBackgroundPrefetch, isOnline, queryClient]);

  // Smart cache warming based on user behavior
  const warmCache = useCallback((geocacheIds: string[]) => {
    if (!enableSmartCaching) return;

    geocacheIds.forEach(id => {
      // Prefetch logs for this geocache
      queryClient.prefetchQuery({
        queryKey: ['geocache-logs', id],
        staleTime: 60000, // 1 minute
      });
    });
  }, [enableSmartCaching, queryClient]);

  // Optimize query defaults for better performance
  useEffect(() => {
    if (!enableSmartCaching) return;

    queryClient.setQueryDefaults(['geocaches'], {
      staleTime: 60000, // 1 minute
      gcTime: 300000, // 5 minutes
      refetchOnWindowFocus: false,
    });

    queryClient.setQueryDefaults(['geocache-logs'], {
      staleTime: 30000, // 30 seconds
      gcTime: 180000, // 3 minutes
      refetchOnWindowFocus: false,
    });

    queryClient.setQueryDefaults(['author'], {
      staleTime: 300000, // 5 minutes
      gcTime: 600000, // 10 minutes
      refetchOnWindowFocus: false,
    });
  }, [enableSmartCaching, queryClient]);

  // Memory monitoring and cleanup
  useEffect(() => {
    if (!enableMemoryOptimization) return;

    const interval = setInterval(optimizeMemory, 30000); // Check every 30 seconds
    
    // Also run on visibility change
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        optimizeMemory();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [optimizeMemory, enableMemoryOptimization]);

  // Background prefetching
  useEffect(() => {
    scheduleBackgroundPrefetch();
    
    return () => {
      if (prefetchTimeoutRef.current) {
        clearTimeout(prefetchTimeoutRef.current);
      }
    };
  }, [scheduleBackgroundPrefetch]);

  return {
    optimizeMemory,
    warmCache,
    scheduleBackgroundPrefetch,
  };
}

/**
 * Hook for intersection observer-based prefetching
 */
export function useIntersectionPrefetch(
  callback: (entries: IntersectionObserverEntry[]) => void,
  options: IntersectionObserverInit = {}
) {
  const observerRef = useRef<IntersectionObserver>();

  const observe = useCallback((element: Element) => {
    if (!observerRef.current) {
      observerRef.current = new IntersectionObserver(callback, {
        rootMargin: '100px', // Start prefetching 100px before element is visible
        threshold: 0.1,
        ...options,
      });
    }
    
    observerRef.current.observe(element);
  }, [callback, options]);

  const unobserve = useCallback((element: Element) => {
    observerRef.current?.unobserve(element);
  }, []);

  const disconnect = useCallback(() => {
    observerRef.current?.disconnect();
  }, []);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return { observe, unobserve, disconnect };
}