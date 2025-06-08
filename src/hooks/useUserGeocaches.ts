import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useAuthorDeletionFilter } from '@/hooks/useDeletionFilter';
import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';
import { NIP_GC_KINDS, parseGeocacheEvent, createGeocacheCoordinate } from '@/lib/nip-gc';
import { TIMEOUTS } from '@/lib/constants';

export function useUserGeocaches(targetPubkey?: string) {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();

  // Use provided pubkey or fall back to current user's pubkey
  const pubkey = targetPubkey || user?.pubkey;

  // Get deletion filter specifically for this author
  const { filterByAuthor } = useAuthorDeletionFilter(pubkey);

  const { data: geocacheEvents, ...queryResult } = useQuery({
    queryKey: ['user-geocaches-events', pubkey],
    queryFn: async (c) => {
      if (!pubkey) return [];

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(TIMEOUTS.QUERY)]);
      const events = await nostr.query([{ 
        kinds: [NIP_GC_KINDS.GEOCACHE], 
        authors: [pubkey],
        limit: 100
      }], { signal });

      return events;
    },
    enabled: !!pubkey,
    staleTime: 60000, // 1 minute
    gcTime: 300000, // 5 minutes
    refetchOnWindowFocus: false,
  });

  // Parse geocaches and prepare log count queries
  const geocaches = geocacheEvents?.map(event => {
    const parsed = parseGeocacheEvent(event);
    if (!parsed) return null;
    
    // In useUserGeocaches, we're fetching caches by a specific author (pubkey)
    // Show ALL caches by that author, including hidden ones, when viewing their profile
    // The filtering of hidden caches should only happen in the general geocaches list (useGeocaches)
    
    return {
      ...parsed,
      foundCount: 0, // Will be calculated below
      logCount: 0, // Will be calculated below
    };
  }).filter((geocache): geocache is NonNullable<typeof geocache> => geocache !== null) || [];

  // Filter out deleted geocaches by this author using raw events
  const nonDeletedEvents = filterByAuthor(geocacheEvents || []);
  const nonDeletedEventIds = new Set(nonDeletedEvents.map(e => e.id));
  const filteredGeocaches = geocaches.filter(g => nonDeletedEventIds.has(g.id));

  const { data: allLogEvents } = useQuery({
    queryKey: ['user-geocaches-logs', pubkey, filteredGeocaches.map(g => g.dTag).join(',')],
    queryFn: async (c) => {
      if (filteredGeocaches.length === 0) return [];

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(TIMEOUTS.QUERY)]);
      
      // Get logs for all geocaches
      const logPromises = filteredGeocaches.map(geocache => 
        nostr.query([{
          kinds: [NIP_GC_KINDS.FOUND_LOG, NIP_GC_KINDS.COMMENT_LOG],
          '#a': [createGeocacheCoordinate(geocache.pubkey, geocache.dTag)],
          limit: 1000, // Get all logs to count them
        }], { signal })
      );

      const logResults = await Promise.all(logPromises);
      return logResults.flat();
    },
    enabled: filteredGeocaches.length > 0,
    staleTime: 60000,
    gcTime: 300000,
    refetchOnWindowFocus: false,
  });

  // Process the data
  const processedData = (() => {
    if (!filteredGeocaches.length) return [];

    // Group logs by geocache and count them
    const logCounts = new Map<string, { total: number; found: number }>();
    
    if (allLogEvents) {
      // Also filter out deleted logs before counting
      const nonDeletedLogs = filterByAuthor(allLogEvents);
      
      for (const logEvent of nonDeletedLogs) {
        const aTag = logEvent.tags.find(t => t[0] === 'a')?.[1];
        if (aTag) {
          const [, pubkey, dTag] = aTag.split(':');
          const ref = `${pubkey}:${dTag}`;
          
          // Determine log type by event kind, not by tag
          const isFoundLog = logEvent.kind === NIP_GC_KINDS.FOUND_LOG;
          
          if (!logCounts.has(ref)) {
            logCounts.set(ref, { total: 0, found: 0 });
          }
          
          const counts = logCounts.get(ref);
          if (counts) {
            counts.total++;
            
            if (isFoundLog) {
              counts.found++;
            }
          }
        }
      }
    }
    
    // Update geocaches with counts
    const geocachesWithCounts = filteredGeocaches.map(geocache => {
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