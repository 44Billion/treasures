/**
 * NIP-GC (Geocaching Events) utilities
 * Consolidated parsing, validation, and utility functions for NIP-GC compliance
 */

import { nip19 } from 'nostr-tools';
import type { NostrEvent } from '@nostrify/nostrify';
import type { Geocache, GeocacheLog } from '@/features/geocache/types';
import { getGeohashPrecisionLevels } from '@/features/map/utils/coordinates';

// ===== CONSTANTS =====

export const NIP_GC_KINDS = {
  GEOCACHE: 37516,
  GEOCACHE_LEGACY: 37515,
  FOUND_LOG: 7516,
  COMMENT_LOG: 1111,
  VERIFICATION: 7517,
  BOOKMARK_LIST: 30001,
} as const;

export const VALID_CACHE_TYPES = ['traditional', 'multi', 'mystery'] as const;
export const VALID_CACHE_SIZES = ['micro', 'small', 'regular', 'large', 'other'] as const;
export const VALID_COMMENT_LOG_TYPES = ['dnf', 'note', 'maintenance', 'archived'] as const;

export type ValidCacheType = typeof VALID_CACHE_TYPES[number];
export type ValidCacheSize = typeof VALID_CACHE_SIZES[number];
export type ValidCommentLogType = typeof VALID_COMMENT_LOG_TYPES[number];

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
    const c = geohash[i] || '';
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

export function validateCommentLogType(type: string): type is ValidCommentLogType {
  return VALID_COMMENT_LOG_TYPES.includes(type as ValidCommentLogType);
}

export function validateCoordinates(lat: number, lng: number): boolean {
  return !isNaN(lat) && !isNaN(lng) &&
         lat >= -90 && lat <= 90 &&
         lng >= -180 && lng <= 180;
}

// ===== PARSING =====

