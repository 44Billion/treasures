import type { RelayMetadata } from '@/contexts/AppContext';

/** Normalize a relay URL for deduplication (lowercase, strip trailing slash). */
function normalizeUrl(url: string): string {
  return url.toLowerCase().replace(/\/+$/, '');
}

/**
 * App default relays. Hardcoded in the app (not user-editable) and included in
 * the effective relay set whenever `useAppRelays` is enabled. Also used as the
 * sole connectivity source out of the box, since the user's personal relays are
 * opt-in (`useUserRelays`, default off).
 */
export const APP_RELAYS: RelayMetadata = {
  relays: [
    { url: 'wss://relay.ditto.pub/', read: true, write: true },
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
  { name: 'Dreamith', url: 'wss://relay.dreamith.to/' },
];

/**
 * Get the effective relay list based on user settings.
 *
 * - `useAppRelays`: when true, the hardcoded app-default relays are included (first).
 * - `useUserRelays`: when true, the user's personal NIP-65 list is included.
 *
 * When both flags are off the result is empty. When both are on the two lists
 * are merged with app relays first, deduplicated by normalized URL.
 */
export function getEffectiveRelays(
  userRelays: RelayMetadata | undefined,
  useAppRelays: boolean,
  useUserRelays: boolean,
): RelayMetadata {
  const seen = new Set<string>();
  const mergedRelays: RelayMetadata['relays'][number][] = [];

  const sources: RelayMetadata['relays'][number][] = [];
  if (useAppRelays) sources.push(...APP_RELAYS.relays);
  if (useUserRelays && Array.isArray(userRelays?.relays)) {
    sources.push(...userRelays.relays);
  }

  for (const relay of sources) {
    const normalized = normalizeUrl(relay.url);
    if (!seen.has(normalized)) {
      seen.add(normalized);
      mergedRelays.push(relay);
    }
  }

  return {
    relays: mergedRelays,
    updatedAt: userRelays?.updatedAt ?? 0,
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
