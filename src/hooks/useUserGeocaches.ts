import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNostrBatchQuery } from '@/hooks/useUnifiedNostr';
import type { Geocache } from '@/types/geocache';
import { NostrFilter } from '@nostrify/nostrify';
import { NIP_GC_KINDS, parseGeocacheEvent, createGeocacheCoordinate } from '@/lib/nip-gc';

export function useUserGeocaches(targetPubkey?: string) {
  const { user } = useCurrentUser();

  // Use provided pubkey or fall back to current user's pubkey
  const pubkey = targetPubkey || user?.pubkey;

  // Create filter groups for batch query
  const filterGroups: NostrFilter[][] = pubkey ? [
    // First batch: Get user's geocaches
    [{ 
      kinds: [NIP_GC_KINDS.GEOCACHE], 
      authors: [pubkey],
      limit: 100
    }]
  ] : [];

  const { data: geocacheEvents, ...queryResult } = useNostrBatchQuery(
    ['user-geocaches-events', pubkey],
    filterGroups,
    {
      enabled: !!pubkey,
      timeout: 8000, // Automatically optimized for all browsers
      staleTime: 60000, // 1 minute
      gcTime: 300000, // 5 minutes
      refetchOnWindowFocus: false,
    }
  );

  // Parse geocaches and prepare log count queries
  const geocaches = geocacheEvents?.map(event => {
    const parsed = parseGeocacheEvent(event);
    if (!parsed) return null;
    return {
      ...parsed,
      foundCount: 0, // Will be calculated below
      logCount: 0, // Will be calculated below
    };
  }).filter((geocache): geocache is NonNullable<typeof geocache> => geocache !== null) || [];

  // Create log count filter groups
  const logCountFilterGroups: NostrFilter[][] = geocaches.length > 0 ? 
    geocaches.map(geocache => [{
      kinds: [NIP_GC_KINDS.LOG],
      '#a': [createGeocacheCoordinate(geocache.pubkey, geocache.dTag)],
      limit: 1000, // Get all logs to count them
    }]) : [];

  const { data: allLogEvents } = useNostrBatchQuery(
    ['user-geocaches-logs', pubkey, geocaches.map(g => g.dTag).join(',')],
    logCountFilterGroups,
    {
      enabled: geocaches.length > 0,
      timeout: 8000,
      staleTime: 60000,
      gcTime: 300000,
      refetchOnWindowFocus: false,
    }
  );

  // Process the data
  const processedData = (() => {
    if (!geocaches.length) return [];

    // Group logs by geocache and count them
    const logCounts = new Map<string, { total: number; found: number }>();
    
    if (allLogEvents) {
      for (const logEvent of allLogEvents) {
        const aTag = logEvent.tags.find(t => t[0] === 'a')?.[1];
        if (aTag) {
          const [, pubkey, dTag] = aTag.split(':');
          const ref = `${pubkey}:${dTag}`;
          
          const logType = logEvent.tags.find(t => t[0] === 'log-type')?.[1];
          
          if (!logCounts.has(ref)) {
            logCounts.set(ref, { total: 0, found: 0 });
          }
          
          const counts = logCounts.get(ref);
          if (counts) {
            counts.total++;
            
            if (logType === 'found') {
              counts.found++;
            }
          }
        }
      }
    }
    
    // Update geocaches with counts
    const geocachesWithCounts = geocaches.map(geocache => {
      const ref = `${geocache.pubkey}:${geocache.dTag}`;
      const counts = logCounts.get(ref) || { total: 0, found: 0 };
      
      return {
        ...geocache,
        foundCount: counts.found,
        logCount: counts.total,
      };
    });
    
    // Sort by creation date (newest first)
    geocachesWithCounts.sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
    
    return geocachesWithCounts;
  })();

  return {
    ...queryResult,
    data: processedData,
  };
}