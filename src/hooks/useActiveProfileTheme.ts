import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { TIMEOUTS } from '@/config';

/** Kind 16767: replaceable active profile theme (one per user), as used by Ditto. */
const ACTIVE_THEME_KIND = 16767;

/** The 3 core colors that define a Ditto theme (HSL strings, e.g. "228 20% 10%"). */
export interface DittoThemeColors {
  background: string;
  text: string;
  primary: string;
}

/** Font configuration from a Ditto theme. */
export interface DittoThemeFont {
  family: string;
  url?: string;
}

/** Background image configuration from a Ditto theme. */
export interface DittoThemeBackground {
  url: string;
  mode?: 'cover' | 'tile';
}

/** Parsed active profile theme from a kind 16767 event. */
export interface ActiveProfileTheme {
  colors: DittoThemeColors;
  /** Body font */
  font?: DittoThemeFont;
  /** Title/heading font */
  titleFont?: DittoThemeFont;
  background?: DittoThemeBackground;
}

/** Check if a string looks like a valid hex color (#RGB or #RRGGBB). */
function isValidHex(hex: string): boolean {
  return /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(hex);
}

/** Convert hex color to an HSL string like "228 20% 10%". */
function hexToHslString(hex: string): string {
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  const r = parseInt(hex.slice(0, 2), 16) / 255;
  const g = parseInt(hex.slice(2, 4), 16) / 255;
  const b = parseInt(hex.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  if (max === min) {
    return `0 0% ${Math.round(l * 100)}%`;
  }

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

/**
 * Parse `c` tags from a kind 16767 event into core theme colors.
 * Tags look like: ["c", "#1a1a2e", "background"]
 */
function parseColorTags(tags: string[][]): DittoThemeColors | null {
  const colorMap = new Map<string, string>();
  for (const tag of tags) {
    if (tag[0] === 'c' && tag[1] && tag[2]) {
      colorMap.set(tag[2], tag[1]);
    }
  }

  const bgHex = colorMap.get('background');
  const textHex = colorMap.get('text');
  const primaryHex = colorMap.get('primary');

  if (!bgHex || !textHex || !primaryHex) return null;
  if (!isValidHex(bgHex) || !isValidHex(textHex) || !isValidHex(primaryHex)) return null;

  return {
    background: hexToHslString(bgHex),
    text: hexToHslString(textHex),
    primary: hexToHslString(primaryHex),
  };
}

/**
 * Parse `f` tags from a kind 16767 event into body and title fonts.
 * Tags look like: ["f", "Comfortaa", "https://cdn...", "body"]
 */
function parseFontTags(tags: string[][]): { font?: DittoThemeFont; titleFont?: DittoThemeFont } {
  let font: DittoThemeFont | undefined;
  let titleFont: DittoThemeFont | undefined;

  for (const tag of tags) {
    if (tag[0] !== 'f' || !tag[1]) continue;
    const role = tag[3]; // 4th element: "body", "title", or absent (legacy)
    const parsed: DittoThemeFont = { family: tag[1] };
    const fontUrl = tag[2];
    if (fontUrl && (fontUrl.startsWith('https://') || fontUrl.startsWith('http://'))) {
      parsed.url = fontUrl;
    }

    if (role === 'title') {
      if (!titleFont) titleFont = parsed;
    } else {
      // "body" or absent (legacy) — treat as body font
      if (!font) font = parsed;
    }
  }

  return { font, titleFont };
}

/**
 * Parse a `bg` tag from a kind 16767 event into a background config.
 * Tags look like: ["bg", "url https://...", "mode cover", "m image/jpeg"]
 */
function parseBackgroundTag(tags: string[][]): DittoThemeBackground | undefined {
  const bgTag = tags.find(([n]) => n === 'bg');
  if (!bgTag) return undefined;

  const kv = new Map<string, string>();
  for (let i = 1; i < bgTag.length; i++) {
    const entry = bgTag[i];
    const spaceIdx = entry.indexOf(' ');
    if (spaceIdx === -1) continue;
    kv.set(entry.slice(0, spaceIdx), entry.slice(spaceIdx + 1));
  }

  const url = kv.get('url');
  if (!url || (!url.startsWith('https://') && !url.startsWith('http://'))) return undefined;

  const bg: DittoThemeBackground = { url };
  const mode = kv.get('mode');
  if (mode === 'cover' || mode === 'tile') bg.mode = mode;

  return bg;
}

/**
 * Fallback parser: try reading colors as JSON in content (legacy format).
 */
function parseLegacyContent(content: string): DittoThemeColors | null {
  try {
    const parsed = JSON.parse(content) as Record<string, unknown>;

    // Current format: { background, text, primary }
    if (parsed.background && parsed.text && parsed.primary) {
      return {
        background: String(parsed.background),
        text: String(parsed.text),
        primary: String(parsed.primary),
      };
    }

    // Legacy 19-token format: { background, foreground, primary, ... }
    if (parsed.background && parsed.foreground && parsed.primary) {
      return {
        background: String(parsed.background),
        text: String(parsed.foreground),
        primary: String(parsed.primary),
      };
    }
  } catch {
    // Invalid JSON
  }
  return null;
}

/**
 * Hook that queries the current user's kind 16767 active profile theme from Nostr.
 * Returns the parsed theme if found, or undefined if not.
 * Only queries when a user is logged in.
 */
export function useActiveProfileTheme() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();

  const query = useQuery({
    queryKey: ['active-profile-theme', user?.pubkey],
    queryFn: async (c) => {
      if (!user?.pubkey) return null;

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(TIMEOUTS.QUERY)]);
      const events = await nostr.query(
        [{ kinds: [ACTIVE_THEME_KIND], authors: [user.pubkey], limit: 1 }],
        { signal },
      );

      if (events.length === 0) return null;

      const event = events[0];

      // Try new format: colors in `c` tags
      let colors = parseColorTags(event.tags);

      // Fall back to legacy format: colors as JSON in content
      if (!colors && event.content) {
        colors = parseLegacyContent(event.content);
      }

      if (!colors) return null;

      const { font, titleFont } = parseFontTags(event.tags);
      const background = parseBackgroundTag(event.tags);

      return { colors, font, titleFont, background } as ActiveProfileTheme;
    },
    enabled: !!user?.pubkey,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000,   // 10 minutes
  });

  return {
    profileTheme: query.data ?? undefined,
    isLoading: query.isLoading,
    hasDittoTheme: !!query.data,
  };
}
