import { nip19 } from 'nostr-tools';
import type { NostrEvent } from '@nostrify/nostrify';
import type { TreasureMap, CreateTreasureMapData } from '../types/treasure-map';
import { TREASURE_MAP_KIND, TREASURE_MAP_APPROVAL_KIND } from '../types/treasure-map';

// ===== VALIDATION =====

export const VALID_TREASURE_MAP_CATEGORIES = ['city', 'park', 'region', 'trail', 'landmark'] as const;
export const VALID_DIFFICULTY_LEVELS = ['Easy', 'Moderate', 'Challenging'] as const;

export type ValidTreasureMapCategory = typeof VALID_TREASURE_MAP_CATEGORIES[number];
export type ValidDifficultyLevel = typeof VALID_DIFFICULTY_LEVELS[number];

export function validateTreasureMapCategory(category: string): category is ValidTreasureMapCategory {
  return VALID_TREASURE_MAP_CATEGORIES.includes(category as ValidTreasureMapCategory);
}

export function validateDifficultyLevel(difficulty: string): difficulty is ValidDifficultyLevel {
  return VALID_DIFFICULTY_LEVELS.includes(difficulty as ValidDifficultyLevel);
}

export function validateCoordinates(lat: number, lng: number): boolean {
  return !isNaN(lat) && !isNaN(lng) &&
         lat >= -90 && lat <= 90 &&
         lng >= -180 && lng <= 180;
}

// ===== PARSING =====

export function parseTreasureMapEvent(event: NostrEvent): TreasureMap | null {
  try {
    // Only handle treasure map events
    if (event.kind !== TREASURE_MAP_KIND) {
      return null;
    }

    const dTag = event.tags.find(t => t[0] === 'd')?.[1];
    if (!dTag) {
      return null;
    }

    // Parse required tags
    const name = event.tags.find(t => t[0] === 'name')?.[1];
    const category = event.tags.find(t => t[0] === 'category')?.[1];

    // Validate required fields
    if (!name || !category) {
      return null;
    }

    // Validate category
    if (!validateTreasureMapCategory(category)) {
      return null;
    }

    // Parse area - either center+radius or bounds
    let area: TreasureMap['area'] = {};

    const centerLat = event.tags.find(t => t[0] === 'center_lat')?.[1];
    const centerLng = event.tags.find(t => t[0] === 'center_lng')?.[1];
    const radius = event.tags.find(t => t[0] === 'radius')?.[1];

    if (centerLat && centerLng) {
      area.center = {
        lat: parseFloat(centerLat),
        lng: parseFloat(centerLng),
      };

      if (radius) {
        area.radius = parseFloat(radius);
      }
    }

    const neLat = event.tags.find(t => t[0] === 'bounds_ne_lat')?.[1];
    const neLng = event.tags.find(t => t[0] === 'bounds_ne_lng')?.[1];
    const swLat = event.tags.find(t => t[0] === 'bounds_sw_lat')?.[1];
    const swLng = event.tags.find(t => t[0] === 'bounds_sw_lng')?.[1];

    if (neLat && neLng && swLat && swLng) {
      area.bounds = {
        northEast: {
          lat: parseFloat(neLat),
          lng: parseFloat(neLng),
        },
        southWest: {
          lat: parseFloat(swLat),
          lng: parseFloat(swLng),
        },
      };
    }

    // Must have either center+radius or bounds
    if (!area.center && !area.bounds) {
      return null;
    }

    // Parse optional tags
    const description = event.content || undefined;
    const image = event.tags.find(t => t[0] === 'image')?.[1];
    const estimatedTime = event.tags.find(t => t[0] === 'estimated_time')?.[1];
    const difficulty = event.tags.find(t => t[0] === 'difficulty')?.[1];
    const relays = event.tags.filter(t => t[0] === 'r').map(t => t[1] || '');
    const client = event.tags.find(t => t[0] === 'client')?.[1];

    // Parse filters
    let filters: TreasureMap['filters'] | undefined;
    const diffMin = event.tags.find(t => t[0] === 'filter_diff_min')?.[1];
    const diffMax = event.tags.find(t => t[0] === 'filter_diff_max')?.[1];
    const terrainMin = event.tags.find(t => t[0] === 'filter_terrain_min')?.[1];
    const terrainMax = event.tags.find(t => t[0] === 'filter_terrain_max')?.[1];
    const types = event.tags.filter(t => t[0] === 'filter_type').map(t => t[1] || '');
    const sizes = event.tags.filter(t => t[0] === 'filter_size').map(t => t[1] || '');

    if (diffMin || diffMax || terrainMin || terrainMax || types.length > 0 || sizes.length > 0) {
      filters = {};

      if (diffMin || diffMax) {
        filters.difficulty = {};
        if (diffMin) filters.difficulty.min = parseInt(diffMin);
        if (diffMax) filters.difficulty.max = parseInt(diffMax);
      }

      if (terrainMin || terrainMax) {
        filters.terrain = {};
        if (terrainMin) filters.terrain.min = parseInt(terrainMin);
        if (terrainMax) filters.terrain.max = parseInt(terrainMax);
      }

      if (types.length > 0) {
        filters.types = types;
      }

      if (sizes.length > 0) {
        filters.sizes = sizes;
      }
    }

    // Validate coordinates if provided
    if (area.center) {
      if (!validateCoordinates(area.center.lat, area.center.lng)) {
        return null;
      }
    }

    if (area.bounds) {
      if (!validateCoordinates(area.bounds.northEast.lat, area.bounds.northEast.lng) ||
          !validateCoordinates(area.bounds.southWest.lat, area.bounds.southWest.lng)) {
        return null;
      }
    }

    // Generate naddr
    const naddr = nip19.naddrEncode({
      identifier: dTag,
      pubkey: event.pubkey,
      kind: event.kind,
      relays,
    });

    return {
      id: event.id,
      naddr,
      pubkey: event.pubkey,
      created_at: event.created_at,
      kind: event.kind,
      dTag,
      name,
      description,
      area,
      theme: 'adventure',
      filters,
      image,
      estimatedTime,
      difficulty,
      category: category as ValidTreasureMapCategory,
      relays,
      client,
    };
  } catch (error) {
    console.error('Error parsing treasure map event:', error);
    return null;
  }
}



