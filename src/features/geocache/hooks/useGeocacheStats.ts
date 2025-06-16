import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { NIP_GC_KINDS, createGeocacheCoordinate } from '@/features/geocache/utils/nip-gc';
import { useIsWotEnabled } from '@/shared/utils/wot';
import { useWotStore } from '@/shared/stores/useWotStore';
import { Filter as NostrFilter } from 'nostr-tools';
import { TIMEOUTS, POLLING_INTERVALS } from '@/shared/config';
// Note: Deletion filtering functionality has been simplified

export interface GeocacheStats {
  foundCount: number;
  logCount: number;
}

export function useGeocacheStats(geocacheDTag?: string, geocachePubkey?: string): GeocacheStats {
  const { nostr } = useNostr();
  const isWotEnabled = useIsWotEnabled();
  const { wotPubkeys } = useWotStore();
  // Note: Deletion filtering has been simplified for now
  
  const query = useQuery({
    queryKey: ['geocache-stats', geocacheDTag, geocachePubkey, isWotEnabled, Array.from(wotPubkeys).sort().join(',')],
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
        
        // For now, use all logs (deletion filtering can be re-implemented later)
        const validFoundLogs = foundLogs;
        const validCommentLogs = commentLogs;
        
        // Remove duplicates by pubkey for found logs (one find per person)
        const uniqueFoundLogs = validFoundLogs.reduce((acc, log) => {
          if (!acc.has(log.pubkey)) {
            acc.set(log.pubkey, log);
          }
          return acc;
        }, new Map());
        
        if (isWotEnabled && wotPubkeys.size > 0) {
          const wotFoundLogs = new Map();
          for (const [pubkey, log] of uniqueFoundLogs.entries()) {
            if (wotPubkeys.has(pubkey)) {
              wotFoundLogs.set(pubkey, log);
            }
          }
          return {
            foundCount: wotFoundLogs.size,
            logCount: validFoundLogs.filter(log => wotPubkeys.has(log.pubkey)).length + validCommentLogs.filter(log => wotPubkeys.has(log.pubkey)).length,
          };
        }

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
  const { isWotEnabled, wotPubkeys } = useWotStore();
  // Note: Deletion filtering has been simplified for now
  
  return useQuery({
    queryKey: ['multiple-geocache-stats', geocaches.map(g => `${g.pubkey}:${g.dTag}`).join(','), isWotEnabled, Array.from(wotPubkeys).sort().join(',')],
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
        
        // For now, use all logs (deletion filtering can be re-implemented later)
        const validFoundLogs = foundLogs;
        const validCommentLogs = commentLogs;
        
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

        if (isWotEnabled && wotPubkeys.size > 0) {
          const wotStatsMap = new Map<string, GeocacheStats>();
          for (const [key, stats] of statsMap.entries()) {
            const [pubkey] = key.split(':');
            if (wotPubkeys.has(pubkey)) {
              wotStatsMap.set(key, stats);
            }
          }
          return wotStatsMap;
        }
        
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