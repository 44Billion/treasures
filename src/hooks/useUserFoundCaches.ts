import { NostrFilter } from '@nostrify/nostrify';
import { useCurrentUser } from './useCurrentUser';
import { useNostrBatchQuery } from '@/hooks/useUnifiedNostr';
import type { GeocacheLog, Geocache } from '@/types/geocache';
import { NIP_GC_KINDS, parseLogEvent, parseGeocacheEvent, createGeocacheCoordinate } from '@/lib/nip-gc';

interface FoundCache {
  id: string;
  dTag: string;
  pubkey: string;
  name: string;
  foundAt: number;
  logId: string;
  logText: string;
  location: {
    lat: number;
    lng: number;
  };
  difficulty: number;
  terrain: number;
  size: string;
  type: string;
  foundCount?: number;
  logCount?: number;
}

export function useUserFoundCaches(targetPubkey?: string) {
  const { user } = useCurrentUser();

  // Use provided pubkey or fall back to current user's pubkey
  const pubkey = targetPubkey || user?.pubkey;

  // Create filter groups for batch query
  const filterGroups: NostrFilter[][] = pubkey ? [
    // Get all logs by the user
    [{
      kinds: [NIP_GC_KINDS.FOUND_LOG, NIP_GC_KINDS.COMMENT_LOG],
      authors: [pubkey],
      limit: 500,
    }]
  ] : [];

  const { data: logEvents, ...queryResult } = useNostrBatchQuery(
    ['user-found-caches-logs', pubkey],
    filterGroups,
    {
      enabled: !!pubkey,
      timeout: 8000,
      staleTime: 60000, // 1 minute
      gcTime: 300000, // 5 minutes
      refetchOnWindowFocus: false,
    }
  );

  // Process the logs to find "found" logs
  const foundLogs = (logEvents || [])
    .map(event => {
      const parsed = parseLogEvent(event);
      if (parsed && parsed.type === 'found') {
        // Extract geocache info from a-tag
        const aTag = event.tags.find(t => t[0] === 'a')?.[1];
        if (aTag) {
          const [, pubkey, dTag] = aTag.split(':');
          return {
            ...parsed,
            geocachePubkey: pubkey,
            geocacheDTag: dTag,
          };
        }
      }
      return null;
    })
    .filter((log): log is NonNullable<typeof log> => log !== null);

  // Get unique geocache references
  const geocacheRefs = Array.from(new Set(
    foundLogs.map(log => `${log.geocachePubkey}:${log.geocacheDTag}`)
  ));

  // Create filter groups for geocaches and their log counts
  const geocacheFilterGroups: NostrFilter[][] = geocacheRefs.map(ref => {
    const [pubkey, dTag] = ref.split(':');
    return [
      // Geocache event
      {
        kinds: [NIP_GC_KINDS.GEOCACHE],
        authors: [pubkey],
        '#d': [dTag],
        limit: 1,
      },
      // All logs for this geocache (for counting)
      {
        kinds: [NIP_GC_KINDS.FOUND_LOG, NIP_GC_KINDS.COMMENT_LOG],
        '#a': [createGeocacheCoordinate(pubkey, dTag)],
        limit: 1000,
      }
    ];
  });

  const { data: geocacheData } = useNostrBatchQuery(
    ['user-found-caches-geocaches', geocacheRefs.join(',')],
    geocacheFilterGroups,
    {
      enabled: geocacheRefs.length > 0,
      timeout: 8000,
      staleTime: 60000,
    }
  );

  // Process the final data
  const processedData = (() => {
    if (!geocacheData || foundLogs.length === 0) return [];

    // Parse geocaches and count logs
    const geocaches = new Map<string, Geocache>();
    const logCounts = new Map<string, { total: number; found: number }>();

    for (const event of geocacheData) {
      if (event.kind === NIP_GC_KINDS.GEOCACHE) {
        const parsed = parseGeocacheEvent(event);
        if (parsed) {
          const ref = `${parsed.pubkey}:${parsed.dTag}`;
          geocaches.set(ref, parsed);
        }
      } else {
        // Log event for counting
        const aTag = event.tags.find(t => t[0] === 'a')?.[1];
        if (aTag) {
          const [, pubkey, dTag] = aTag.split(':');
          const ref = `${pubkey}:${dTag}`;
          
          const log = parseLogEvent(event);
          if (log) {
            if (!logCounts.has(ref)) {
              logCounts.set(ref, { total: 0, found: 0 });
            }
            
            const counts = logCounts.get(ref)!;
            counts.total++;
            
            if (log.type === 'found') {
              counts.found++;
            }
          }
        }
      }
    }

    // Combine found logs with geocache data and counts
    const foundCaches: FoundCache[] = [];
    
    for (const log of foundLogs) {
      const ref = `${log.geocachePubkey}:${log.geocacheDTag}`;
      const geocache = geocaches.get(ref);
      const counts = logCounts.get(ref) || { total: 0, found: 0 };
      
      if (geocache) {
        foundCaches.push({
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
        });
      }
    }
    
    // Sort by found date (newest first)
    foundCaches.sort((a, b) => b.foundAt - a.foundAt);
    
    return foundCaches;
  })();

  return {
    ...queryResult,
    data: processedData,
  };
}

export type { FoundCache };