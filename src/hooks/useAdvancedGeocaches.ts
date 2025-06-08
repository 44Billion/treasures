import { useMemo } from 'react';
import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';
import type { Geocache } from '@/types/geocache';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { QUERY_LIMITS, TIMEOUTS } from '@/lib/constants';
import type { ComparisonOperator } from '@/components/ui/comparison-filter';
import { 
  NIP_GC_KINDS, 
  parseGeocacheEvent, 
  parseLogEvent, 
  createGeocacheCoordinate 
} from '@/lib/nip-gc';

interface UseGeocachesOptions {
  limit?: number;
  search?: string;
  difficulty?: number;
  difficultyOperator?: ComparisonOperator;
  terrain?: number;
  terrainOperator?: ComparisonOperator;
  authorPubkey?: string;
}

export function useAdvancedGeocaches(options: UseGeocachesOptions = {}) {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();

  // Query for geocaches
  // Only include parameters that affect the Nostr query in the query key
  // Client-side filters (search, difficulty, terrain) should not trigger refetches
  const { data: geocaches, ...queryState } = useQuery({
    queryKey: ['geocaches-advanced', {
      // Only include server-side filter parameters
      limit: options.limit,
      authorPubkey: options.authorPubkey,
    }],
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(TIMEOUTS.QUERY)]);
      const events = await nostr.query([{
        kinds: [NIP_GC_KINDS.GEOCACHE],
        limit: options.limit || QUERY_LIMITS.GEOCACHES,
        ...(options.authorPubkey && { authors: [options.authorPubkey] }),
      }], { signal });

      // Parse and filter geocaches, excluding hidden caches from public listings
      let geocaches: Geocache[] = events
        .map(parseGeocacheEvent)
        .filter((g): g is Geocache => g !== null)
        .filter(g => !g.hidden || g.pubkey === user?.pubkey); // Show hidden caches to their creator

      // Apply client-side filters
      if (options.search) {
        const searchLower = options.search.toLowerCase();
        geocaches = geocaches.filter(g => 
          g.name.toLowerCase().includes(searchLower) ||
          g.description.toLowerCase().includes(searchLower)
        );
      }

      // Apply comparison filters for difficulty
      if (options.difficulty !== undefined && options.difficultyOperator && options.difficultyOperator !== 'all') {
        geocaches = geocaches.filter(g => 
          applyComparison(g.difficulty, options.difficultyOperator!, options.difficulty!)
        );
      }

      // Apply comparison filters for terrain
      if (options.terrain !== undefined && options.terrainOperator && options.terrainOperator !== 'all') {
        geocaches = geocaches.filter(g => 
          applyComparison(g.terrain, options.terrainOperator!, options.terrain!)
        );
      }

      // Sort by creation date (newest first)
      geocaches.sort((a, b) => b.created_at - a.created_at);

      return geocaches;
    },
    staleTime: 60000, // 1 minute
    gcTime: 300000, // 5 minutes
  });

  // Query for log counts for limited set of geocaches
  const limitedCaches = geocaches?.slice(0, 10) || [];
  const { data: logEvents } = useQuery({
    queryKey: ['geocaches-advanced-logs', limitedCaches.map(g => g.id).join(',')],
    queryFn: async (c) => {
      if (limitedCaches.length === 0) return [];

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(TIMEOUTS.QUERY)]);
      
      // Get both found and comment logs
      const [foundEvents, commentEvents] = await Promise.all([
        nostr.query([{
          kinds: [NIP_GC_KINDS.FOUND_LOG],
          '#a': limitedCaches.map(g => createGeocacheCoordinate(g.pubkey, g.dTag)),
          limit: QUERY_LIMITS.LOGS / 2,
        }], { signal }),
        nostr.query([{
          kinds: [NIP_GC_KINDS.COMMENT_LOG],
          '#a': limitedCaches.map(g => createGeocacheCoordinate(g.pubkey, g.dTag)),
          '#A': limitedCaches.map(g => createGeocacheCoordinate(g.pubkey, g.dTag)),
          limit: QUERY_LIMITS.LOGS / 2,
        }], { signal })
      ]);

      return [...foundEvents, ...commentEvents];
    },
    enabled: limitedCaches.length > 0,
    staleTime: 60000,
  });

  // Add log counts to geocaches
  const geocachesWithCounts = useMemo(() => {
    if (!geocaches) return [];
    
    if (!logEvents || geocaches.length === 0) {
      return geocaches.map(g => ({ ...g, logCount: 0, foundCount: 0 }));
    }

    // Count logs per geocache
    const logCounts = new Map<string, { total: number; found: number }>();
    
    logEvents.forEach(event => {
      const aTag = event.tags.find(tag => tag[0] === 'a')?.[1];
      if (!aTag) return;
      
      const log = parseLogEvent(event);
      if (log) {
        const current = logCounts.get(aTag) || { total: 0, found: 0 };
        current.total++;
        if (log.type === 'found') current.found++;
        logCounts.set(aTag, current);
      }
    });

    // Add counts to geocaches
    return geocaches.map(g => {
      const coord = createGeocacheCoordinate(g.pubkey, g.dTag);
      const counts = logCounts.get(coord) || { total: 0, found: 0 };
      return {
        ...g,
        logCount: counts.total,
        foundCount: counts.found,
      };
    });
  }, [geocaches, logEvents]);

  return {
    ...queryState,
    data: geocachesWithCounts,
  };
}

function applyComparison(value: number, operator: ComparisonOperator, target: number): boolean {
  switch (operator) {
    case 'eq':
      return value === target;
    case 'gt':
      return value > target;
    case 'gte':
      return value >= target;
    case 'lt':
      return value < target;
    case 'lte':
      return value <= target;
    case 'all':
    default:
      return true;
  }
}
