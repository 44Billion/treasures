/**
 * NIP-GC (Geocaching Events) utilities
 * Consolidated parsing, validation, and utility functions for NIP-GC compliance
 */

import { nip19 } from 'nostr-tools';
import type { NostrEvent } from '@nostrify/nostrify';
import type { Geocache, GeocacheLog } from '@/types/geocache';
import type { Adventure, AdventureTheme, AdventureMapStyle } from '@/types/adventure';
import { getGeohashPrecisionLevels } from '@/utils/coordinates';

// ===== CONSTANTS =====

export const NIP_GC_KINDS = {
  GEOCACHE: 37516,
  GEOCACHE_LEGACY: 37515,
  FOUND_LOG: 7516,
  COMMENT_LOG: 1111,
  VERIFICATION: 7517,
  BOOKMARK_LIST: 30001,
  ADVENTURE: 37517,
  DRAFT: 31234,
} as const;



const VALID_CACHE_TYPES = ['traditional', 'multi', 'mystery'] as const;
const VALID_CACHE_SIZES = ['micro', 'small', 'regular', 'large', 'other'] as const;
const VALID_COMMENT_LOG_TYPES = ['dnf', 'note', 'maintenance', 'archived'] as const;
// Reserved `t` tag values that are NOT cache types but rather lifecycle/visibility flags.
// Used to disambiguate when parsing the `t` tag for cache type.
const RESERVED_T_TAG_VALUES = ['hidden', 'archived', 'maintenance'] as const;
// Valid cache status values (owner-controlled lifecycle state of the listing itself,
// distinct from the per-log `archived` / `maintenance` comment log types).
export const VALID_CACHE_STATUSES = ['archived', 'maintenance'] as const;

/**
 * Valid `n` tag type modifiers (NIP-GC "Type Modifiers" section).
 *
 * Each modifier belongs to a category. A treasure SHOULD include at most one
 * modifier per category; if duplicates appear in the same category, the first
 * occurrence is used and the rest are ignored.
 *
 * Categories:
 *  - claim semantics: `first-to-find`
 *  - prize nature:    `art`
 */
export const VALID_N_MODIFIERS = ['first-to-find', 'art'] as const;
export type ValidNModifier = typeof VALID_N_MODIFIERS[number];

/** Maps each modifier to its category, for one-per-category enforcement. */
const N_MODIFIER_CATEGORY: Record<ValidNModifier, 'claim-semantics' | 'prize-nature'> = {
  'first-to-find': 'claim-semantics',
  'art': 'prize-nature',
};

export type ValidCacheType = typeof VALID_CACHE_TYPES[number];
export type ValidCacheSize = typeof VALID_CACHE_SIZES[number];
export type ValidCommentLogType = typeof VALID_COMMENT_LOG_TYPES[number];
export type ValidCacheStatus = typeof VALID_CACHE_STATUSES[number];

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