// ===== TAG BUILDING =====

export function buildTreasureMapTags(data: CreateTreasureMapData & {
  dTag: string;
}): string[][] {
  // Validate inputs
  if (!validateTreasureMapCategory(data.category)) {
    throw new Error(`Invalid treasure map category: ${data.category}`);
  }

  if (data.difficulty && !validateDifficultyLevel(data.difficulty)) {
    throw new Error(`Invalid difficulty level: ${data.difficulty}`);
  }

  // Must have either center+radius or bounds
  if (!data.area.center && !data.area.bounds) {
    throw new Error('Either center+radius or bounds must be provided');
  }

  // Validate coordinates if provided
  if (data.area.center) {
    if (!validateCoordinates(data.area.center.lat, data.area.center.lng)) {
      throw new Error(`Invalid center coordinates: ${data.area.center.lat}, ${data.area.center.lng}`);
    }
  }

  if (data.area.bounds) {
    if (!validateCoordinates(data.area.bounds.northEast.lat, data.area.bounds.northEast.lng) ||
        !validateCoordinates(data.area.bounds.southWest.lat, data.area.bounds.southWest.lng)) {
      throw new Error('Invalid bounds coordinates');
    }
  }

  const tags: string[][] = [
    ['d', data.dTag],
    ['name', data.name],
    ['category', data.category],
  ];

  // Add area information
  if (data.area.center) {
    tags.push(['center_lat', data.area.center.lat.toString()]);
    tags.push(['center_lng', data.area.center.lng.toString()]);

    if (data.area.radius) {
      tags.push(['radius', data.area.radius.toString()]);
    }
  }

  if (data.area.bounds) {
    tags.push(['bounds_ne_lat', data.area.bounds.northEast.lat.toString()]);
    tags.push(['bounds_ne_lng', data.area.bounds.northEast.lng.toString()]);
    tags.push(['bounds_sw_lat', data.area.bounds.southWest.lat.toString()]);
    tags.push(['bounds_sw_lng', data.area.bounds.southWest.lng.toString()]);
  }

  // Add filters
  if (data.filters) {
    if (data.filters.difficulty) {
      if (data.filters.difficulty.min !== undefined) {
        tags.push(['filter_diff_min', data.filters.difficulty.min.toString()]);
      }
      if (data.filters.difficulty.max !== undefined) {
        tags.push(['filter_diff_max', data.filters.difficulty.max.toString()]);
      }
    }

    if (data.filters.terrain) {
      if (data.filters.terrain.min !== undefined) {
        tags.push(['filter_terrain_min', data.filters.terrain.min.toString()]);
      }
      if (data.filters.terrain.max !== undefined) {
        tags.push(['filter_terrain_max', data.filters.terrain.max.toString()]);
      }
    }

    if (data.filters.types && data.filters.types.length > 0) {
      data.filters.types.forEach(type => {
        tags.push(['filter_type', type]);
      });
    }

    if (data.filters.sizes && data.filters.sizes.length > 0) {
      data.filters.sizes.forEach(size => {
        tags.push(['filter_size', size]);
      });
    }
  }

  // Add optional tags
  if (data.image?.trim()) {
    tags.push(['image', data.image.trim()]);
  }

  if (data.estimatedTime?.trim()) {
    tags.push(['estimated_time', data.estimatedTime.trim()]);
  }

  if (data.difficulty?.trim()) {
    tags.push(['difficulty', data.difficulty.trim()]);
  }

  return tags;
}



// ===== UTILITIES =====

export function createTreasureMapNaddr(pubkey: string, dTag: string, relays: string[] = []): string {
  return nip19.naddrEncode({
    identifier: dTag,
    pubkey,
    kind: TREASURE_MAP_KIND,
    relays,
  });
}

export function parseTreasureMapNaddr(naddr: string): {
  pubkey: string;
  dTag: string;
  kind: number;
  relays: string[];
} | null {
  try {
    const decoded = nip19.decode(naddr);
    if (decoded.type !== 'naddr') {
      return null;
    }

    const { pubkey, identifier: dTag, kind, relays } = decoded.data;

    if (kind !== TREASURE_MAP_KIND) {
      return null;
    }

    return { pubkey, dTag, kind, relays };
  } catch (error) {
    console.error('Error parsing treasure map naddr:', error);
    return null;
  }
}

export function isTreasureMapEvent(event: NostrEvent): boolean {
  return event.kind === TREASURE_MAP_KIND;
}

