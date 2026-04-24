import type { RelayMetadata } from '@/contexts/AppContext';

/** Normalize a relay URL for deduplication (lowercase, strip trailing slash). */
function normalizeUrl(url: string): string {
  return url.toLowerCase().replace(/\/+$/, '');
}

/**
 * App default relays used as a fallback when the user has no NIP-65 relay list,
 * and optionally combined with user relays when useAppRelays is true.
 */
export const APP_RELAYS: RelayMetadata = {
  relays: [
    { url: 'wss://relay.ditto.pub/', read: true, write: true },
    { url: 'wss://relay.damus.io/', read: true, write: true },
    { url: 'wss://nos.lol/', read: true, write: false },
    { url: 'wss://relay.dreamith.to/', read: true, write: true },
  ],
  updatedAt: 0,
};

/**
 * Default relays that support NIP-50 search, used for full-text geocache search.
 */
export const SEARCH_RELAYS = [
  'wss://relay.ditto.pub/',
  'wss://relay.dreamith.to/',
];

/**
 * Preset relays displayed in the UI for user selection.
 */
export const PRESET_RELAYS = [
  { name: 'Ditto', url: 'wss://relay.ditto.pub/' },
  { name: 'Damus', url: 'wss://relay.damus.io/' },
  { name: 'nos.lol', url: 'wss://nos.lol/' },
  { name: 'Dreamith', url: 'wss://relay.dreamith.to/' },
];

/**
 * Get the effective relay list based on user settings.
 * Combines app relays with user relays if useAppRelays is true,
 * otherwise returns only user relays.
 */
export function getEffectiveRelays(
  userRelays: RelayMetadata | undefined,
  useAppRelays: boolean,
): RelayMetadata {
  // Defensive: if userRelays is missing or malformed, use app defaults
  if (!userRelays?.relays || !Array.isArray(userRelays.relays)) {
    return APP_RELAYS;
  }

  if (!useAppRelays) {
    return deduplicateRelays(userRelays);
  }

  // Merge app relays with user relays, avoiding duplicates by normalized URL
  const seen = new Set<string>();
  const mergedRelays: RelayMetadata['relays'][number][] = [];

  for (const relay of [...APP_RELAYS.relays, ...userRelays.relays]) {
    const normalized = normalizeUrl(relay.url);
    if (!seen.has(normalized)) {
      seen.add(normalized);
      mergedRelays.push(relay);
    }
  }

  return {
    relays: mergedRelays,
    updatedAt: userRelays.updatedAt,
  };
}

/**
 * Get the effective search relay list based on user settings.
 * Combines app search relays with user search relays if useAppSearchRelays is true,
 * otherwise returns only user search relays. Falls back to app defaults if empty.
 */
export function getEffectiveSearchRelays(
  userRelays: string[] | undefined,
  useAppSearchRelays: boolean,
): string[] {
  const userList = Array.isArray(userRelays) ? userRelays : [];

  if (!useAppSearchRelays) {
    // If user disabled app relays but has none of their own, still use app defaults
    return userList.length > 0 ? deduplicateUrls(userList) : SEARCH_RELAYS;
  }

  // Merge: app defaults first, then user relays, deduplicated
  return deduplicateUrls([...SEARCH_RELAYS, ...userList]);
}

/** Deduplicate a list of URLs by normalized form. */
function deduplicateUrls(urls: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const url of urls) {
    const normalized = normalizeUrl(url);
    if (!seen.has(normalized)) {
      seen.add(normalized);
      result.push(url);
    }
  }
  return result;
}

/** Deduplicate relays within a single list by normalized URL. */
function deduplicateRelays(metadata: RelayMetadata): RelayMetadata {
  const seen = new Set<string>();
  const relays: RelayMetadata['relays'][number][] = [];

  for (const relay of metadata.relays) {
    const normalized = normalizeUrl(relay.url);
    if (!seen.has(normalized)) {
      seen.add(normalized);
      relays.push(relay);
    }
  }

  return { relays, updatedAt: metadata.updatedAt };
}
