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
      return null;
    }

    // Validate cache type and size
    if (!validateCacheType(cacheType)) {
      return null;
    }

    if (!validateCacheSize(size)) {
      return null;
    }

    // Parse location from geohash
    let location: { lat: number; lng: number };
    try {
      location = decodeGeohash(geohash);
    } catch (error) {
      return null;
    }

    // Validate coordinates
    if (!validateCoordinates(location.lat, location.lng)) {
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
      return null;
    }

    // Validate log type
    if (!validateLogType(logType)) {
      return null;
    }

    // Extract geocache reference from a-tag
    const [, pubkey, dTag] = aTag.split(':');
    if (!pubkey || !dTag) {
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

// ===== GEOHASH PROXIMITY UTILITIES =====

/**
 * Calculate geohash precision needed for a given distance
 * @param distanceKm Desired precision radius in kilometers
 * @returns Optimal geohash precision level
 */
export function getOptimalPrecision(distanceKm: number): number {
  // More aggressive precision mapping for better coverage
  if (distanceKm >= 100) return 2;
  if (distanceKm >= 50) return 3;
  if (distanceKm >= 25) return 3;
  if (distanceKm >= 10) return 4;
  if (distanceKm >= 5) return 4;
  if (distanceKm >= 2) return 5;
  if (distanceKm >= 1) return 5;
  if (distanceKm >= 0.5) return 6;
  return 6; // Stay at 6 for smaller distances
}

/**
 * Get all geohash neighbors for a given geohash
 * @param geohash Base geohash
 * @returns Array of neighboring geohashes (including the center)
 */
export function getGeohashNeighbors(geohash: string): string[] {
  const neighbors: string[] = [geohash]; // Include center
  
  try {
    // Get direct neighbors (8 directions)
    const north = getNeighbor(geohash, 'north');
    const south = getNeighbor(geohash, 'south');
    const east = getNeighbor(geohash, 'east');
    const west = getNeighbor(geohash, 'west');
    
    neighbors.push(north, south, east, west);
    
    // Get diagonal neighbors
    neighbors.push(
      getNeighbor(north, 'east'),  // northeast
      getNeighbor(north, 'west'),  // northwest
      getNeighbor(south, 'east'),  // southeast
      getNeighbor(south, 'west')   // southwest
    );
    
    return [...new Set(neighbors)]; // Remove duplicates
  } catch (error) {
    return [geohash];
  }
}

/**
 * Get geohashes within a radius from a center point
 * @param centerLat Center latitude
 * @param centerLng Center longitude
 * @param radiusKm Radius in kilometers
 * @param maxPrecision Maximum geohash precision to use
 * @returns Array of geohashes covering the area
 */
export function getGeohashesInRadius(
  centerLat: number, 
  centerLng: number, 
  radiusKm: number,
  maxPrecision: number = 5
): string[] {
  const precision = Math.min(getOptimalPrecision(radiusKm), maxPrecision);
  const centerGeohash = encodeGeohash(centerLat, centerLng, precision);
  
  // Start with immediate neighbors
  let candidates = getGeohashNeighbors(centerGeohash);
  
  // Always expand for better coverage, especially for larger radiuses
  const expandedCandidates = new Set(candidates);
  
  // Add neighbors of neighbors
  candidates.forEach(hash => {
    const neighbors = getGeohashNeighbors(hash);
    neighbors.forEach(n => expandedCandidates.add(n));
  });
  
  // For larger radiuses, expand one more level
  if (radiusKm > 5) {
    const level2Candidates = Array.from(expandedCandidates);
    level2Candidates.forEach(hash => {
      const neighbors = getGeohashNeighbors(hash);
      neighbors.forEach(n => expandedCandidates.add(n));
    });
  }
  
  candidates = Array.from(expandedCandidates);
  
  // Use more lenient distance filtering - add 50% buffer
  const searchBuffer = radiusKm * 1.5;
  return candidates.filter(hash => {
    try {
      const { lat, lng } = decodeGeohash(hash);
      const distance = calculateHaversineDistance(centerLat, centerLng, lat, lng);
      return distance <= searchBuffer;
    } catch {
      return false;
    }
  });
}

/**
 * Create geohash prefixes for broader proximity search
 * @param centerLat Center latitude
 * @param centerLng Center longitude
 * @param radiusKm Radius in kilometers
 * @returns Array of geohash prefixes to search
 */
export function getGeohashPrefixes(centerLat: number, centerLng: number, radiusKm: number): string[] {
  const basePrecision = getOptimalPrecision(radiusKm);
  const centerGeohash = encodeGeohash(centerLat, centerLng, basePrecision);
  
  const prefixes = new Set<string>();
  
  // Add prefixes at multiple precision levels for comprehensive coverage
  for (let p = Math.max(1, basePrecision - 2); p <= Math.min(basePrecision + 1, 6); p++) {
    const hash = centerGeohash.substring(0, p);
    prefixes.add(hash);
    
    // Add neighbors at this precision level for wider coverage
    try {
      const neighbors = getGeohashNeighbors(hash);
      neighbors.forEach(n => prefixes.add(n));
    } catch {
      // Continue if neighbor calculation fails
    }
  }
  
  return Array.from(prefixes).filter(p => p.length > 0).sort();
}

// Helper function to get a neighbor in a specific direction
function getNeighbor(geohash: string, direction: 'north' | 'south' | 'east' | 'west'): string {
  const { lat, lng } = decodeGeohash(geohash);
  const precision = geohash.length;
  
  // Calculate approximate offset based on geohash precision
  const latOffset = getLatitudeOffset(precision);
  const lngOffset = getLongitudeOffset(precision, lat);
  
  let newLat = lat;
  let newLng = lng;
  
  switch (direction) {
    case 'north':
      newLat += latOffset;
      break;
    case 'south':
      newLat -= latOffset;
      break;
    case 'east':
      newLng += lngOffset;
      break;
    case 'west':
      newLng -= lngOffset;
      break;
  }
  
  // Handle edge cases
  if (newLat > 90) newLat = 90;
  if (newLat < -90) newLat = -90;
  if (newLng > 180) newLng -= 360;
  if (newLng < -180) newLng += 360;
  
  return encodeGeohash(newLat, newLng, precision);
}

function getLatitudeOffset(precision: number): number {
  // Approximate latitude degrees per geohash cell at different precisions
  const offsets = [20, 2.5, 0.6, 0.08, 0.02, 0.002, 0.0005, 0.0001, 0.00002];
  return offsets[precision - 1] || 0.00002;
}

function getLongitudeOffset(precision: number, latitude: number): number {
  // Longitude offset varies by latitude due to earth's curvature
  const baseOffset = getLatitudeOffset(precision);
  return baseOffset / Math.cos(latitude * Math.PI / 180);
}

function calculateHaversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
  
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
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