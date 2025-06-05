import { useNostr } from '@nostrify/react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { NIP_GC_KINDS, parseGeocacheEvent } from '@/lib/nip-gc';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { TIMEOUTS, POLLING_INTERVALS, QUERY_LIMITS } from '@/lib/constants';
import { getAdaptiveTimeout } from '@/lib/networkUtils';
import { useEffect } from 'react';

export function useGeocaches() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['geocaches'],
    queryFn: async (c) => {
      // Use adaptive timeout that considers network conditions
      const baseTimeout = c.meta?.isBackground ? TIMEOUTS.QUERY * 1.5 : TIMEOUTS.QUERY;
      const timeout = getAdaptiveTimeout(baseTimeout);
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(timeout)]);
      const events = await nostr.query([{
        kinds: [NIP_GC_KINDS.GEOCACHE], 
        limit: QUERY_LIMITS.GEOCACHES * 2 // Fetch more for better caching
      }], { signal });

      return events.map(event => {
        const parsed = parseGeocacheEvent(event);
        if (!parsed) return null;
        // Show hidden caches to their creator, filter them out for everyone else
        if (parsed.hidden && parsed.pubkey !== user?.pubkey) return null;
        return {
          ...parsed,
          foundCount: 0, // Could be enhanced with additional queries
          logCount: 0,
        };
      }).filter(Boolean);
    },
    staleTime: 120000, // 2 minutes - less aggressive to reduce requests
    gcTime: 900000, // 15 minutes - even longer cache retention
    refetchOnWindowFocus: false,
    refetchInterval: POLLING_INTERVALS.GEOCACHES, // Poll every minute
    refetchIntervalInBackground: true, // Continue polling in background
  });

  // Prefetch related data when geocaches are loaded
  useEffect(() => {
    if (query.data && query.data.length > 0) {
      // Prefetch logs for the first few geocaches
      const topGeocaches = query.data.slice(0, 5);
      topGeocaches.forEach(geocache => {
        if (geocache.dTag && geocache.pubkey) {
          queryClient.prefetchQuery({
            queryKey: ['geocache-logs', geocache.dTag, geocache.pubkey],
            queryFn: async () => {
              const signal = AbortSignal.timeout(TIMEOUTS.FAST_QUERY);
              const geocacheCoordinate = `${NIP_GC_KINDS.GEOCACHE}:${geocache.pubkey}:${geocache.dTag}`;
              
              try {
                const foundLogs = await nostr.query([{
                  kinds: [NIP_GC_KINDS.FOUND_LOG],
                  '#a': [geocacheCoordinate],
                  limit: 20,
                }], { signal });
                
                const commentLogs = await nostr.query([{
                  kinds: [NIP_GC_KINDS.COMMENT_LOG],
                  '#a': [geocacheCoordinate],
                  '#A': [geocacheCoordinate],
                  limit: 20,
                }], { signal });
                
                return [...foundLogs, ...commentLogs];
              } catch (error) {
                console.warn('Prefetch failed for geocache logs:', geocache.id, error);
                return [];
              }
            },
            staleTime: 60000,
          });
        }
      });
    }
  }, [query.data, queryClient, nostr]);

  return query;
}

/**
 * Hook for getting geocaches near a specific location
 */
export function useNearbyGeocaches(lat?: number, lon?: number, radiusKm = 50) {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();

  return useQuery({
    queryKey: ['nearby-geocaches', lat, lon, radiusKm],
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(TIMEOUTS.QUERY)]);
      const events = await nostr.query([{
        kinds: [NIP_GC_KINDS.GEOCACHE], 
        // Note: Nostr doesn't have built-in geo queries, so we fetch all and filter client-side
        // In a real implementation, you might use specialized relays or additional filters
        limit: 500 
      }], { signal });

      return events.map(event => {
        const parsed = parseGeocacheEvent(event);
        if (!parsed) return null;
        // Show hidden caches to their creator, filter them out for everyone else
        if (parsed.hidden && parsed.pubkey !== user?.pubkey) return null;
        return parsed;
      }).filter(Boolean);
    },
    enabled: lat !== undefined && lon !== undefined,
    staleTime: 120000, // 2 minutes for location-based data
  });
}

/**
 * Hook for getting a specific geocache by coordinate (kind:pubkey:d-tag)
 */
export function useGeocacheByCoordinate(coordinate?: string) {
  const { nostr } = useNostr();
  const parts = coordinate?.split(':');
  const kind = parts?.[0] ? parseInt(parts[0]) : undefined;
  const pubkey = parts?.[1];
  const dTag = parts?.[2];

  return useQuery({
    queryKey: ['geocache-by-coordinate', coordinate],
    queryFn: async (c) => {
      if (!kind || !pubkey || !dTag) {
        throw new Error('Invalid coordinate format');
      }

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(TIMEOUTS.QUERY)]);
      const events = await nostr.query([{
        kinds: [kind],
        authors: [pubkey],
        '#d': [dTag],
        limit: 1
      }], { signal });

      return events;
    },
    enabled: !!(kind && pubkey && dTag),
    staleTime: 300000, // 5 minutes for individual geocaches
  });
}