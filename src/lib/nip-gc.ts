/**
 * NIP-GC (Geocaching Events) utilities
 * Consolidated parsing, validation, and utility functions for NIP-GC compliance
 */

import type { NostrEvent } from '@nostrify/nostrify';
import type { Geocache, GeocacheLog } from '@/types/geocache';

// ===== CONSTANTS =====

export const NIP_GC_KINDS = {
  GEOCACHE: 37515,
  LOG: 7516,
} as const;

export const VALID_CACHE_TYPES = ['traditional', 'multi', 'mystery'] as const;
export const VALID_CACHE_SIZES = ['micro', 'small', 'regular', 'large', 'other'] as const;
export const VALID_LOG_TYPES = ['found', 'dnf', 'note', 'maintenance', 'archived'] as const;

export type ValidCacheType = typeof VALID_CACHE_TYPES[number];
export type ValidCacheSize = typeof VALID_CACHE_SIZES[number];
export type ValidLogType = typeof VALID_LOG_TYPES[number];

// ===== GEOHASH UTILITIES =====

const GEOHASH_BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';

export function encodeGeohash(lat: number, lng: number, precision: number = 6): string {
  let idx = 0;
  let bit = 0;
  let evenBit = true;
  let geohash = '';

  let latMin = -90, latMax = 90;
  let lngMin = -180, lngMax = 180;

  while (geohash.length < precision) {
    if (evenBit) {
      // longitude
      const mid = (lngMin + lngMax) / 2;
      if (lng > mid) {
        idx |= (1 << (4 - bit));
        lngMin = mid;
      } else {
        lngMax = mid;
      }
    } else {
      // latitude
      const mid = (latMin + latMax) / 2;
      if (lat > mid) {
        idx |= (1 << (4 - bit));
        latMin = mid;
      } else {
        latMax = mid;
      }
    }

    evenBit = !evenBit;

    if (bit < 4) {
      bit++;
    } else {
      geohash += GEOHASH_BASE32[idx];
      bit = 0;
      idx = 0;
    }
  }

  return geohash;
}

export function decodeGeohash(geohash: string): { lat: number; lng: number } {
  let evenBit = true;
  let latMin = -90, latMax = 90;
  let lngMin = -180, lngMax = 180;

  for (let i = 0; i < geohash.length; i++) {
    const c = geohash[i];
    const idx = GEOHASH_BASE32.indexOf(c);
    if (idx === -1) throw new Error('Invalid geohash character');

    for (let mask = 16; mask > 0; mask >>= 1) {
      if (evenBit) {
        // longitude
        const mid = (lngMin + lngMax) / 2;
        if (idx & mask) {
          lngMin = mid;
        } else {
          lngMax = mid;
        }
      } else {
        // latitude
        const mid = (latMin + latMax) / 2;
        if (idx & mask) {
          latMin = mid;
        } else {
          latMax = mid;
        }
      }
      evenBit = !evenBit;
    }
  }

  return {
    lat: (latMin + latMax) / 2,
    lng: (lngMin + lngMax) / 2
  };
}

// ===== VALIDATION =====

export function validateCacheType(type: string): type is ValidCacheType {
  return VALID_CACHE_TYPES.includes(type as ValidCacheType);
}

export function validateCacheSize(size: string): size is ValidCacheSize {
  return VALID_CACHE_SIZES.includes(size as ValidCacheSize);
}

export function validateLogType(type: string): type is ValidLogType {
  return VALID_LOG_TYPES.includes(type as ValidLogType);
}

export function validateCoordinates(lat: number, lng: number): boolean {
  return !isNaN(lat) && !isNaN(lng) &&
         lat >= -90 && lat <= 90 &&
         lng >= -180 && lng <= 180;
}

// ===== PARSING =====

export function parseGeocacheEvent(event: NostrEvent): Geocache | null {
  try {
    // Only process geocache events
    if (event.kind !== NIP_GC_KINDS.GEOCACHE) {
      return null;
    }

    const dTag = event.tags.find(t => t[0] === 'd')?.[1];
    if (!dTag) {
      return null;
    }

    // Parse required tags according to NIP-GC
    const name = event.tags.find(t => t[0] === 'name')?.[1];
    const geohash = event.tags.find(t => t[0] === 'g')?.[1];
    const difficulty = event.tags.find(t => t[0] === 'difficulty')?.[1];
    const terrain = event.tags.find(t => t[0] === 'terrain')?.[1];
    const size = event.tags.find(t => t[0] === 'size')?.[1];
    const cacheType = event.tags.find(t => t[0] === 'cache-type')?.[1];

    // Validate required fields
    if (!name || !geohash || !difficulty || !terrain || !size || !cacheType) {
      console.warn('Geocache event missing required tags:', { 
        name: !!name, geohash: !!geohash, difficulty: !!difficulty, 
        terrain: !!terrain, size: !!size, cacheType: !!cacheType 
      });
      return null;
    }

    // Validate cache type and size
    if (!validateCacheType(cacheType)) {
      console.warn(`Invalid cache type: ${cacheType}`);
      return null;
    }

    if (!validateCacheSize(size)) {
      console.warn(`Invalid cache size: ${size}`);
      return null;
    }

    // Parse location from geohash
    let location: { lat: number; lng: number };
    try {
      location = decodeGeohash(geohash);
    } catch (error) {
      console.warn(`Invalid geohash: ${geohash}`, error);
      return null;
    }

    // Validate coordinates
    if (!validateCoordinates(location.lat, location.lng)) {
      console.warn(`Invalid coordinates for cache "${name}":`, location);
      return null;
    }

    // Parse optional tags
    const hint = event.tags.find(t => t[0] === 'hint')?.[1];
    const images = event.tags.filter(t => t[0] === 'image').map(t => t[1]);
    const relays = event.tags.filter(t => t[0] === 'r').map(t => t[1]);
    const client = event.tags.find(t => t[0] === 'client')?.[1];
    const verificationPubkey = event.tags.find(t => t[0] === 'verification')?.[1];

    return {
      id: event.id,
      pubkey: event.pubkey,
      created_at: event.created_at,
      dTag,
      name,
      description: event.content, // Description is in content field per NIP-GC
      hint,
      location,
      difficulty: parseInt(difficulty) || 1,
      terrain: parseInt(terrain) || 1,
      size,
      type: cacheType,
      images,
      relays,
      client,
      verificationPubkey,
    };
  } catch (error) {
    console.error('Failed to parse geocache event:', error, event);
    return null;
  }
}