export function parseGeocacheEvent(event: NostrEvent): Geocache | null {
  try {
    // Process both new (37516) and legacy (37515) geocache events
    if (event.kind !== NIP_GC_KINDS.GEOCACHE && event.kind !== NIP_GC_KINDS.GEOCACHE_LEGACY) {
      return null;
    }

    const dTag = event.tags.find(t => t[0] === 'd')?.[1];
    if (!dTag) {
      return null;
    }

    // Parse required tags according to NIP-GC
    const name = event.tags.find(t => t[0] === 'name')?.[1];
    // Get the most precise geohash (longest one) for location parsing
    const geohashes = event.tags.filter(t => t[0] === 'g').map(t => t[1]).filter(Boolean);
    const geohash = geohashes.length > 0 ? geohashes.reduce((longest, current) => 
      (current && current.length > (longest?.length || 0)) ? current : longest
    ) : undefined;
    
    // Handle both new (37516) and legacy (37515) tag formats
    let difficulty: string | undefined;
    let terrain: string | undefined;
    let size: string | undefined;
    
    if (event.kind === NIP_GC_KINDS.GEOCACHE) {
      // New format uses T, D, S tags
      difficulty = event.tags.find(t => t[0] === 'D')?.[1];
      terrain = event.tags.find(t => t[0] === 'T')?.[1];
      size = event.tags.find(t => t[0] === 'S')?.[1];
    } else {
      // Legacy format uses difficulty, terrain, size tags
      difficulty = event.tags.find(t => t[0] === 'difficulty')?.[1];
      terrain = event.tags.find(t => t[0] === 'terrain')?.[1];
      size = event.tags.find(t => t[0] === 'size')?.[1];
    }
    
    // Type tag is 't' according to NIP-GC, defaults to 'traditional' if not specified
    // Look for cache type in 't' tags, excluding 'hidden'
    const cacheType = event.tags.find(t => t[0] === 't' && t[1] !== 'hidden')?.[1] || 'traditional';

    // Validate required fields
    if (!name || !geohash || !difficulty || !terrain || !size) {
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
    const images = event.tags.filter(t => t[0] === 'image').map(t => t[1] || '');
    const relays = event.tags.filter(t => t[0] === 'r').map(t => t[1] || '');
    const client = event.tags.find(t => t[0] === 'client')?.[1];
    const verificationPubkey = event.tags.find(t => t[0] === 'verification')?.[1];
    
    // Check if cache is hidden (has 't' tag with 'hidden' value)
    const hidden = event.tags.some(t => t[0] === 't' && t[1] === 'hidden');

    const naddr = nip19.naddrEncode({
      identifier: dTag,
      pubkey: event.pubkey,
      kind: event.kind, // Use the actual event kind!
      relays: relays,
    });

    return {
      id: event.id,
      naddr,
      pubkey: event.pubkey,
      created_at: event.created_at,
      dTag,
      kind: event.kind, // Store original kind for updates
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
      hidden,
    };
  } catch (error) {
    return null;
  }
}

export function parseLogEvent(event: NostrEvent): GeocacheLog | null {
  try {
    // Handle Found Log Events (Kind 7516)
    if (event.kind === NIP_GC_KINDS.FOUND_LOG) {
      return parseFoundLogEvent(event);
    }
    
    // Handle Comment Log Events (Kind 1111)
    if (event.kind === NIP_GC_KINDS.COMMENT_LOG) {
      return parseCommentLogEvent(event);
    }

    return null;
  } catch (error) {
    console.error('DEBUG: Error in parseLogEvent:', error);
    return null;
  }
}

/**
 * Parse found log events (kind 7516)
 * 
 * IMPORTANT: This function does NOT validate embedded verification events.
 * It only parses the structure. Actual verification validation happens in
 * useGeocacheLogs hook using the geocache's verification pubkey.
 * 
 * This prevents false positives where malicious logs could embed fake
 * verification events and appear verified without proper signature validation.
 */
function parseFoundLogEvent(event: NostrEvent): GeocacheLog | null {
  // Parse required tags for found logs
  const aTag = event.tags.find(t => t[0] === 'a')?.[1];
  if (!aTag) {
    return null;
  }

  // Extract geocache reference from a-tag
  const [kind, pubkey, dTag] = aTag.split(':');
  if (kind !== NIP_GC_KINDS.GEOCACHE.toString() && kind !== NIP_GC_KINDS.GEOCACHE_LEGACY.toString()) {
    return null;
  }

  const geocacheId = `${pubkey}:${dTag}`;

  // Parse optional tags
  const images = event.tags.filter(t => t[0] === 'image').map(t => t[1] || '');
  const verificationTag = event.tags.find(t => t[0] === 'verification')?.[1];
  
  // Check if this log has embedded verification data (but don't mark as verified yet)
  // The actual verification will be done in useGeocacheLogs with the geocache's verification pubkey
  if (verificationTag) {
    try {
      // Parse embedded verification event
      const verificationEvent = JSON.parse(verificationTag);
      if (verificationEvent.kind === NIP_GC_KINDS.VERIFICATION) {
        // hasEmbeddedVerification = true; // This variable is not used
      }
    } catch {
      // Invalid verification data
    }
  }

  return {
    id: event.id,
    pubkey: event.pubkey,
    created_at: event.created_at,
    geocacheId,
    type: 'found',
    text: event.content,
    images,
    // Don't set isVerified here - it will be set properly in useGeocacheLogs after signature verification
    isVerified: false,
  };
}

function parseCommentLogEvent(event: NostrEvent): GeocacheLog | null {
  // Parse required tags for comment logs (NIP-22 structure)
  const aTag = event.tags.find(t => t[0] === 'a')?.[1]; // Parent reference
  const ATag = event.tags.find(t => t[0] === 'A')?.[1]; // Root reference
  const kTag = event.tags.find(t => t[0] === 'k')?.[1]; // Parent kind
  const KTag = event.tags.find(t => t[0] === 'K')?.[1]; // Root kind
  
  if (!aTag || !ATag || !kTag || !KTag) {
    return null;
  }

  // Verify this is a geocache comment
  if ((kTag !== NIP_GC_KINDS.GEOCACHE.toString() && kTag !== NIP_GC_KINDS.GEOCACHE_LEGACY.toString()) ||
      (KTag !== NIP_GC_KINDS.GEOCACHE.toString() && KTag !== NIP_GC_KINDS.GEOCACHE_LEGACY.toString())) {
    return null;
  }

  // Extract geocache reference from a-tag (should be same as A-tag for top-level comments)
  const [kind, pubkey, dTag] = aTag.split(':');
  
  if ((kind !== NIP_GC_KINDS.GEOCACHE.toString() && kind !== NIP_GC_KINDS.GEOCACHE_LEGACY.toString()) || !pubkey || !dTag) {
    return null;
  }

  const geocacheId = `${pubkey}:${dTag}`;

  // Parse log type from 't' tag, default to 'note' if not specified
  const logType = event.tags.find(t => t[0] === 't')?.[1] || 'note';
  
  // Validate comment log type
  if (!validateCommentLogType(logType) && logType !== 'note') {
    return null;
  }

  // Parse optional tags
  const images = event.tags.filter(t => t[0] === 'image').map(t => t[1] || '');

  return {
    id: event.id,
    pubkey: event.pubkey,
    created_at: event.created_at,
    geocacheId,
    type: logType as 'dnf' | 'note' | 'maintenance' | 'archived',
    text: event.content,
    images,
  };
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
  hidden?: boolean;
  kind?: number; // Original kind to preserve for updates
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

  // Determine which tag format to use based on original kind
  const isLegacy = data.kind === NIP_GC_KINDS.GEOCACHE_LEGACY;
  
  const tags: string[][] = [
    ['d', data.dTag],
    ['name', data.name],
  ];

  // Use appropriate tags based on original kind
  if (isLegacy) {
    tags.push(['difficulty', data.difficulty.toString()]);
    tags.push(['terrain', data.terrain.toString()]);
    tags.push(['size', data.size]);
  } else {
    tags.push(['D', data.difficulty.toString()]);
    tags.push(['T', data.terrain.toString()]);
    tags.push(['S', data.size]);
  }

  // Add multiple geohash tags at precision levels appropriate for the coordinate specificity
  // This enables efficient filtering while avoiding overly precise geohashes for imprecise coordinates
  const { lat, lng } = data.location;
  
  // Determine appropriate precision levels based on coordinate specificity
  const precisionLevels = getGeohashPrecisionLevels(lat, lng);
  
  // Generate geohashes at the determined precision levels
  for (const precision of precisionLevels) {
    const geohash = encodeGeohash(lat, lng, precision);
    tags.push(['g', geohash]);
  }

  // Add type tag only if not 'traditional' (defaults to traditional per NIP-GC)
  if (data.type !== 'traditional') {
    tags.push(['t', data.type]);
  }

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
    console.log('🔑 Adding verification tag:', data.verificationPubkey);
    tags.push(['verification', data.verificationPubkey]);
  } else {
    console.log('🔑 No verification pubkey provided');
  }

  // Add hidden tag if the cache is hidden
  if (data.hidden) {
    tags.push(['t', 'hidden']);
  }

  return tags;
}

