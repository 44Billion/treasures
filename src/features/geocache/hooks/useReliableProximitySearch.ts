/**
 * Completely redesigned proximity search with reliability and fallback mechanisms
 * Fixes all issues with the previous implementation
 */

import { useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useGeocacheStoreContext } from '@/shared/stores/hooks';
import { useCurrentUser } from '@/features/auth/hooks/useCurrentUser';
import { POLLING_INTERVALS } from '@/shared/config';
import type { ComparisonOperator } from '@/components/ui/comparison-filter';
import { calculateDistance as calculateGeoDistance } from '@/features/map/utils/geo';
import type { Geocache } from '@/shared/types';

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

export type GeocacheWithDistance = Geocache & { distance?: number; zapTotal?: number };

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

export function useReliableProximitySearch(options: UseReliableProximitySearchOptions = {}, baseGeocaches?: any[]) {
  const geocacheStore = useGeocacheStoreContext();
  const { user } = useCurrentUser();
  
  // Determine if proximity search should be attempted
  const hasProximityParams = !!(options.centerLat && options.centerLng && options.radiusKm);
  const shouldAttemptProximity = hasProximityParams && options.enableProximityOptimization !== false;
  
  // Query key includes all parameters that affect the query
  // Add baseGeocaches to the key to ensure cache consistency when using pre-fetched data
  const baseGeocachesCount = baseGeocaches?.length || 0;
  const baseGeocachesIds = baseGeocaches?.slice(0, 10).map(g => g.id).join('') || '';
  
  const queryKey = useMemo(() => [
    'reliable-proximity-search',
    {
      limit: options.limit,
      authorPubkey: options.authorPubkey,
      centerLat: options.centerLat,
      centerLng: options.centerLng,
      radiusKm: options.radiusKm,
      enableProximityOptimization: options.enableProximityOptimization,
      // Include base geocaches checksum to ensure cache consistency
      baseGeocachesCount,
      baseGeocachesIds,
    }
  ], [
    options.limit,
    options.authorPubkey,
    options.centerLat,
    options.centerLng,
    options.radiusKm,
    options.enableProximityOptimization,
    baseGeocachesCount,
    baseGeocachesIds,
  ]);

  const applyClientSideFilters = useCallback((geocaches: GeocacheWithDistance[]): GeocacheWithDistance[] => {
    console.log('🗺️ applyClientSideFilters input:', {
      totalCount: geocaches.length,
      hasStats: geocaches.some(g => 'foundCount' in g || 'zapTotal' in g),
      filters: {
        search: options.search,
        difficulty: options.difficulty,
        terrain: options.terrain,
        cacheType: options.cacheType,
        hasProximity: hasProximityParams
      }
    });

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
      // Preserve original order if no proximity search
      // Don't sort by creation date as this reorders the geocaches unexpectedly
    }

    console.log('🗺️ applyClientSideFilters output:', {
      filteredCount: filtered.length,
      hasStats: filtered.some(g => 'foundCount' in g || 'zapTotal' in g),
      sampleStats: filtered.slice(0, 3).map(g => ({
        name: g.name,
        foundCount: g.foundCount,
        zapTotal: g.zapTotal
      }))
    });

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
    queryFn: async (): Promise<SearchResult> => {
      let geocaches: Geocache[] = [];
      let searchStrategy: 'proximity' | 'broad' | 'fallback' = 'broad';
      let proximityAttempted = false;
      let proximitySuccessful = false;
      const debugInfo: any = {};

      // Step 1: Use pre-fetched geocaches if available, otherwise fetch from store
      try {
        if (baseGeocaches !== undefined) {
          geocaches = baseGeocaches;
          console.log('🗺️ useReliableProximitySearch using pre-fetched geocaches:', {
            count: geocaches.length,
            hasStats: geocaches.some(g => 'foundCount' in g || 'zapTotal' in g),
            sampleStats: baseGeocaches.slice(0, 3).map(g => ({
              name: g.name,
              foundCount: g.foundCount,
              zapTotal: g.zapTotal
            }))
          });
        } else {
          const result = await geocacheStore.fetchGeocaches();
          if (!result.success) {
            throw result.error;
          }
          
          geocaches = result.data || [];
          console.log('🗺️ useReliableProximitySearch fetched geocaches from store:', {
            count: geocaches.length,
            hasStats: geocaches.some(g => 'foundCount' in g || 'zapTotal' in g)
          });
        }
        
        searchStrategy = 'broad';
        proximityAttempted = shouldAttemptProximity;
        proximitySuccessful = shouldAttemptProximity;
      } catch (error) {
        console.error('❌ Failed to get geocaches:', error);
        debugInfo.fetchError = error instanceof Error ? error.message : String(error);
      }

      // Step 2: Filter out hidden caches unless user is the creator
      const visibleGeocaches = geocaches.filter(geocache => 
        !geocache.hidden || geocache.pubkey === user?.pubkey
      );

      // Step 3: Apply client-side filters
      const filteredGeocaches = applyClientSideFilters(visibleGeocaches);

      console.log('🗺️ useReliableProximitySearch final result:', {
        originalCount: geocaches.length,
        filteredCount: filteredGeocaches.length,
        originalHasStats: geocaches.some(g => 'foundCount' in g || 'zapTotal' in g),
        filteredHasStats: filteredGeocaches.some(g => 'foundCount' in g || 'zapTotal' in g),
        sampleOriginal: geocaches.slice(0, 1).map(g => ({
          name: g.name,
          foundCount: g.foundCount,
          zapTotal: g.zapTotal
        })),
        sampleFiltered: filteredGeocaches.slice(0, 1).map(g => ({
          name: g.name,
          foundCount: g.foundCount,
          zapTotal: g.zapTotal
        }))
      });

      return {
        geocaches: filteredGeocaches,
        searchStrategy,
        proximityAttempted,
        proximitySuccessful,
        totalFound: geocaches.length,
      };
    },
    staleTime: 300000, // 5 minutes - longer stale time to prevent unnecessary refetches
    gcTime: 600000, // 10 minutes cache retention
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
  // Allow passing pre-fetched geocaches to avoid duplicate fetches
  baseGeocaches?: any[];
}) {
  const searchOptions: UseReliableProximitySearchOptions = {
    ...options,
    centerLat: options.searchLocation?.lat || (options.showNearMe ? options.userLocation?.lat : undefined),
    centerLng: options.searchLocation?.lng || (options.showNearMe ? options.userLocation?.lng : undefined),
    radiusKm: (options.searchLocation || (options.showNearMe && options.userLocation)) ? options.searchRadius : undefined,
    enableProximityOptimization: !!(options.searchLocation || (options.showNearMe && options.userLocation)),
  };

  return useReliableProximitySearch(searchOptions, options.baseGeocaches);
}