import type { CacheType } from './cacheIcons.types';

/**
 * Get the SVG string for a cache type (used in map markers).
 *
 * Strokes are emitted as `currentColor` so callers can recolor the glyph by
 * setting `color` on the wrapper element (or by string-replacing
 * `stroke="currentColor"` for static markup). If a caller doesn't override
 * the color, the wrapper's `color` should default to white to match the
 * original behavior.
 */
export function getCacheIconSvg(type: string): string {
  const cacheType = type.toLowerCase() as CacheType;

  switch (cacheType) {
    case 'traditional':
      // Chest icon SVG
      return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M8 19a2 2 0 0 0 2-2V9a4 4 0 0 0-8 0v8a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a4 4 0 0 0-4-4H6"/>
        <path d="M2 11h20"/>
        <path d="M16 11v3"/>
      </svg>`;
    case 'multi':
      // Compass icon SVG
      return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <polygon points="16.24,7.76 14.12,14.12 7.76,16.24 9.88,9.88"/>
      </svg>`;
    case 'mystery':
      // HelpCircle icon SVG
      return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
        <path d="M12 17h.01"/>
      </svg>`;
    default:
      // Default to chest icon
      return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M8 19a2 2 0 0 0 2-2V9a4 4 0 0 0-8 0v8a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a4 4 0 0 0-4-4H6"/>
        <path d="M2 11h20"/>
        <path d="M16 11v3"/>
      </svg>`;
  }
}

/**
 * Get the SVG glyph for the `art` modifier (Lucide `Palette`).
 *
 * Used on map markers in place of the per-type glyph when a treasure
 * carries the `art` modifier, so the marker visibly signals "this cache
 * IS a piece of art" at a glance. The cache type's color and marker shape
 * are preserved so the cache type is still legible from the marker frame.
 *
 * Strokes are emitted as `currentColor` so callers can recolor the glyph
 * by setting `color` on the wrapper (matching the behavior of
 * `getCacheIconSvg`).
 */
export function getArtModifierIconSvg(): string {
  return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/>
    <circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/>
    <circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/>
    <circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/>
    <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>
  </svg>`;
}

/**
 * Get the color for a cache type (used in map markers)
 */
export function getCacheColor(type: string): string {
  const cacheType = type.toLowerCase() as CacheType;
  
  const colors = {
    traditional: '#299e5e', // Brand green (primary)
    multi: '#f59e0b',      // Amber-500
    mystery: '#8b5cf6',    // Purple-500
  };
  
  return colors[cacheType] || colors.traditional;
}