export function buildFoundLogTags(data: {
  geocachePubkey: string;
  geocacheDTag: string;
  images?: string[];
  verificationEvent?: string; // JSON string of embedded verification event
  geocacheKind?: number; // Optional geocache kind
}): string[][] {
  // Build required tags for found logs according to NIP-GC
  const kind = data.geocacheKind || NIP_GC_KINDS.GEOCACHE;
  const tags: string[][] = [
    ['a', `${kind}:${data.geocachePubkey}:${data.geocacheDTag}`],
  ];

  // Add optional image tags
  if (data.images && data.images.length > 0) {
    data.images.forEach(image => {
      tags.push(['image', image]);
    });
  }

  // Add embedded verification event if provided
  if (data.verificationEvent) {
    tags.push(['verification', data.verificationEvent]);
  }

  return tags;
}

export function buildCommentLogTags(data: {
  geocachePubkey: string;
  geocacheDTag: string;
  logType: ValidCommentLogType | 'note';
  images?: string[];
  geocacheKind?: number; // Optional geocache kind
}): string[][] {
  // Validate comment log type
  if (data.logType !== 'note' && !validateCommentLogType(data.logType)) {
    throw new Error(`Invalid comment log type: ${data.logType}`);
  }

  const kind = data.geocacheKind || NIP_GC_KINDS.GEOCACHE;
  const geocacheCoordinate = `${kind}:${data.geocachePubkey}:${data.geocacheDTag}`;

  // Build required tags for comment logs according to NIP-GC (NIP-22 structure)
  const tags: string[][] = [
    ['A', geocacheCoordinate], // Root geocache reference
    ['K', kind.toString()], // Root kind number
    ['P', data.geocachePubkey], // Root author (cache owner pubkey)
    ['a', geocacheCoordinate], // Parent reference (same as root for top-level comments)
    ['k', kind.toString()], // Parent kind number
    ['p', data.geocachePubkey], // Parent author (cache owner pubkey)
  ];

  // Add log type tag only if not 'note' (defaults to note per NIP-GC)
  if (data.logType !== 'note') {
    tags.push(['t', data.logType]);
  }

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
  // Enhanced precision mapping to handle 8-9 character geohashes
  if (distanceKm >= 100) return 2;
  if (distanceKm >= 50) return 3;
  if (distanceKm >= 25) return 3;
  if (distanceKm >= 10) return 4;
  if (distanceKm >= 5) return 4;
  if (distanceKm >= 2) return 5;
  if (distanceKm >= 1) return 6;
  if (distanceKm >= 0.5) return 7;
  if (distanceKm >= 0.1) return 8;
  return 9; // Use 9 for very small distances to match geocache precision
}

