/**
 * Enhanced geocache hook with proximity search optimization
 * Replaces useAdvancedGeocaches with geohash-based proximity queries
 */

import { useMemo } from 'react';
import { NostrEvent, NostrFilter } from '@nostrify/nostrify';
import type { Geocache } from '@/types/geocache';
import { useNostrQuery, useNostrBatchQuery } from '@/hooks/useUnifiedNostr';
import { TIMEOUTS, QUERY_LIMITS } from '@/lib/constants';
import type { ComparisonOperator } from '@/components/ui/comparison-filter';
import { 
  NIP_GC_KINDS, 
  parseGeocacheEvent, 
  parseLogEvent, 
  createGeocacheCoordinate,
  getGeohashesInRadius,
  getGeohashPrefixes,
  getOptimalPrecision
} from '@/lib/nip-gc';
import { calculateDistance, sortByDistance, filterByRadius } from '@/lib/geo';

interface UseProximityGeocachesOptions {
  limit?: number;
  search?: string;
  difficulty?: number;
  difficultyOperator?: ComparisonOperator;
  terrain?: number;
  terrainOperator?: ComparisonOperator;
  authorPubkey?: string;
  // Proximity parameters
  centerLat?: number;
  centerLng?: number;
  radiusKm?: number;
  useProximityOptimization?: boolean;
  maxProximityPrecision?: number;
}

export type GeocacheWithDistance = Geocache & { distance?: number };

