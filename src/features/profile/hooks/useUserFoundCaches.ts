import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';
import { useCurrentUser } from '@/features/auth/hooks/useCurrentUser';
// Note: Deletion filtering functionality has been simplified
import { TIMEOUTS } from '@/shared/config';
import type { Geocache } from '@/types/geocache';
import { NIP_GC_KINDS, parseLogEvent, parseGeocacheEvent, createGeocacheCoordinate } from '@/features/geocache/utils/nip-gc';
import type { FoundCache } from '../types';

export function useUserFoundCaches(targetPubkey?: string) {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();

  // Use provided pubkey or fall back to current user's pubkey
  const pubkey = targetPubkey || user?.pubkey;
  
  // Note: Deletion filtering has been simplified for now

  return useQuery({
    queryKey: ['user-found-caches', pubkey],
    queryFn: async (c) => {
      if (!pubkey) return [];

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(TIMEOUTS.QUERY)]);

      // First, get all logs by the user
      const logEvents = await nostr.query([{
        kinds: [NIP_GC_KINDS.FOUND_LOG, NIP_GC_KINDS.COMMENT_LOG],
        authors: [pubkey],
        limit: 500,
      }], { signal });

      // For now, use all logs (deletion filtering can be re-implemented later)
      const nonDeletedLogs = logEvents;

      // Process the logs to find "found" logs
      const foundLogs = nonDeletedLogs
        .map(event => {
          const parsed = parseLogEvent(event);
          if (parsed && parsed.type === 'found') {
            // Extract geocache info from a-tag
            const aTag = event.tags.find(t => t[0] === 'a')?.[1];
            if (aTag) {
              const [kind, geocachePubkey, geocacheDTag] = aTag.split(':');
              if (kind === NIP_GC_KINDS.GEOCACHE.toString() && geocachePubkey && geocacheDTag) {
                return {
                  ...parsed,
                  geocachePubkey,
                  geocacheDTag,
                };
              }
            }
          }
          return null;
        })
        .filter((log): log is NonNullable<typeof log> => log !== null);

      if (foundLogs.length === 0) return [];

      // Get unique geocache references
      const geocacheRefs = Array.from(new Set(
        foundLogs.map(log => `${log.geocachePubkey}:${log.geocacheDTag}`)
      ));

      // Fetch geocache data for each found cache
      const geocaches = new Map<string, Geocache>();
      const logCounts = new Map<string, { total: number; found: number }>();

      for (const ref of geocacheRefs) {
        const [geocachePubkey, dTag] = ref.split(':');
        
        try {
          // Get the geocache event
          const geocacheEvents = await nostr.query([{
            kinds: [NIP_GC_KINDS.GEOCACHE],
            authors: [geocachePubkey],
            '#d': [dTag],
            limit: 1,
          }], { signal });

          if (geocacheEvents.length > 0) {
            const parsed = parseGeocacheEvent(geocacheEvents[0]);
            if (parsed) {
              geocaches.set(ref, parsed);
            }
          }

          // Get all logs for this geocache (for counting)
          const allLogs = await nostr.query([{
            kinds: [NIP_GC_KINDS.FOUND_LOG, NIP_GC_KINDS.COMMENT_LOG],
            '#a': [createGeocacheCoordinate(geocachePubkey, dTag)],
            limit: 1000,
          }], { signal });

          let totalLogs = 0;
          let foundLogsCount = 0;

          for (const logEvent of allLogs) {
            const log = parseLogEvent(logEvent);
            if (log) {
              totalLogs++;
              if (log.type === 'found') {
                foundLogsCount++;
              }
            }
          }

          logCounts.set(ref, { total: totalLogs, found: foundLogsCount });
        } catch (error) {
          console.warn(`Failed to fetch data for geocache ${ref}:`, error);
        }
      }

      // Combine found logs with geocache data and counts, deduplicating by geocache
      // If a user found the same geocache multiple times, only show the most recent find
      const foundCachesMap = new Map<string, FoundCache>();
      
      for (const log of foundLogs) {
        const ref = `${log.geocachePubkey}:${log.geocacheDTag}`;
        const geocache = geocaches.get(ref);
        const counts = logCounts.get(ref) || { total: 0, found: 0 };
        
        if (geocache) {
          const foundCacheEntry = {
            id: geocache.id,
            dTag: geocache.dTag,
            pubkey: geocache.pubkey,
            name: geocache.name,
            foundAt: log.created_at,
            logId: log.id,
            logText: log.text,
            location: geocache.location,
            difficulty: geocache.difficulty,
            terrain: geocache.terrain,
            size: geocache.size,
            type: geocache.type,
            foundCount: counts.found,
            logCount: counts.total,
          };

          // Only keep the most recent find for each unique geocache
          const existingEntry = foundCachesMap.get(ref);
          if (!existingEntry || log.created_at > existingEntry.foundAt) {
            foundCachesMap.set(ref, foundCacheEntry);
          }
        }
      }
      
      // Convert map to array and sort by found date (newest first)
      const foundCaches = Array.from(foundCachesMap.values());
      foundCaches.sort((a, b) => b.foundAt - a.foundAt);
      
      return foundCaches;
    },
    enabled: !!pubkey,
    staleTime: 60000, // 1 minute
    gcTime: 300000, // 5 minutes
    refetchOnWindowFocus: false,
  });
}