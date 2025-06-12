/**
 * Completely redesigned proximity search with reliability and fallback mechanisms
 * Fixes all issues with the previous implementation
 */

import { useMemo, useCallback } from 'react';
import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';
import { NostrEvent, NostrFilter } from '@nostrify/nostrify';
import type { Geocache } from '@/types/geocache';
import { useCurrentUser } from '@/features/auth/hooks/useCurrentUser';
// Note: Deletion filtering functionality has been simplified
import { TIMEOUTS, QUERY_LIMITS, POLLING_INTERVALS } from '@/shared/config';
import type { ComparisonOperator } from '@/components/ui/comparison-filter';
import { 
  NIP_GC_KINDS, 
  parseGeocacheEvent,
  encodeGeohash
} from '@/features/geocache/utils/nip-gc';
import { calculateDistance as calculateGeoDistance } from '@/features/map/utils/geo';

interface UseReliableProximitySearchOptions {
  limit?: number;
  search?: string;
  difficulty?: number;
  difficultyOperator?: ComparisonOperator;
  terrain?: number;
  terrainOperator?: ComparisonOperator;
  cacheType?: string;
  authorPubkey?: string;
  // Proximity parameters
  centerLat?: number;
  centerLng?: number;
  radiusKm?: number;
  enableProximityOptimization?: boolean;
}

export type GeocacheWithDistance = Geocache & { distance?: number };

interface SearchResult {
  geocaches: GeocacheWithDistance[];
  searchStrategy: 'proximity' | 'broad' | 'fallback';
  proximityAttempted: boolean;
  proximitySuccessful: boolean;
  totalFound: number;
  debugInfo?: {
    geohashPatterns?: string[];
    filterGroups?: number;
    errors?: string[];
    error?: string;
  };
}

/**
 * Generate geohash patterns for proximity search using the new multi-precision approach
 * 
 * NEW APPROACH: Since geocaches now include geohash tags at precisions 3-9,
 * we can use exact matches at the appropriate precision level for the search radius.
 * This is much more efficient than generating complex grid patterns.
 */
function generateGeohashPatterns(
  centerLat: number, 
  centerLng: number, 
  radiusKm: number
): string[] {
  const patterns = new Set<string>();
  
  // Determine the optimal precision level based on radius
  let targetPrecision: number;
  if (radiusKm >= 100) targetPrecision = 3;      // u4x       (metro area)
  else if (radiusKm >= 50) targetPrecision = 4;  // u4xs      (city-level)
  else if (radiusKm >= 25) targetPrecision = 5;  // u4xsu     (broader)
  else if (radiusKm >= 10) targetPrecision = 6;  // u4xsud    (region)
  else if (radiusKm >= 5) targetPrecision = 7;   // u4xsudv   (area)
  else if (radiusKm >= 2) targetPrecision = 8;   // u4xsudvx  (nearby)
  else targetPrecision = 9;                      // u4xsudvxb (exact)
  
  // Generate the center geohash at target precision
  const centerGeohash = encodeGeohash(centerLat, centerLng, targetPrecision);
  patterns.add(centerGeohash);
  
  // For comprehensive coverage, also include patterns at nearby precisions
  // This ensures we catch geocaches that might be at cell boundaries
  const precisionRange = Math.max(1, Math.min(2, Math.floor(radiusKm / 10)));
  
  for (let p = Math.max(3, targetPrecision - precisionRange); p <= Math.min(9, targetPrecision + precisionRange); p++) {
    const geohash = encodeGeohash(centerLat, centerLng, p);
    patterns.add(geohash);
    
    // For larger radiuses, add some spatial coverage by slightly offsetting coordinates
    if (radiusKm >= 5) {
      const offset = 0.001 * Math.pow(2, 9 - p); // Smaller offset for higher precision
      const offsets = [
        [offset, 0], [-offset, 0], [0, offset], [0, -offset],
        [offset, offset], [offset, -offset], [-offset, offset], [-offset, -offset]
      ];
      
      for (const [latOffset, lngOffset] of offsets) {
        const offsetLat = centerLat + latOffset;
        const offsetLng = centerLng + lngOffset;
        
        if (offsetLat >= -90 && offsetLat <= 90 && offsetLng >= -180 && offsetLng <= 180) {
          const offsetGeohash = encodeGeohash(offsetLat, offsetLng, p);
          patterns.add(offsetGeohash);
        }
      }
    }
  }
  
  const result = Array.from(patterns).sort();
  
  return result;
}