export function useProximityGeocaches(options: UseProximityGeocachesOptions = {}) {
  const queryKey = useMemo(() => [
    'geocaches-proximity', 
    options
  ], [options]);

  // Determine search strategy
  const hasProximitySearch = options.centerLat && options.centerLng && options.radiusKm;
  const useOptimization = hasProximitySearch && options.useProximityOptimization !== false;

  // Create filter groups based on strategy
  const filterGroups = useMemo(() => {
    if (useOptimization) {
      return createProximityFilterGroups();
    } else {
      return createBroadFilterGroups();
    }
  }, [useOptimization, options]);

  const { data: events, ...queryResult } = useNostrBatchQuery(
    queryKey,
    filterGroups,
    {
      timeout: TIMEOUTS.QUERY,
      staleTime: 60000, // 1 minute
      gcTime: 300000, // 5 minutes
    }
  );

  // Process the events
  const processedData = useMemo(() => {
    if (!events || events.length === 0) return [];

    try {
      // Parse geocaches
      const geocaches: Geocache[] = events
        .map(parseGeocacheEvent)
        .filter((g): g is Geocache => g !== null);

      // Apply proximity filtering if specified
      let geocachesWithDistance: GeocacheWithDistance[];
      if (hasProximitySearch) {
        // Add distance to all results and sort by distance
        geocachesWithDistance = geocaches.map(cache => ({
          ...cache,
          distance: calculateDistance(options.centerLat!, options.centerLng!, cache.location.lat, cache.location.lng)
        }));
        
        // Filter by radius with a small buffer (10% extra) for edge cases
        const radiusBuffer = options.radiusKm! * 1.1;
        geocachesWithDistance = geocachesWithDistance
          .filter(cache => cache.distance! <= radiusBuffer)
          .sort((a, b) => (a.distance || 0) - (b.distance || 0));
      } else {
        // No proximity filtering, just convert type
        geocachesWithDistance = geocaches.map(cache => ({ ...cache }));
      }

      // Apply client-side filters
      geocachesWithDistance = applyClientSideFilters(geocachesWithDistance);

      return geocachesWithDistance;
    } catch (error) {
      console.error('Error processing proximity geocaches:', error);
      return [];
    }
  }, [events, hasProximitySearch, options]);

  return {
    ...queryResult,
    data: processedData,
  };

  function createProximityFilterGroups(): NostrFilter[][] {
    if (!options.centerLat || !options.centerLng || !options.radiusKm) {
      return [];
    }

    // Use more conservative precision to cast a wider net
    const precision = Math.min(
      getOptimalPrecision(options.radiusKm),
      options.maxProximityPrecision || 5
    );
    
    // Strategy 1: Direct geohash targeting with wider coverage
    const targetHashes = getGeohashesInRadius(
      options.centerLat, 
      options.centerLng, 
      options.radiusKm,
      precision
    );

    // Strategy 2: Add prefix-based expansion for even broader coverage
    const prefixes = getGeohashPrefixes(options.centerLat, options.centerLng, options.radiusKm);
    const allHashes = [...new Set([...targetHashes, ...prefixes])];

    // Create filter groups for batch processing
    const batchSize = 12; // Automatically optimized by unified system
    const filterGroups: NostrFilter[][] = [];
    
    for (let i = 0; i < allHashes.length; i += batchSize) {
      const batch = allHashes.slice(i, i + batchSize);
      
      const filter: NostrFilter = {
        kinds: [NIP_GC_KINDS.GEOCACHE],
        '#g': batch,
        limit: 50
      };
      
      if (options.authorPubkey) {
        filter.authors = [options.authorPubkey];
      }
      
      filterGroups.push([filter]);
    }
    
    return filterGroups;
  }

  function createBroadFilterGroups(): NostrFilter[][] {
    const filter: NostrFilter = {
      kinds: [NIP_GC_KINDS.GEOCACHE],
      limit: options.limit || QUERY_LIMITS.GEOCACHES,
    };

    if (options.authorPubkey) {
      filter.authors = [options.authorPubkey];
    }

    return [[filter]];
  }

  function applyClientSideFilters(geocaches: GeocacheWithDistance[]): GeocacheWithDistance[] {
    let filtered = [...geocaches];

    // Text search filter
    if (options.search) {
      const searchLower = options.search.toLowerCase();
      filtered = filtered.filter(g => 
        g.name.toLowerCase().includes(searchLower) ||
        g.description.toLowerCase().includes(searchLower)
      );
    }

    // Difficulty comparison filter
    if (options.difficulty !== undefined && options.difficultyOperator && options.difficultyOperator !== 'all') {
      filtered = filtered.filter(g => 
        applyComparison(g.difficulty, options.difficultyOperator!, options.difficulty!)
      );
    }

    // Terrain comparison filter
    if (options.terrain !== undefined && options.terrainOperator && options.terrainOperator !== 'all') {
      filtered = filtered.filter(g => 
        applyComparison(g.terrain, options.terrainOperator!, options.terrain!)
      );
    }

    // Sort by distance if available, otherwise by creation date
    if (filtered.some(g => g.distance !== undefined)) {
      // Sort by distance (already calculated if using proximity)
      filtered.sort((a, b) => (a.distance || 0) - (b.distance || 0));
    } else {
      // Sort by creation date (newest first)
      filtered.sort((a, b) => b.created_at - a.created_at);
    }

    return filtered;
  }
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

/**
 * Hook that automatically switches between proximity and broad search based on user location
 */
export function useAdaptiveGeocaches(options: Omit<UseProximityGeocachesOptions, 'centerLat' | 'centerLng' | 'radiusKm'> & {
  userLocation?: { lat: number; lng: number } | null;
  searchLocation?: { lat: number; lng: number } | null;
  searchRadius?: number;
  showNearMe?: boolean;
}) {
  const proximityOptions: UseProximityGeocachesOptions = {
    ...options,
    // Use search location if available, otherwise user location if "Near Me" is active
    centerLat: options.searchLocation?.lat || (options.showNearMe ? options.userLocation?.lat : undefined),
    centerLng: options.searchLocation?.lng || (options.showNearMe ? options.userLocation?.lng : undefined),
    radiusKm: (options.searchLocation || (options.showNearMe && options.userLocation)) ? options.searchRadius : undefined,
    // Enable proximity optimization when we have location data
    useProximityOptimization: !!(options.searchLocation || (options.showNearMe && options.userLocation)),
  };

  return useProximityGeocaches(proximityOptions);
}