export function parseLogEvent(event: NostrEvent): GeocacheLog | null {
  try {
    // Only process log events
    if (event.kind !== NIP_GC_KINDS.LOG) {
      return null;
    }

    // Parse required tags
    const aTag = event.tags.find(t => t[0] === 'a')?.[1];
    const logType = event.tags.find(t => t[0] === 'log-type')?.[1];

    if (!aTag || !logType) {
      console.warn('Log event missing required tags:', { aTag: !!aTag, logType: !!logType });
      return null;
    }

    // Validate log type
    if (!validateLogType(logType)) {
      console.warn(`Invalid log type: ${logType}`);
      return null;
    }

    // Extract geocache reference from a-tag
    const [, pubkey, dTag] = aTag.split(':');
    if (!pubkey || !dTag) {
      console.warn('Invalid a-tag format:', aTag);
      return null;
    }

    const geocacheId = `${pubkey}:${dTag}`;

    // Parse optional tags
    const images = event.tags.filter(t => t[0] === 'image').map(t => t[1]);
    const client = event.tags.find(t => t[0] === 'client')?.[1];

    return {
      id: event.id,
      pubkey: event.pubkey,
      created_at: event.created_at,
      geocacheId,
      type: logType,
      text: event.content, // Log text is in content field per NIP-GC
      images,
      client,
    };
  } catch (error) {
    console.error('Failed to parse log event:', error, event);
    return null;
  }
}

// ===== TAG BUILDING =====

export function buildGeocacheTags(data: {
  dTag: string;
  name: string;
  location: { lat: number; lng: number };
  difficulty: number;
  terrain: number;
  size: ValidCacheSize;
  type: ValidCacheType;
  hint?: string;
  images?: string[];
  relays?: string[];
  verificationPubkey?: string;
}): string[][] {
  // Validate inputs
  if (!validateCacheType(data.type)) {
    throw new Error(`Invalid cache type: ${data.type}`);
  }
  if (!validateCacheSize(data.size)) {
    throw new Error(`Invalid cache size: ${data.size}`);
  }
  if (!validateCoordinates(data.location.lat, data.location.lng)) {
    throw new Error(`Invalid coordinates: ${data.location.lat}, ${data.location.lng}`);
  }

  const geohash = encodeGeohash(data.location.lat, data.location.lng);

  // Build required tags according to NIP-GC
  const tags: string[][] = [
    ['d', data.dTag],
    ['name', data.name],
    ['g', geohash],
    ['difficulty', data.difficulty.toString()],
    ['terrain', data.terrain.toString()],
    ['size', data.size],
    ['cache-type', data.type],
  ];

  // Add optional tags
  if (data.hint?.trim()) {
    tags.push(['hint', data.hint.trim()]);
  }

  if (data.images && data.images.length > 0) {
    data.images.forEach(image => {
      tags.push(['image', image]);
    });
  }

  if (data.relays && data.relays.length > 0) {
    data.relays.forEach(relay => {
      tags.push(['r', relay]);
    });
  }

  if (data.verificationPubkey) {
    tags.push(['verification', data.verificationPubkey]);
  }

  return tags;
}

export function buildLogTags(data: {
  geocachePubkey: string;
  geocacheDTag: string;
  logType: ValidLogType;
  images?: string[];
}): string[][] {
  // Validate log type
  if (!validateLogType(data.logType)) {
    throw new Error(`Invalid log type: ${data.logType}`);
  }

  // Build required tags according to NIP-GC
  const tags: string[][] = [
    ['a', `${NIP_GC_KINDS.GEOCACHE}:${data.geocachePubkey}:${data.geocacheDTag}`],
    ['log-type', data.logType],
  ];

  // Add optional image tags
  if (data.images && data.images.length > 0) {
    data.images.forEach(image => {
      tags.push(['image', image]);
    });
  }

  return tags;
}

// ===== UTILITIES =====

export function createGeocacheCoordinate(pubkey: string, dTag: string): string {
  return `${NIP_GC_KINDS.GEOCACHE}:${pubkey}:${dTag}`;
}

export function parseGeocacheCoordinate(coordinate: string): { pubkey: string; dTag: string } | null {
  const [kind, pubkey, dTag] = coordinate.split(':');
  if (kind !== NIP_GC_KINDS.GEOCACHE.toString() || !pubkey || !dTag) {
    return null;
  }
  return { pubkey, dTag };
}

export function isGeocacheEvent(event: NostrEvent): boolean {
  return event.kind === NIP_GC_KINDS.GEOCACHE;
}

export function isLogEvent(event: NostrEvent): boolean {
  return event.kind === NIP_GC_KINDS.LOG;
}