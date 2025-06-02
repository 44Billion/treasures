/**
 * Enhanced geocache hook with proximity search optimization
 * Replaces useAdvancedGeocaches with geohash-based proximity queries
 */

import { useMemo } from 'react';
import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';
import { NostrEvent, NostrFilter } from '@nostrify/nostrify';
import type { Geocache } from '@/types/geocache';
import { isSafari, createSafariNostr } from '@/lib/safariNostr';
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
  const { nostr } = useNostr();
  
  const queryKey = useMemo(() => [
    'geocaches-proximity', 
    options, 
    isSafari()
  ], [options]);

  return useQuery({
    queryKey,
    staleTime: 60000, // 1 minute
    gcTime: 300000, // 5 minutes
    queryFn: async (): Promise<GeocacheWithDistance[]> => {
      try {
        let events: NostrEvent[];
        
        // Determine search strategy
        const hasProximitySearch = options.centerLat && options.centerLng && options.radiusKm;
        const useOptimization = hasProximitySearch && options.useProximityOptimization !== false;
        
        if (useOptimization) {
          events = await queryByProximity();
          
          // If proximity search returns very few results, also try a broader search
          if (events.length < 5) {
            const broadEvents = await queryBroad();
            // Combine and deduplicate
            const eventIds = new Set(events.map(e => e.id));
            const newEvents = broadEvents.filter(e => !eventIds.has(e.id));
            events = [...events, ...newEvents];
          }
        } else {
          events = await queryBroad();
        }
        
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

        // Get log counts for limited set
        geocachesWithDistance = await addLogCounts(geocachesWithDistance);

        return geocachesWithDistance;
      } catch (error) {
        console.error('Error in proximity geocache query:', error);
        throw error;
      }
    },
  });

  async function queryByProximity(): Promise<NostrEvent[]> {
    if (!options.centerLat || !options.centerLng || !options.radiusKm) {
      throw new Error('Proximity search requires centerLat, centerLng, and radiusKm');
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

    if (isSafari()) {
      return await safariProximityQuery(allHashes);
    } else {
      return await standardProximityQuery(allHashes);
    }
  }

  async function queryBroad(): Promise<NostrEvent[]> {
    // Build standard filter
    const filter: NostrFilter = {
      kinds: [NIP_GC_KINDS.GEOCACHE],
      limit: options.limit || (isSafari() ? 30 : 100),
    };

    if (options.authorPubkey) {
      filter.authors = [options.authorPubkey];
    }

    if (isSafari()) {
      const safariClient = createSafariNostr(['wss://ditto.pub/relay']);
      try {
        const events = await safariClient.query([filter], { timeout: 6000, maxRetries: 2 });
        safariClient.close();
        return events;
      } catch (error) {
        safariClient.close();
        throw error;
      }
    } else {
      return await Promise.race([
        nostr.query([filter]),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Query timeout')), 15000)
        )
      ]);
    }
  }

  async function safariProximityQuery(targetHashes: string[]): Promise<NostrEvent[]> {
    const safariClient = createSafariNostr(['wss://ditto.pub/relay']);
    
    try {
      const allEvents: NostrEvent[] = [];
      
      // Query in larger batches for better efficiency
      const batchSize = 8;
      for (let i = 0; i < targetHashes.length; i += batchSize) {
        const batch = targetHashes.slice(i, i + batchSize);
        
        try {
          const filter: NostrFilter = {
            kinds: [NIP_GC_KINDS.GEOCACHE],
            '#g': batch,
            limit: 50
          };
          
          if (options.authorPubkey) {
            filter.authors = [options.authorPubkey];
          }
          
          const events = await safariClient.query([filter], { timeout: 5000 });
          allEvents.push(...events);
          
          // Shorter delay between batches
          if (i + batchSize < targetHashes.length) {
            await new Promise(resolve => setTimeout(resolve, 50));
          }
        } catch (error) {
          // Continue with next batch
        }
      }
      
      safariClient.close();
      return allEvents;
    } catch (error) {
      safariClient.close();
      throw error;
    }
  }

  async function standardProximityQuery(targetHashes: string[]): Promise<NostrEvent[]> {
    const filter: NostrFilter = {
      kinds: [NIP_GC_KINDS.GEOCACHE],
      '#g': targetHashes,
      limit: options.limit || 150
    };

    if (options.authorPubkey) {
      filter.authors = [options.authorPubkey];
    }

    return await Promise.race([
      nostr.query([filter]),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Proximity query timeout')), 15000)
      )
    ]);
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

  async function addLogCounts(geocaches: GeocacheWithDistance[]): Promise<GeocacheWithDistance[]> {
    if (geocaches.length === 0) return geocaches;

    try {
      // Limit the number of caches we query logs for
      const limitedCaches = geocaches.slice(0, isSafari() ? 8 : 15);
      const logFilter: NostrFilter = {
        kinds: [NIP_GC_KINDS.LOG],
        '#a': limitedCaches.map(g => createGeocacheCoordinate(g.pubkey, g.dTag)),
        limit: isSafari() ? 200 : 500,
      };

      let logEvents: NostrEvent[];
      
      if (isSafari()) {
        const safariClient = createSafariNostr(['wss://ditto.pub/relay']);
        
        try {
          logEvents = await safariClient.query([logFilter], { timeout: 4000, maxRetries: 1 });
          safariClient.close();
        } catch (error) {
          safariClient.close();
          console.warn('Safari log query failed:', error);
          return geocaches; // Return without log counts
        }
      } else {
        logEvents = await Promise.race([
          nostr.query([logFilter]),
          new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('Log query timeout')), 10000)
          )
        ]);
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
    } catch (error) {
      console.warn('Error fetching log counts:', error);
      return geocaches; // Continue without log counts
    }
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