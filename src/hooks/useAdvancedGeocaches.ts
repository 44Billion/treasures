import { useMemo } from 'react';
import { NostrFilter } from '@nostrify/nostrify';
import type { Geocache } from '@/types/geocache';
import { useNostrQuery, useNostrBatchQuery } from '@/hooks/useUnifiedNostr';
import { QUERY_LIMITS } from '@/lib/constants';
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
  const queryKey = useMemo(() => [
    'geocaches-advanced', 
    options
  ], [options]);

  // Query for geocaches
  const { data: result, ...queryState } = useNostrQuery(
    queryKey,
    [{
      kinds: [NIP_GC_KINDS.GEOCACHE],
      limit: options.limit || QUERY_LIMITS.GEOCACHES,
      ...(options.authorPubkey && { authors: [options.authorPubkey] }),
    }],
    {
      timeout: 8000,
      staleTime: 60000, // 1 minute
      gcTime: 300000, // 5 minutes
    }
  );

  // Process geocaches and apply filters
  const geocaches = useMemo(() => {
    if (!result?.events) return [];

    // Parse and filter geocaches
    let geocaches: Geocache[] = result.events
      .map(parseGeocacheEvent)
      .filter((g): g is Geocache => g !== null);

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
  }, [result?.events, options]);

  // Query for log counts for limited set of geocaches
  const limitedCaches = geocaches.slice(0, 10);
  const { data: logEvents } = useNostrBatchQuery(
    ['geocaches-advanced-logs', limitedCaches.map(g => g.id).join(',')],
    limitedCaches.length > 0 ? [
      // Found logs
      [{
        kinds: [NIP_GC_KINDS.FOUND_LOG],
        '#a': limitedCaches.map(g => createGeocacheCoordinate(g.pubkey, g.dTag)),
        limit: QUERY_LIMITS.LOGS / 2,
      }],
      // Comment logs
      [{
        kinds: [NIP_GC_KINDS.COMMENT_LOG],
        '#a': limitedCaches.map(g => createGeocacheCoordinate(g.pubkey, g.dTag)),
        '#A': limitedCaches.map(g => createGeocacheCoordinate(g.pubkey, g.dTag)),
        limit: QUERY_LIMITS.LOGS / 2,
      }]
    ] : [],
    {
      enabled: limitedCaches.length > 0,
      timeout: 6000,
      staleTime: 60000,
    }
  );

  // Add log counts to geocaches
  const geocachesWithCounts = useMemo(() => {
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


// parseGeocacheEvent and parseLogEvent are now imported from @/lib/nip-gc
