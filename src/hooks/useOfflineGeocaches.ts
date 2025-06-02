/**
 * Enhanced geocache hooks with offline support
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { NostrEvent, NostrFilter } from '@nostrify/nostrify';
import { useNostr } from '@nostrify/react';
import type { Geocache } from '@/types/geocache';
import { useCurrentUser } from './useCurrentUser';
import { useOfflineSync, useOfflineMode } from './useOfflineStorage';
import { offlineStorage, CachedGeocache } from '@/lib/offlineStorage';
import { isSafari, createSafariNostr } from '@/lib/safariNostr';
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
  const { isOnline } = useOfflineMode();
  // Remove this line since we're using offlineStorage directly

  return useQuery({
    queryKey: ['geocaches', 'offline-aware', options, isOnline, isSafari()],
    staleTime: isOnline ? 60000 : Infinity, // 1 minute online, never stale offline
    gcTime: 300000, // 5 minutes
    queryFn: async (): Promise<GeocacheWithDistance[]> => {
      if (isOnline) {
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
          geocachesWithDistance = await addLogCounts(geocachesWithDistance, nostr, isOnline);

          return geocachesWithDistance;
        } catch (error) {
          console.warn('Online geocache query failed, falling back to offline data:', error);
          return await getOfflineGeocaches(options);
        }
      } else {
        // Offline mode
        return await getOfflineGeocaches(options);
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
    },
  });
}

// Get geocaches from offline storage
async function getOfflineGeocaches(options: UseOfflineGeocachesOptions): Promise<GeocacheWithDistance[]> {
  try {
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

    // Convert cached geocaches to Geocache format
    let geocaches: Geocache[] = cachedGeocaches
      .map(cached => parseGeocacheEvent(cached.event))
      .filter((g): g is Geocache => g !== null);

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
    const logFilter: NostrFilter = {
      kinds: [NIP_GC_KINDS.LOG],
      '#a': limitedCaches.map(g => createGeocacheCoordinate(g.pubkey, g.dTag)),
      limit: isSafari() ? 100 : 500,
    };

    let logEvents: NostrEvent[];
    
    if (isSafari()) {
      const safariClient = createSafariNostr(['wss://ditto.pub/relay']);
      try {
        logEvents = await safariClient.query([logFilter], { timeout: 4000, maxRetries: 1 });
        safariClient.close();
      } catch (error) {
        safariClient.close();
        logEvents = [];
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