// Helper function for distance calculation (duplicated to avoid import issues)
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
  
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function useReliableProximitySearch(options: UseReliableProximitySearchOptions = {}) {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  // Note: Deletion filtering has been simplified for now
  
  // Determine if proximity search should be attempted
  const hasProximityParams = !!(options.centerLat && options.centerLng && options.radiusKm);
  const shouldAttemptProximity = hasProximityParams && options.enableProximityOptimization !== false;
  
  // Query key includes all parameters that affect the Nostr query
  const queryKey = useMemo(() => [
    'reliable-proximity-search',
    {
      limit: options.limit,
      authorPubkey: options.authorPubkey,
      centerLat: options.centerLat,
      centerLng: options.centerLng,
      radiusKm: options.radiusKm,
      enableProximityOptimization: options.enableProximityOptimization,
    }
  ], [
    options.limit,
    options.authorPubkey,
    options.centerLat,
    options.centerLng,
    options.radiusKm,
    options.enableProximityOptimization,
  ]);

  const executeProximitySearch = useCallback(async (signal: AbortSignal): Promise<{
    events: NostrEvent[];
    successful: boolean;
    debugInfo: any;
  }> => {
    if (!options.centerLat || !options.centerLng || !options.radiusKm) {
      return { events: [], successful: false, debugInfo: { error: 'Missing proximity parameters' } };
    }

    try {
      const patterns = generateGeohashPatterns(
        options.centerLat,
        options.centerLng,
        options.radiusKm
      );

      // Create a single filter with all patterns
      const filter: NostrFilter = {
        kinds: [NIP_GC_KINDS.GEOCACHE],
        '#g': patterns,
        limit: Math.min(patterns.length * 10, 1000), // More generous limit since patterns are more targeted
      };

      if (options.authorPubkey) {
        filter.authors = [options.authorPubkey];
      }

      const events = await nostr.query([filter], { signal });

      return {
        events,
        successful: true, // Always consider successful since we have targeted patterns
        debugInfo: {
          geohashPatterns: patterns,
          filterGroups: 1,
          eventsFound: events.length
        }
      };
    } catch (error) {
      console.warn('🔍 Proximity search failed:', error);
      return {
        events: [],
        successful: false,
        debugInfo: {
          error: error instanceof Error ? error.message : String(error)
        }
      };
    }
  }, [options.centerLat, options.centerLng, options.radiusKm, options.authorPubkey, nostr]);

  const executeBroadSearch = useCallback(async (signal: AbortSignal): Promise<NostrEvent[]> => {
    const filter: NostrFilter = {
      kinds: [NIP_GC_KINDS.GEOCACHE],
      limit: options.limit || QUERY_LIMITS.GEOCACHES,
    };

    if (options.authorPubkey) {
      filter.authors = [options.authorPubkey];
    }

    return await nostr.query([filter], { signal });
  }, [options.limit, options.authorPubkey, nostr]);

  const applyClientSideFilters = useCallback((geocaches: GeocacheWithDistance[]): GeocacheWithDistance[] => {
    let filtered = [...geocaches];

    // Text search filter
    if (options.search) {
      const searchLower = options.search.toLowerCase();
      filtered = filtered.filter(g => 
        g.name.toLowerCase().includes(searchLower) ||
        g.description.toLowerCase().includes(searchLower)
      );
    }

    // Difficulty filter
    if (options.difficulty !== undefined && options.difficultyOperator && options.difficultyOperator !== 'all') {
      filtered = filtered.filter(g => 
        applyComparison(g.difficulty, options.difficultyOperator!, options.difficulty!)
      );
    }

    // Terrain filter
    if (options.terrain !== undefined && options.terrainOperator && options.terrainOperator !== 'all') {
      filtered = filtered.filter(g => 
        applyComparison(g.terrain, options.terrainOperator!, options.terrain!)
      );
    }

    // Cache type filter
    if (options.cacheType && options.cacheType !== 'all') {
      filtered = filtered.filter(g => g.type === options.cacheType);
    }

    // Apply proximity filtering and add distances
    if (hasProximityParams) {
      filtered = filtered.map(cache => ({
        ...cache,
        distance: calculateGeoDistance(
          options.centerLat!,
          options.centerLng!,
          cache.location.lat,
          cache.location.lng
        )
      })).filter(cache => cache.distance! <= options.radiusKm!)
        .sort((a, b) => (a.distance || 0) - (b.distance || 0));
    } else {
      // Sort by creation date if no proximity
      filtered.sort((a, b) => b.created_at - a.created_at);
    }

    return filtered;
  }, [
    options.search,
    options.difficulty,
    options.difficultyOperator,
    options.terrain,
    options.terrainOperator,
    options.cacheType,
    hasProximityParams,
    options.centerLat,
    options.centerLng,
    options.radiusKm
  ]);

  const { data: searchResult, ...queryResult } = useQuery({
    queryKey,
    queryFn: async (c): Promise<SearchResult> => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(TIMEOUTS.QUERY)]);
      
      let events: NostrEvent[] = [];
      let searchStrategy: 'proximity' | 'broad' | 'fallback' = 'broad';
      let proximityAttempted = false;
      let proximitySuccessful = false;
      let debugInfo: any = {};

      // Step 1: Try proximity search if enabled
      if (shouldAttemptProximity) {
        proximityAttempted = true;
        const proximityResult = await executeProximitySearch(signal);
        
        if (proximityResult.successful) {
          events = proximityResult.events;
          searchStrategy = 'proximity';
          proximitySuccessful = true;
          debugInfo = proximityResult.debugInfo;
        } else {
          debugInfo = proximityResult.debugInfo;
        }
      }

      // Step 2: Fallback to broad search if proximity failed or wasn't attempted
      if (events.length === 0) {
        try {
          events = await executeBroadSearch(signal);
          searchStrategy = proximityAttempted ? 'fallback' : 'broad';
        } catch (error) {
          console.error('❌ Broad search also failed:', error);
          debugInfo.broadSearchError = error instanceof Error ? error.message : String(error);
        }
      }

      // Step 3: Process events into geocaches
      // For now, use all events (deletion filtering can be re-implemented later)
      const geocaches: Geocache[] = events
        .map(parseGeocacheEvent)
        .filter((g): g is Geocache => g !== null)
        .filter(g => !g.hidden || g.pubkey === user?.pubkey);

      // Step 4: Apply client-side filters
      const filteredGeocaches = applyClientSideFilters(geocaches);

      return {
        geocaches: filteredGeocaches,
        searchStrategy,
        proximityAttempted,
        proximitySuccessful,
        totalFound: events.length,
      };
    },
    staleTime: 60000, // 1 minute
    gcTime: 300000, // 5 minutes
    refetchInterval: POLLING_INTERVALS.GEOCACHES,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: false,
  });

  return {
    ...queryResult,
    data: searchResult?.geocaches || [],
    searchStrategy: searchResult?.searchStrategy || 'broad',
    proximityAttempted: searchResult?.proximityAttempted || false,
    proximitySuccessful: searchResult?.proximitySuccessful || false,
    totalFound: searchResult?.totalFound || 0,
    debugInfo: searchResult?.debugInfo,
  };
}

