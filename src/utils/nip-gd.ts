/**
 * NIP-GD (Good Deed) utilities
 *
 * Builders for kind 5777 "Good Deed" events as defined in NIP-GD.md.
 *
 * In Treasures, Good Deeds are used as the claim-by-deed path for treasures
 * that include a `mission` tag (a "Key Quest"). A Good Deed referencing the
 * treasure via an `a` tag is treated as a self-attested completion of the
 * Key Quest.
 */

import { NIP_GC_KINDS, createGeocacheCoordinate } from '@/utils/nip-gc';

// ===== CONSTANTS =====

export const NIP_GD_KINDS = {
  GOOD_DEED: 5777,
} as const;

// ===== TAG BUILDERS =====

/**
 * Build the tag list for a kind 5777 Good Deed event.
 *
 * In this codebase the only callers we currently support are Key Quest
 * completions, so `geocache` is required; other reference types (`e`, `i`)
 * and beneficiaries can be added later if/when we surface them in the UI.
 */
export function buildGoodDeedTags(data: {
  /** Treasure being claimed via this deed. */
  geocache: {
    pubkey: string;
    dTag: string;
    /** Defaults to NIP_GC_KINDS.GEOCACHE (37516). */
    kind?: number;
  };
  /** Optional categorization. */
  categories?: string[];
  /** Optional NIP-92 image attachments built via {@link buildImetaTag}. */
  imeta?: string[][];
  /** Optional geohash for location. Authors SHOULD use lower precision when sensitive. */
  geohash?: string;
  /** Optional beneficiary pubkeys. */
  beneficiaries?: string[];
}): string[][] {
  const tags: string[][] = [];

  // Cross-NIP integration: reference the treasure that defined the Key Quest.
  tags.push([
    'a',
    createGeocacheCoordinate(
      data.geocache.pubkey,
      data.geocache.dTag,
      data.geocache.kind ?? NIP_GC_KINDS.GEOCACHE,
    ),
  ]);

  // Beneficiaries (NIP-GD §"Beneficiaries — p").
  for (const pubkey of data.beneficiaries ?? []) {
    if (pubkey) tags.push(['p', pubkey]);
  }

  // Categories (NIP-GD §"Categorization — t").
  for (const t of data.categories ?? []) {
    const trimmed = t.trim();
    if (trimmed) tags.push(['t', trimmed]);
  }

  // Media (NIP-GD §"Media — imeta", NIP-92).
  for (const im of data.imeta ?? []) {
    if (im.length > 1) tags.push(im);
  }

  // Location.
  if (data.geohash?.trim()) {
    tags.push(['g', data.geohash.trim()]);
  }

  return tags;
}

/**
 * Build a NIP-92 `imeta` tag from a Blossom/NIP-94 tag list returned by
 * {@link useUploadFile}.
 *
 * The input is the raw tag list (`[['url', ...], ['x', ...], ...]`); the
 * output is a single flat-string `imeta` tag of the form:
 *
 *     ['imeta', 'url <u>', 'm <mime>', 'x <sha256>', 'dim <wxh>', 'alt <text>']
 *
 * Unknown keys are passed through. Returns `null` if no URL is present.
 */
export function buildImetaTag(
  uploadTags: string[][],
  alt?: string,
): string[] | null {
  const map = new Map<string, string>();
  for (const [key, value] of uploadTags) {
    if (!key || value == null) continue;
    // First occurrence wins; Blossom typically only returns one of each.
    if (!map.has(key)) map.set(key, value);
  }

  const url = map.get('url');
  if (!url) return null;

  const parts: string[] = ['imeta', `url ${url}`];

  // Order is informational only per NIP-92 but we keep a stable shape.
  const orderedKeys = ['m', 'x', 'size', 'dim', 'blurhash', 'thumb', 'image'];
  for (const key of orderedKeys) {
    const value = map.get(key);
    if (value) parts.push(`${key} ${value}`);
  }

  // Forward any other keys not in the canonical list.
  for (const [key, value] of map) {
    if (key === 'url') continue;
    if (orderedKeys.includes(key)) continue;
    parts.push(`${key} ${value}`);
  }

  if (alt?.trim()) {
    parts.push(`alt ${alt.trim()}`);
  }

  return parts;
}

/** Extract the canonical URL from a NIP-92 `imeta` tag, if present. */
export function getImetaUrl(imeta: string[]): string | undefined {
  for (let i = 1; i < imeta.length; i++) {
    const part = imeta[i];
    if (typeof part !== 'string') continue;
    if (part.startsWith('url ')) return part.slice(4).trim();
  }
  return undefined;
}