function decodeGeohash(geohash: string): { lat: number; lng: number } {
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

export function validateNModifier(modifier: string): modifier is ValidNModifier {
  return VALID_N_MODIFIERS.includes(modifier as ValidNModifier);
}

/**
 * Parse, validate, and de-duplicate `n` tag values from a Nostr event.
 *
 * Per NIP-GC:
 *  - Unknown values are ignored (forward compatibility).
 *  - At most one modifier per category is kept; the first occurrence wins.
 *  - Output order is the order of first occurrence in the event tags.
 */
export function parseNModifiers(tags: string[][]): ValidNModifier[] {
  const seenCategories = new Set<string>();
  const result: ValidNModifier[] = [];
  for (const tag of tags) {
    if (tag[0] !== 'n' || !tag[1]) continue;
    const value = tag[1];
    if (!validateNModifier(value)) continue;
    const category = N_MODIFIER_CATEGORY[value];
    if (seenCategories.has(category)) continue;
    seenCategories.add(category);
    result.push(value);
  }
  return result;
}

/**
 * Parse the first-to-find lock-in `F` tag.
 *
 * Format: `["F", "<winner-pubkey-hex>"]`. The pubkey must be a 64-char
 * lowercase hex string; malformed `F` tags are ignored. At most one `F` tag
 * is recognised — if multiple are present, the first valid one wins.
 *
 * Returns `undefined` if no valid `F` tag is present. Callers SHOULD only
 * consult the result when the treasure carries the `first-to-find` modifier.
 */
export function parseFtfWinner(tags: string[][]): string | undefined {
  const HEX64 = /^[0-9a-f]{64}$/;
  for (const tag of tags) {
    if (tag[0] !== 'F') continue;
    const pubkey = tag[1];
    if (!pubkey || !HEX64.test(pubkey)) continue;
    return pubkey;
  }
  return undefined;
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

    // Type tag is 't' according to NIP-GC, defaults to 'traditional' if not specified.
    // Exclude reserved values (hidden, archived, maintenance) that repurpose the `t` tag
    // as lifecycle/visibility flags rather than cache type.
    const cacheType = event.tags.find(
      t => t[0] === 't' && t[1] !== undefined && !RESERVED_T_TAG_VALUES.includes(t[1] as typeof RESERVED_T_TAG_VALUES[number])
    )?.[1] || 'traditional';

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
    const mission = event.tags.find(t => t[0] === 'mission')?.[1];
    const images = event.tags.filter(t => t[0] === 'image').map(t => t[1] || '');
    const contentWarning = event.tags.find(t => t[0] === 'content-warning')?.[1];
    const relays = event.tags.filter(t => t[0] === 'r').map(t => t[1] || '');
    const client = event.tags.find(t => t[0] === 'client')?.[1];
    const verificationPubkey = event.tags.find(t => t[0] === 'verification')?.[1];

    // Lightning payout label (NIP-32 style `l` tag, e.g. from Lightning
    // Piggy). The `payout-lnurl-w` label value is what marks a treasure as
    // lightning-enabled; the namespace (third element) is not significant.
    const lightningEnabled = event.tags.some(
      t => t[0] === 'l' && t[1] === 'payout-lnurl-w'
    );

    // Check if cache is hidden (has 't' tag with 'hidden' value)
    const hidden = event.tags.some(t => t[0] === 't' && t[1] === 'hidden');

    // Owner-set lifecycle status (archived | maintenance). Exposed via reserved `t` tag values.
    // If both are present for some reason, `archived` takes precedence (it's the stronger signal).
    let status: ValidCacheStatus | undefined;
    if (event.tags.some(t => t[0] === 't' && t[1] === 'archived')) {
      status = 'archived';
    } else if (event.tags.some(t => t[0] === 't' && t[1] === 'maintenance')) {
      status = 'maintenance';
    }

    // Parse `n` tag type modifiers (NIP-GC Type Modifiers section).
    const modifiers = parseNModifiers(event.tags);

    // Parse the `F` first-to-find lock-in tag. Only meaningful when the
    // `first-to-find` modifier is present; we still parse unconditionally
    // (cheap) and let consumers decide when to consult it.
    const ftfWinner = parseFtfWinner(event.tags);

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
      mission,
      location,
      difficulty: parseInt(difficulty) || 1,
      terrain: parseInt(terrain) || 1,
      size,
      type: cacheType,
      images,
      contentWarning,
      lightningEnabled: lightningEnabled || undefined,
      relays,
      client,
      verificationPubkey,
      hidden,
      status,
      modifiers: modifiers.length > 0 ? modifiers : undefined,
      ftfWinner,
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
  mission?: string;
  images?: string[];
  contentWarning?: string;
  relays?: string[];
  verificationPubkey?: string;
  hidden?: boolean;
  status?: ValidCacheStatus;
  modifiers?: ValidNModifier[];
  /**
   * Optional first-to-find lock-in. Only emitted when set AND the `modifiers`
   * array contains `first-to-find` (we silently drop it otherwise to avoid
   * publishing a misleading lock on a non-FTF treasure). Lowercase hex pubkey.
   */
  ftfWinner?: string;
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

  // Add `n` tag type modifiers (NIP-GC Type Modifiers section).
  // Enforce: only valid values, at most one per category, first wins, dedup.
  const emittedModifiers = new Set<ValidNModifier>();
  if (data.modifiers && data.modifiers.length > 0) {
    const seenCategories = new Set<string>();
    for (const modifier of data.modifiers) {
      if (!validateNModifier(modifier)) continue;
      const category = N_MODIFIER_CATEGORY[modifier];
      if (seenCategories.has(category)) continue;
      seenCategories.add(category);
      emittedModifiers.add(modifier);
      tags.push(['n', modifier]);
    }
  }

  // Emit the `F` first-to-find lock-in tag only when both the modifier is
  // active and a winner pubkey has been supplied. Silently drop otherwise so
  // we never publish a lock on a non-FTF treasure or with a malformed pubkey.
  if (data.ftfWinner && emittedModifiers.has('first-to-find')) {
    const winner = data.ftfWinner.toLowerCase();
    if (/^[0-9a-f]{64}$/.test(winner)) {
      tags.push(['F', winner]);
    }
  }

  // Add optional tags
  if (data.hint?.trim()) {
    tags.push(['hint', data.hint.trim()]);
  }

  if (data.mission?.trim()) {
    tags.push(['mission', data.mission.trim()]);
  }

  if (data.images && data.images.length > 0) {
    data.images.forEach(image => {
      tags.push(['image', image]);
    });
  }

  // Add content-warning tag for spoilers (NIP-36)
  if (data.contentWarning?.trim()) {
    tags.push(['content-warning', data.contentWarning.trim()]);
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

  // Add lifecycle status tag (archived | maintenance) if set by the owner
  if (data.status && VALID_CACHE_STATUSES.includes(data.status)) {
    tags.push(['t', data.status]);
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

// ===== UTILITIES =====

export function createGeocacheCoordinate(pubkey: string, dTag: string, kind: number = NIP_GC_KINDS.GEOCACHE): string {
  return `${kind}:${pubkey}:${dTag}`;
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

// ===== ADVENTURE PARSING & BUILDING =====

export function parseAdventureEvent(event: NostrEvent): Adventure | null {
  try {
    if (event.kind !== NIP_GC_KINDS.ADVENTURE) {
      return null;
    }

    const dTag = event.tags.find(t => t[0] === 'd')?.[1];
    if (!dTag) {
      return null;
    }

    const title = event.tags.find(t => t[0] === 'title')?.[1];
    if (!title) {
      return null;
    }

    const summary = event.tags.find(t => t[0] === 'description')?.[1];
    const image = event.tags.find(t => t[0] === 'image')?.[1];

    // Parse optional theme and map style
    const VALID_THEMES: AdventureTheme[] = ['adventure', 'mojave'];
    const VALID_MAP_STYLES: AdventureMapStyle[] = ['original', 'dark', 'satellite', 'adventure', 'mojave'];

    const rawTheme = event.tags.find(t => t[0] === 'theme')?.[1];
    const theme = rawTheme && VALID_THEMES.includes(rawTheme as AdventureTheme)
      ? rawTheme as AdventureTheme
      : undefined;

    const rawMapStyle = event.tags.find(t => t[0] === 'map')?.[1];
    const mapStyle = rawMapStyle && VALID_MAP_STYLES.includes(rawMapStyle as AdventureMapStyle)
      ? rawMapStyle as AdventureMapStyle
      : undefined;

    // Parse location from geohash
    const geohashes = event.tags.filter(t => t[0] === 'g').map(t => t[1]).filter(Boolean);
    const geohash = geohashes.length > 0
      ? geohashes.reduce((longest, current) =>
          (current && current.length > (longest?.length || 0)) ? current : longest
        )
      : undefined;

    let location: { lat: number; lng: number } | undefined;
    if (geohash) {
      try {
        location = decodeGeohash(geohash);
        if (!validateCoordinates(location.lat, location.lng)) {
          location = undefined;
        }
      } catch {
        location = undefined;
      }
    }

    // Extract geocache references (a tags pointing to kind 37516 or 37515)
    const geocacheRefs = event.tags
      .filter(t => t[0] === 'a' && t[1])
      .map(t => t[1] as string)
      .filter(ref => {
        const kind = ref.split(':')[0];
        return kind === NIP_GC_KINDS.GEOCACHE.toString() ||
               kind === NIP_GC_KINDS.GEOCACHE_LEGACY.toString();
      });

    if (geocacheRefs.length === 0) {
      return null;
    }

    const naddr = nip19.naddrEncode({
      identifier: dTag,
      pubkey: event.pubkey,
      kind: event.kind,
    });

    return {
      id: event.id,
      pubkey: event.pubkey,
      created_at: event.created_at,
      dTag,
      naddr,
      title,
      description: event.content,
      summary,
      image,
      location,
      theme,
      mapStyle,
      geocacheRefs,
    };
  } catch {
    return null;
  }
}

export function buildAdventureTags(data: {
  dTag: string;
  title: string;
  summary?: string;
  image?: string;
  location: { lat: number; lng: number };
  theme?: AdventureTheme;
  mapStyle?: AdventureMapStyle;
  geocacheRefs: string[];
}): string[][] {
  const tags: string[][] = [
    ['d', data.dTag],
    ['title', data.title],
  ];

  if (data.summary?.trim()) {
    tags.push(['description', data.summary.trim()]);
  }

  if (data.image?.trim()) {
    tags.push(['image', data.image.trim()]);
  }

  // Add geohash tags for location-based discovery
  if (data.location && validateCoordinates(data.location.lat, data.location.lng)) {
    const { lat, lng } = data.location;
    // Add geohashes at precision levels 3-6 for discovery
    for (const precision of [3, 4, 5, 6]) {
      tags.push(['g', encodeGeohash(lat, lng, precision)]);
    }
  }

  // Add optional theme and map style
  if (data.theme) {
    tags.push(['theme', data.theme]);
  }

  if (data.mapStyle) {
    tags.push(['map', data.mapStyle]);
  }

  // Add geocache references in order
  for (const ref of data.geocacheRefs) {
    tags.push(['a', ref]);
  }

  return tags;
}

