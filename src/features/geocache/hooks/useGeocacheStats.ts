import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { NIP_GC_KINDS, createGeocacheCoordinate } from '@/lib/nip-gc';
import { TIMEOUTS, POLLING_INTERVALS } from '@/lib/constants';
import { useDeletionFilter } from '@/hooks/useDeletionFilter';

export interface GeocacheStats {
  foundCount: number;
  logCount: number;
}

export function useGeocacheStats(geocacheDTag?: string, geocachePubkey?: string): GeocacheStats {
  const { nostr } = useNostr();
  const { filterDeleted } = useDeletionFilter();
  
  const query = useQuery({
    queryKey: ['geocache-stats', geocacheDTag, geocachePubkey],
    queryFn: async (c) => {
      if (!geocachePubkey || !geocacheDTag) {
        return { foundCount: 0, logCount: 0 };
      }

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(TIMEOUTS.FAST_QUERY)]);
      const geocacheCoordinate = createGeocacheCoordinate(geocachePubkey, geocacheDTag);
      
      try {
        // Query for found logs
        const foundLogs = await nostr.query([{
          kinds: [NIP_GC_KINDS.FOUND_LOG],
          '#a': [geocacheCoordinate],
          limit: 100, // Reasonable limit for counting
        }], { signal });
        
        // Query for comment logs
        const commentLogs = await nostr.query([{
          kinds: [NIP_GC_KINDS.COMMENT_LOG],
          '#a': [geocacheCoordinate],
          '#A': [geocacheCoordinate],
          limit: 100, // Reasonable limit for counting
        }], { signal });
        
        // Filter out deleted events
        const validFoundLogs = filterDeleted.fast(foundLogs);
        const validCommentLogs = filterDeleted.fast(commentLogs);
        
        // Remove duplicates by pubkey for found logs (one find per person)
        const uniqueFoundLogs = validFoundLogs.reduce((acc, log) => {
          if (!acc.has(log.pubkey)) {
            acc.set(log.pubkey, log);
          }
          return acc;
        }, new Map());
        
        return {
          foundCount: uniqueFoundLogs.size,
          logCount: validFoundLogs.length + validCommentLogs.length,
        };
      } catch (error) {
        console.warn('Failed to fetch geocache stats:', error);
        return { foundCount: 0, logCount: 0 };
      }
    },
    enabled: !!(geocacheDTag && geocachePubkey),
    staleTime: 30000, // 30 seconds - stats don't change too frequently
    gcTime: 300000, // 5 minutes cache retention
    refetchOnWindowFocus: false,
    refetchInterval: POLLING_INTERVALS.LOGS, // Poll every 30 seconds
    refetchIntervalInBackground: true,
  });

  return query.data || { foundCount: 0, logCount: 0 };
}

/**
 * Hook for getting stats for multiple geocaches at once
 */
export function useMultipleGeocacheStats(geocaches: Array<{ dTag: string; pubkey: string }>) {
  const { nostr } = useNostr();
  const { filterDeleted } = useDeletionFilter();
  
  return useQuery({
    queryKey: ['multiple-geocache-stats', geocaches.map(g => `${g.pubkey}:${g.dTag}`).join(',')],
    queryFn: async (c) => {
      if (geocaches.length === 0) {
        return new Map<string, GeocacheStats>();
      }

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(TIMEOUTS.QUERY)]);
      const statsMap = new Map<string, GeocacheStats>();
      
      // Initialize all geocaches with zero stats
      geocaches.forEach(geocache => {
        const key = `${geocache.pubkey}:${geocache.dTag}`;
        statsMap.set(key, { foundCount: 0, logCount: 0 });
      });
      
      try {
        // Create coordinates for all geocaches
        const coordinates = geocaches.map(g => createGeocacheCoordinate(g.pubkey, g.dTag));
        
        // Query for all found logs at once
        const foundLogs = await nostr.query([{
          kinds: [NIP_GC_KINDS.FOUND_LOG],
          '#a': coordinates,
          limit: 500, // Higher limit for batch queries
        }], { signal });
        
        // Query for all comment logs at once
        const commentLogs = await nostr.query([{
          kinds: [NIP_GC_KINDS.COMMENT_LOG],
          '#a': coordinates,
          '#A': coordinates,
          limit: 500, // Higher limit for batch queries
        }], { signal });
        
        // Filter out deleted events
        const validFoundLogs = filterDeleted.fast(foundLogs);
        const validCommentLogs = filterDeleted.fast(commentLogs);
        
        // Process found logs
        const foundCountMap = new Map<string, Set<string>>();
        validFoundLogs.forEach(log => {
          const aTag = log.tags.find(tag => tag[0] === 'a')?.[1];
          if (aTag) {
            if (!foundCountMap.has(aTag)) {
              foundCountMap.set(aTag, new Set());
            }
            foundCountMap.get(aTag)!.add(log.pubkey);
          }
        });
        
        // Process comment logs
        const commentCountMap = new Map<string, number>();
        [...validFoundLogs, ...validCommentLogs].forEach(log => {
          const aTag = log.tags.find(tag => tag[0] === 'a')?.[1] || 
                     log.tags.find(tag => tag[0] === 'A')?.[1];
          if (aTag) {
            commentCountMap.set(aTag, (commentCountMap.get(aTag) || 0) + 1);
          }
        });
        
        // Update stats map
        geocaches.forEach(geocache => {
          const key = `${geocache.pubkey}:${geocache.dTag}`;
          const coordinate = createGeocacheCoordinate(geocache.pubkey, geocache.dTag);
          
          const foundCount = foundCountMap.get(coordinate)?.size || 0;
          const logCount = commentCountMap.get(coordinate) || 0;
          
          statsMap.set(key, { foundCount, logCount });
        });
        
        return statsMap;
      } catch (error) {
        console.warn('Failed to fetch multiple geocache stats:', error);
        return statsMap; // Return map with zero stats
      }
    },
    enabled: geocaches.length > 0,
    staleTime: 30000, // 30 seconds
    gcTime: 300000, // 5 minutes cache retention
    refetchOnWindowFocus: false,
    refetchInterval: POLLING_INTERVALS.LOGS, // Poll every 30 seconds
    refetchIntervalInBackground: true,
  });
}