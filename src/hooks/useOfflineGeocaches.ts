/**
 * Enhanced geocache hooks with offline support
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { NostrEvent, NostrFilter } from '@nostrify/nostrify';
import { useNostr } from '@nostrify/react';
import type { Geocache } from '@/types/geocache';
import { useCurrentUser } from './useCurrentUser';
import { useOfflineSync, useOfflineMode } from './useOfflineStorage';
import { useCacheInvalidation } from './useCacheInvalidation';
import { offlineStorage, CachedGeocache } from '@/lib/offlineStorage';
import { queryNostr, batchQueryNostr } from '@/lib/nostrQuery';
import { TIMEOUTS, QUERY_LIMITS } from '@/lib/constants';
import { isSafari } from '@/lib/safariNostr';
import { NIP_GC_KINDS, parseGeocacheEvent, parseLogEvent, getGeohashesInRadius, getGeohashPrefixes, getOptimalPrecision, createGeocacheCoordinate } from '@/lib/nip-gc';
import { calculateDistance } from '@/lib/geo';
import type { ComparisonOperator } from '@/components/ui/comparison-filter';

interface UseOfflineGeocachesOptions {
  limit?: number;
  search?: string;
  difficulty?: number;
  terrain?: number;
  authorPubkey?: string;
  bounds?: {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
  };
  // Proximity search options
  centerLat?: number;
  centerLng?: number;
  radiusKm?: number;
  useProximityOptimization?: boolean;
  // Comparison operators
  difficultyOperator?: ComparisonOperator;
  terrainOperator?: ComparisonOperator;
}

export type GeocacheWithDistance = Geocache & { distance?: number };

export function useOfflineGeocaches(options: UseOfflineGeocachesOptions = {}) {
  const { nostr } = useNostr();
  const { isOnline, isConnected, connectionQuality } = useOfflineMode();
  
  // Enable cache invalidation monitoring
  useCacheInvalidation();

  return useQuery({
    queryKey: ['geocaches', 'offline-aware', options, isOnline && isConnected && navigator.onLine, isSafari()],
    staleTime: (isOnline && isConnected && navigator.onLine) ? 60000 : Infinity, // 1 minute online, never stale offline
    gcTime: 300000, // 5 minutes
    retry: false, // Disable retries to prevent cache invalidation
    refetchOnReconnect: true, // Refetch when connection is restored
    networkMode: 'always', // Always run queries regardless of network status
    queryFn: async (): Promise<GeocacheWithDistance[]> => {
      console.log('useOfflineGeocaches query starting...', {
        isOnline,
        isConnected,
        connectionQuality,
        hasOptions: Object.keys(options).length > 0,
        navigatorOnline: navigator.onLine
      });
      
      // Always try to get offline data first as a fallback
      const offlineData = await getOfflineGeocaches(options);
      console.log(`Offline data available: ${offlineData.length} geocaches`);
      
      // If we're truly offline or not connected, return offline data immediately
      if (!navigator.onLine || !isOnline || !isConnected || connectionQuality === 'offline') {
        console.log('Using offline data - not connected to internet', {
          navigatorOnline: navigator.onLine,
          isOnline,
          isConnected,
          connectionQuality
        });
        return offlineData;
      }

      try {
        // Online query with proximity optimization
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
        let geocaches: Geocache[] = events
          .map(parseGeocacheEvent)
          .filter((g): g is Geocache => g !== null);

        // Cache geocaches offline
        for (const geocache of geocaches) {
          try {
            const cachedGeocache: CachedGeocache = {
              id: geocache.id,
              event: events.find(e => e.id === geocache.id)!,
              lastUpdated: Date.now(),
              lastValidated: Date.now(), // Mark as validated since we just fetched it
              coordinates: geocache.location ? [geocache.location.lat, geocache.location.lng] : undefined,
              difficulty: geocache.difficulty,
              terrain: geocache.terrain,
              type: geocache.type,
            };
            await offlineStorage.storeGeocache(cachedGeocache);
          } catch (error) {
            console.warn('Failed to cache geocache offline:', error);
          }
        }

        // Apply proximity filtering and add distance if specified
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

        // Apply filters and get log counts
        geocachesWithDistance = applyFilters(geocachesWithDistance, options);
        geocachesWithDistance = await addLogCounts(geocachesWithDistance, nostr, true);

        console.log(`Online query successful - found ${geocachesWithDistance.length} geocaches`);
        return geocachesWithDistance;
      } catch (error) {
        console.warn('Online geocache query failed, using offline data:', error);
        // Return offline data instead of throwing error
        return offlineData;
      }
      
      async function queryByProximity(): Promise<NostrEvent[]> {
        if (!options.centerLat || !options.centerLng || !options.radiusKm) {
          throw new Error('Proximity search requires centerLat, centerLng, and radiusKm');
        }

        // Use more conservative precision to cast a wider net
        const precision = Math.min(
          getOptimalPrecision(options.radiusKm),
          5 // max precision
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
          limit: options.limit || (isSafari() ? QUERY_LIMITS.SAFARI_GEOCACHES : QUERY_LIMITS.STANDARD_GEOCACHES),
        };

        if (options.authorPubkey) {
          filter.authors = [options.authorPubkey];
        }

        // Use unified query utility
        return await queryNostr(nostr, [filter], {
          timeout: isSafari() ? TIMEOUTS.SAFARI_QUERY_RETRY : TIMEOUTS.STANDARD_QUERY,
          maxRetries: isSafari() ? 2 : 3,
        });
      }

      async function safariProximityQuery(targetHashes: string[]): Promise<NostrEvent[]> {
        // Query in batches for better efficiency
        const batchSize = isSafari() ? 8 : 12;
        const filterGroups: NostrFilter[][] = [];
        
        for (let i = 0; i < targetHashes.length; i += batchSize) {
          const batch = targetHashes.slice(i, i + batchSize);
          
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
        
        // Use batch query utility
        return await batchQueryNostr(nostr, filterGroups, {
          timeout: isSafari() ? TIMEOUTS.SAFARI_QUERY : TIMEOUTS.STANDARD_QUERY,
          maxRetries: 1,
        });
      }

      async function standardProximityQuery(targetHashes: string[]): Promise<NostrEvent[]> {
        const filter: NostrFilter = {
          kinds: [NIP_GC_KINDS.GEOCACHE],
          '#g': targetHashes,
          limit: options.limit || QUERY_LIMITS.PROXIMITY_RESULTS
        };

        if (options.authorPubkey) {
          filter.authors = [options.authorPubkey];
        }

        // Use unified query utility
        return await queryNostr(nostr, [filter], {
          timeout: TIMEOUTS.STANDARD_QUERY,
          maxRetries: 2,
        });
      }
    },
  });
}

// Get geocaches from offline storage
async function getOfflineGeocaches(options: UseOfflineGeocachesOptions): Promise<GeocacheWithDistance[]> {
  try {
    // Initialize offline storage if needed
    await offlineStorage.init();
    
    let cachedGeocaches: CachedGeocache[];

    if (options.bounds) {
      cachedGeocaches = await offlineStorage.getGeocachesInBounds(
        options.bounds.minLat,
        options.bounds.maxLat,
        options.bounds.minLng,
        options.bounds.maxLng
      );
    } else {
      cachedGeocaches = await offlineStorage.getAllGeocaches();
    }

    console.log(`Found ${cachedGeocaches.length} cached geocaches in offline storage`);

    // Convert cached geocaches to Geocache format
    let geocaches: Geocache[] = cachedGeocaches
      .map(cached => parseGeocacheEvent(cached.event))
      .filter((g): g is Geocache => g !== null);

    console.log(`Successfully parsed ${geocaches.length} geocaches from cache`);

    // Apply proximity filtering and add distance if specified
    let geocachesWithDistance: GeocacheWithDistance[];
    if (options.centerLat && options.centerLng && options.radiusKm) {
      // Add distance to all results and sort by distance
      geocachesWithDistance = geocaches.map(cache => ({
        ...cache,
        distance: calculateDistance(options.centerLat!, options.centerLng!, cache.location.lat, cache.location.lng)
      }));
      
      // Filter by radius
      geocachesWithDistance = geocachesWithDistance
        .filter(cache => cache.distance! <= options.radiusKm!)
        .sort((a, b) => (a.distance || 0) - (b.distance || 0));
      
      console.log(`After proximity filtering: ${geocachesWithDistance.length} geocaches within ${options.radiusKm}km`);
    } else {
      // No proximity filtering, just convert type and sort by creation date
      geocachesWithDistance = geocaches
        .map(cache => ({ ...cache }))
        .sort((a, b) => b.created_at - a.created_at);
    }

    // Apply filters
    geocachesWithDistance = applyFilters(geocachesWithDistance, options);

    // Apply limit
    if (options.limit) {
      geocachesWithDistance = geocachesWithDistance.slice(0, options.limit);
    }

    console.log(`Final offline result: ${geocachesWithDistance.length} geocaches`);
    return geocachesWithDistance;
  } catch (error) {
    console.error('Failed to get offline geocaches:', error);
    return [];
  }
}

// Apply client-side filters
function applyFilters(geocaches: GeocacheWithDistance[], options: UseOfflineGeocachesOptions): GeocacheWithDistance[] {
  let filtered = [...geocaches];

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

  if (options.authorPubkey) {
    filtered = filtered.filter(g => g.pubkey === options.authorPubkey);
  }

  return filtered;
}

// Add log counts to geocaches
async function addLogCounts(geocaches: GeocacheWithDistance[], nostr: any, isOnline: boolean): Promise<GeocacheWithDistance[]> {
  if (geocaches.length === 0 || !isOnline) {
    return geocaches;
  }

  try {
    const limitedCaches = geocaches.slice(0, isSafari() ? 5 : 10);
    const geocacheCoordinates = limitedCaches.map(g => createGeocacheCoordinate(g.pubkey, g.dTag));
    
    // Query both found logs and comment logs
    const foundLogFilter: NostrFilter = {
      kinds: [NIP_GC_KINDS.FOUND_LOG],
      '#a': geocacheCoordinates,
      limit: isSafari() ? QUERY_LIMITS.SAFARI_LOGS / 2 : QUERY_LIMITS.STANDARD_LOGS / 2,
    };
    
    const commentLogFilter: NostrFilter = {
      kinds: [NIP_GC_KINDS.COMMENT_LOG],
      '#a': geocacheCoordinates,
      '#A': geocacheCoordinates,
      limit: isSafari() ? QUERY_LIMITS.SAFARI_LOGS / 2 : QUERY_LIMITS.STANDARD_LOGS / 2,
    };

    // Use unified query utility with error handling
    let logEvents: NostrEvent[] = [];
    try {
      const [foundEvents, commentEvents] = await Promise.all([
        queryNostr(nostr, [foundLogFilter], {
          timeout: isSafari() ? TIMEOUTS.SAFARI_QUERY : TIMEOUTS.STANDARD_QUERY,
          maxRetries: 1,
        }),
        queryNostr(nostr, [commentLogFilter], {
          timeout: isSafari() ? TIMEOUTS.SAFARI_QUERY : TIMEOUTS.STANDARD_QUERY,
          maxRetries: 1,
        }),
      ]);
      logEvents = [...foundEvents, ...commentEvents];
    } catch (error) {
      logEvents = [];
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
    console.warn('Failed to get log counts:', error);
    return geocaches;
  }
}

// Hook for creating geocaches with offline support
export function useOfflineCreateGeocache() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const { queueAction } = useOfflineSync();
  const { isOnline } = useOfflineMode();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (geocacheData: {
      name: string;
      description: string;
      coordinates: { lat: number; lng: number };
      difficulty: number;
      terrain: number;
      type: string;
      hint?: string;
    }) => {
      const eventTemplate = {
        kind: NIP_GC_KINDS.GEOCACHE,
        content: JSON.stringify({
          name: geocacheData.name,
          description: geocacheData.description,
          hint: geocacheData.hint,
        }),
        tags: [
          ['d', `${Date.now()}`], // Unique identifier
          ['g', `${geocacheData.coordinates.lat},${geocacheData.coordinates.lng}`],
          ['difficulty', geocacheData.difficulty.toString()],
          ['terrain', geocacheData.terrain.toString()],
          ['type', geocacheData.type],
          ['client', 'treasures'],
        ],
      };

      if (!user?.signer) {
        throw new Error('User not logged in or no signer available');
      }

      // First, sign the event
      const signedEvent = await user.signer.signEvent({
        kind: NIP_GC_KINDS.GEOCACHE,
        content: eventTemplate.content || '',
        tags: eventTemplate.tags || [],
        created_at: Math.floor(Date.now() / 1000),
      });

      if (isOnline) {
        try {
          await nostr.event(signedEvent);
          
          // Cache the created geocache offline
          const cachedGeocache: CachedGeocache = {
            id: signedEvent.id,
            event: signedEvent,
            lastUpdated: Date.now(),
            lastValidated: Date.now(), // Mark as validated since we just created it
            coordinates: [geocacheData.coordinates.lat, geocacheData.coordinates.lng],
            difficulty: geocacheData.difficulty,
            terrain: geocacheData.terrain,
            type: geocacheData.type,
          };
          await offlineStorage.storeGeocache(cachedGeocache);

          return signedEvent;
        } catch (error) {
          console.warn('Online geocache creation failed, queuing for later:', error);
          await queueAction('publish_event', { event: signedEvent });
          throw error;
        }
      } else {
        // Offline mode - queue for later
        await queueAction('publish_event', { event: signedEvent });
        return signedEvent;
      }
    },
    onSuccess: () => {
      // Invalidate geocache queries to refetch data
      queryClient.invalidateQueries({ queryKey: ['geocaches'] });
    },
  });
}

// Hook for proximity-based geocaches with offline support
export function useOfflineProximityGeocaches(
  userLocation: { lat: number; lng: number } | null,
  radiusKm: number = 10
) {
  const bounds = userLocation ? {
    minLat: userLocation.lat - (radiusKm / 111), // Rough conversion: 1 degree ≈ 111 km
    maxLat: userLocation.lat + (radiusKm / 111),
    minLng: userLocation.lng - (radiusKm / (111 * Math.cos(userLocation.lat * Math.PI / 180))),
    maxLng: userLocation.lng + (radiusKm / (111 * Math.cos(userLocation.lat * Math.PI / 180))),
  } : undefined;

  return useOfflineGeocaches({
    bounds,
    limit: 50,
  });
}

// Hook for bookmarking geocaches with offline support
export function useOfflineBookmarkGeocache() {
  const { queueAction } = useOfflineSync();
  const { isOnline } = useOfflineMode();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ geocacheId, bookmarked }: { geocacheId: string; bookmarked: boolean }) => {
      if (isOnline) {
        // Implement online bookmarking logic here
        // This would typically involve creating a bookmark event
        console.log('Bookmarking online:', geocacheId, bookmarked);
      } else {
        // Queue for offline sync
        await queueAction('bookmark_cache', { geocacheId, bookmarked });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookmarks'] });
    },
  });
}

/**
 * Hook that automatically switches between proximity and broad search based on user location
 * This is the offline-aware version of useAdaptiveGeocaches
 */
export function useOfflineAdaptiveGeocaches(options: Omit<UseOfflineGeocachesOptions, 'centerLat' | 'centerLng' | 'radiusKm'> & {
  userLocation?: { lat: number; lng: number } | null;
  searchLocation?: { lat: number; lng: number } | null;
  searchRadius?: number;
  showNearMe?: boolean;
  // Additional options for comparison filters
  difficultyOperator?: ComparisonOperator;
  terrainOperator?: ComparisonOperator;
}) {
  const proximityOptions: UseOfflineGeocachesOptions = {
    ...options,
    // Use search location if available, otherwise user location if \"Near Me\" is active
    centerLat: options.searchLocation?.lat || (options.showNearMe ? options.userLocation?.lat : undefined),
    centerLng: options.searchLocation?.lng || (options.showNearMe ? options.userLocation?.lng : undefined),
    radiusKm: (options.searchLocation || (options.showNearMe && options.userLocation)) ? options.searchRadius : undefined,
    // Enable proximity optimization when we have location data
    useProximityOptimization: !!(options.searchLocation || (options.showNearMe && options.userLocation)),
  };

  return useOfflineGeocaches(proximityOptions);
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