// ===== UTILITIES =====

export function createGeocacheCoordinate(pubkey: string, dTag: string, kind: number = NIP_GC_KINDS.GEOCACHE): string {
  return `${kind}:${pubkey}:${dTag}`;
}

export function parseGeocacheCoordinate(coordinate: string): { pubkey: string; dTag: string; kind: number } | null {
  const [kind, pubkey, dTag] = coordinate.split(':');
  if (!kind || !pubkey || !dTag) {
    return null;
  }
  const kindNum = parseInt(kind);
  if (kindNum !== NIP_GC_KINDS.GEOCACHE && kindNum !== NIP_GC_KINDS.GEOCACHE_LEGACY) {
    return null;
  }
  return { pubkey, dTag, kind: kindNum };
}

export function isGeocacheEvent(event: NostrEvent): boolean {
  return event.kind === NIP_GC_KINDS.GEOCACHE || event.kind === NIP_GC_KINDS.GEOCACHE_LEGACY;
}

export function isFoundLogEvent(event: NostrEvent): boolean {
  return event.kind === NIP_GC_KINDS.FOUND_LOG;
}

export function isCommentLogEvent(event: NostrEvent): boolean {
  return event.kind === NIP_GC_KINDS.COMMENT_LOG;
}

export function isVerificationEvent(event: NostrEvent): boolean {
  return event.kind === NIP_GC_KINDS.VERIFICATION;
}

export function isLogEvent(event: NostrEvent): boolean {
  return isFoundLogEvent(event) || isCommentLogEvent(event);
}

// ===== VERIFICATION EVENT UTILITIES =====

export function buildVerificationEventTags(data: {
  finderPubkey: string;
  geocacheNaddr: string;
}): string[][] {
  return [
    ['a', `${data.finderPubkey}:${data.geocacheNaddr}`],
  ];
}

export function buildVerificationEventContent(finderNpub: string): string {
  return `Geocache verification for ${finderNpub}`;
}

export function parseVerificationEvent(event: NostrEvent): {
  finderPubkey: string;
  geocacheNaddr: string;
} | null {
  if (event.kind !== NIP_GC_KINDS.VERIFICATION) {
    return null;
  }

  const aTag = event.tags.find(t => t[0] === 'a')?.[1];
  if (!aTag) {
    return null;
  }

  const [finderPubkey, geocacheNaddr] = aTag.split(':', 2);
  if (!finderPubkey || !geocacheNaddr) {
    return null;
  }

  return { finderPubkey, geocacheNaddr };
}