import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { NIP_GC_KINDS } from '@/features/geocache/utils/nip-gc';
import { TIMEOUTS } from '@/lib/constants';
import { TREASURE_MAP_KIND } from '../types/treasure-map';
import { parseTreasureMapEvent, createTreasureMapNaddr } from '../utils/treasure-map-utils';
import { SAMPLE_TREASURE_MAP_EVENTS } from '../data/sample-events';
import type { TreasureMap } from '../types/treasure-map';
import type { Geocache } from '@/features/geocache/types/geocache';

// List of approved pubkeys that can create treasure maps
const APPROVED_TREASURE_MAP_CREATORS = [
  '86184109eae937d8d6f980b4a0b46da4ef0d983eade403ee1b4c0b6bde238b47', // chad (current user)
  // Add more approved pubkeys here
];

/**
 * Hook for fetching approved treasure maps from Nostr
 */
export function useTreasureMaps() {
  const { nostr } = useNostr();

  const { data: treasureMaps = [], isLoading, error } = useQuery({
    queryKey: ['treasure-maps', 'approved'],
    queryFn: async (context) => {
      const signal = AbortSignal.any([context.signal, AbortSignal.timeout(TIMEOUTS.QUERY)]);

      // For now, use sample events. In production, this would fetch from Nostr
      const parsedMaps = SAMPLE_TREASURE_MAP_EVENTS
        .map(event => parseTreasureMapEvent(event))
        .filter((map): map is TreasureMap => map !== null);

      // Sort by creation date (newest first)
      return parsedMaps.sort((a, b) => b.created_at - a.created_at);
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  return {
    treasureMaps,
    isLoading,
    error
  };
}

/**
 * Hook for fetching a single treasure map by ID
 */
export function useTreasureMap(mapId?: string) {
  const { nostr } = useNostr();

  // First try to find in approved maps
  const { treasureMaps } = useTreasureMaps();
  const approvedMap = useMemo(() => {
    if (!mapId) return null;
    return treasureMaps.find(map => map.id === mapId) || null;
  }, [mapId, treasureMaps]);

  // If not found in approved maps, try to fetch by naddr or dTag
  const { data: treasureMap = null, isLoading } = useQuery({
    queryKey: ['treasure-map', mapId],
    queryFn: async (context) => {
      if (!mapId || approvedMap) return approvedMap;

      const signal = AbortSignal.any([context.signal, AbortSignal.timeout(TIMEOUTS.QUERY)]);

      // Try to parse as naddr or dTag
      let filter: any;

      if (mapId.includes(':')) {
        // Looks like naddr or coordinate
        const [kind, pubkey, dTag] = mapId.split(':');
        if (kind && pubkey && dTag) {
          filter = {
            kinds: [parseInt(kind)],
            authors: [pubkey],
            '#d': [dTag],
            limit: 1,
          };
        }
      } else {
        // Treat as dTag only - search all approved creators
        filter = {
          kinds: [TREASURE_MAP_KIND],
          authors: APPROVED_TREASURE_MAP_CREATORS,
          '#d': [mapId],
          limit: 1,
        };
      }

      if (!filter) return null;

      const events = await nostr.query([filter], { signal });
      if (events.length === 0) return null;

      const parsedMap = parseTreasureMapEvent(events[0]);
      return parsedMap || null;
    },
    enabled: !!mapId && !approvedMap,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
  });

  return {
    treasureMap: approvedMap || treasureMap,
    isLoading: approvedMap ? false : isLoading
  };
}

/**
 * Hook for fetching geocaches within a treasure map area
 */
export function useTreasureMapGeocaches(treasureMap: TreasureMap | null) {
  const { nostr } = useNostr();

  const { data: geocaches = [], isLoading, error } = useQuery({
    queryKey: ['treasure-map-geocaches', treasureMap?.id],
    queryFn: async (context) => {
      if (!treasureMap) return [];

      const signal = AbortSignal.any([context.signal, AbortSignal.timeout(TIMEOUTS.QUERY)]);

      // Build filter based on treasure map area
      let filter: any = { kinds: [NIP_GC_KINDS.GEOCACHE] };

      if (treasureMap.area.bounds) {
        // Filter by bounding box
        filter = {
          ...filter,
          '#L': ['g'], // Geolocation tag
          since: Math.floor(Date.now() / 1000) - 365 * 24 * 60 * 60, // Last year
          limit: 100
        };
      } else if (treasureMap.area.center && treasureMap.area.radius) {
        // Filter by center and radius - we'll get a broader area and filter client-side
        filter = {
          ...filter,
          '#L': ['g'],
          since: Math.floor(Date.now() / 1000) - 365 * 24 * 60 * 60,
          limit: 200 // Get more to allow for client-side filtering
        };
      }

      const events = await nostr.query([filter], { signal });

      // Transform events to geocaches (simplified - in reality you'd use the existing geocache parsing logic)
      const parsedGeocaches: Geocache[] = events.map(event => {
        const tags = event.tags;
        const locationTag = tags.find(tag => tag[0] === 'L' && tag[1] === 'g');
        const nameTag = tags.find(tag => tag[0] === 'name');
        const descTag = tags.find(tag => tag[0] === 'description');

        // Parse location from geohash or coordinates
        let location = { lat: 0, lng: 0 };
        if (locationTag && locationTag[2]) {
          // This is a simplified parser - real implementation would be more robust
          try {
            const coords = locationTag[2].split(',');
            location = {
              lat: parseFloat(coords[0]),
              lng: parseFloat(coords[1])
            };
          } catch (e) {
            console.warn('Failed to parse location:', e);
          }
        }

        return {
          id: event.id,
          pubkey: event.pubkey,
          created_at: event.created_at,
          dTag: event.tags.find(tag => tag[0] === 'd')?.[1] || '',
          name: nameTag?.[1] || 'Unknown Cache',
          description: descTag?.[1] || '',
          location,
          difficulty: 3, // Default values
          terrain: 3,
          size: 'regular',
          type: 'traditional',
        } as Geocache;
      });

      // Filter geocaches based on treasure map area and filters
      const filteredGeocaches = parsedGeocaches.filter(geocache => {
        // Check if geocache is within the treasure map area
        if (!isGeocacheInArea(geocache, treasureMap)) {
          return false;
        }

        // Apply additional filters if specified
        if (treasureMap.filters) {
          const { difficulty, terrain, types, sizes } = treasureMap.filters;

          if (difficulty && (geocache.difficulty < difficulty.min || geocache.difficulty > difficulty.max)) {
            return false;
          }

          if (terrain && (geocache.terrain < terrain.min || geocache.terrain > terrain.max)) {
            return false;
          }

          if (types && types.length > 0 && !types.includes(geocache.type)) {
            return false;
          }

          if (sizes && sizes.length > 0 && !sizes.includes(geocache.size)) {
            return false;
          }
        }

        return true;
      });

      return filteredGeocaches;
    },
    enabled: !!treasureMap,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
  });

  return {
    geocaches,
    isLoading,
    error
  };
}

/**
 * Helper function to check if a geocache is within a treasure map area
 */
function isGeocacheInArea(geocache: Geocache, treasureMap: TreasureMap): boolean {
  const { lat, lng } = geocache.location;

  if (treasureMap.area.bounds) {
    // Check if within bounding box
    const { northEast, southWest } = treasureMap.area.bounds;
    return (
      lat <= northEast.lat &&
      lat >= southWest.lat &&
      lng <= northEast.lng &&
      lng >= southWest.lng
    );
  } else if (treasureMap.area.center && treasureMap.area.radius) {
    // Check if within radius of center point
    const { center, radius } = treasureMap.area;
    const distance = calculateDistance(
      center.lat, center.lng,
      lat, lng
    );
    return distance <= radius;
  }

  return true; // If no area constraints, include all geocaches
}

/**
 * Calculate distance between two points in kilometers
 */
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;

  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}