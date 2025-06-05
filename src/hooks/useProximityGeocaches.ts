/**
 * Enhanced geocache hook with proximity search optimization
 * Replaces useAdvancedGeocaches with geohash-based proximity queries
 */

import { useMemo, useCallback } from 'react';
import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';
import { NostrEvent, NostrFilter } from '@nostrify/nostrify';
import type { Geocache } from '@/types/geocache';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useDeletionFilter } from '@/hooks/useDeletionFilter';
import { TIMEOUTS, QUERY_LIMITS, POLLING_INTERVALS } from '@/lib/constants';
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
  cacheType?: string;
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
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  
  // Get deletion filter for filtering out deleted geocaches
  const { filterDeleted } = useDeletionFilter();
  
  const queryKey = useMemo(() => [
    'geocaches-proximity', 
    options
  ], [options]);

  // Determine search strategy
  const hasProximitySearch = options.centerLat && options.centerLng && options.radiusKm;
  const useOptimization = hasProximitySearch && options.useProximityOptimization !== false;

  // Helper functions moved outside of useMemo to prevent dependency issues
  const createProximityFilterGroups = useCallback((): NostrFilter[][] => {
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
  }, [options.centerLat, options.centerLng, options.radiusKm, options.maxProximityPrecision, options.authorPubkey]);

  const createBroadFilterGroups = useCallback((): NostrFilter[][] => {
    const filter: NostrFilter = {
      kinds: [NIP_GC_KINDS.GEOCACHE],
      limit: options.limit || QUERY_LIMITS.GEOCACHES,
    };

    if (options.authorPubkey) {
      filter.authors = [options.authorPubkey];
    }

    return [[filter]];
  }, [options.limit, options.authorPubkey]);

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

    // Cache type filter
    if (options.cacheType && options.cacheType !== 'all') {
      filtered = filtered.filter(g => g.type === options.cacheType);
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
  }, [options.search, options.difficulty, options.difficultyOperator, options.terrain, options.terrainOperator, options.cacheType]);

  // Create filter groups based on strategy
  const filterGroups = useMemo(() => {
    if (useOptimization) {
      return createProximityFilterGroups();
    } else {
      return createBroadFilterGroups();
    }
  }, [useOptimization, createProximityFilterGroups, createBroadFilterGroups]);

  const { data: events, ...queryResult } = useQuery({
    queryKey,
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(TIMEOUTS.QUERY)]);
      const allEvents: NostrEvent[] = [];
      
      // Execute each filter group
      for (const filters of filterGroups) {
        try {
          const batchEvents = await nostr.query(filters, { signal });
          allEvents.push(...batchEvents);
        } catch (error) {
          console.warn('Filter group failed:', error);
        }
      }
      
      return allEvents;
    },
    staleTime: 60000, // 1 minute
    gcTime: 300000, // 5 minutes
    refetchInterval: POLLING_INTERVALS.GEOCACHES, // Poll every minute
    refetchIntervalInBackground: true, // Continue polling in background
    refetchOnWindowFocus: false, // Don't refetch on focus to avoid excessive requests
  });

  // Process the events
  const processedData = useMemo(() => {
    if (!events || events.length === 0) return [];

    try {
      // Filter out deleted events first
      const nonDeletedEvents = filterDeleted.fast(events);

      // Parse geocaches and filter out hidden caches from public listings
      const geocaches: Geocache[] = nonDeletedEvents
        .map(parseGeocacheEvent)
        .filter((g): g is Geocache => g !== null)
        .filter(g => !g.hidden || g.pubkey === user?.pubkey); // Show hidden caches to their creator

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
  }, [events, hasProximitySearch, options.centerLat, options.centerLng, options.radiusKm, user?.pubkey, applyClientSideFilters, filterDeleted]);

  return {
    ...queryResult,
    data: processedData,
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