function applyComparison(value: number, operator: ComparisonOperator, target: number): boolean {
  switch (operator) {
    case 'eq': return value === target;
    case 'gt': return value > target;
    case 'gte': return value >= target;
    case 'lt': return value < target;
    case 'lte': return value <= target;
    case 'all':
    default: return true;
  }
}

/**
 * Adaptive hook that automatically uses the reliable proximity search
 */
export function useAdaptiveReliableGeocaches(options: Omit<UseReliableProximitySearchOptions, 'centerLat' | 'centerLng' | 'radiusKm'> & {
  userLocation?: { lat: number; lng: number } | null;
  searchLocation?: { lat: number; lng: number } | null;
  searchRadius?: number;
  showNearMe?: boolean;
}) {
  const searchOptions: UseReliableProximitySearchOptions = {
    ...options,
    centerLat: options.searchLocation?.lat || (options.showNearMe ? options.userLocation?.lat : undefined),
    centerLng: options.searchLocation?.lng || (options.showNearMe ? options.userLocation?.lng : undefined),
    radiusKm: (options.searchLocation || (options.showNearMe && options.userLocation)) ? options.searchRadius : undefined,
    enableProximityOptimization: !!(options.searchLocation || (options.showNearMe && options.userLocation)),
  };

  return useReliableProximitySearch(searchOptions);
}