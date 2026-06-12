import L from "leaflet";
import type { CacheType } from "./cacheIcons.types";
import {
  MOJAVE_AMBER,
  MOJAVE_AMBER_GLOW,
  MOJAVE_TERMINAL_BG,
  MOJAVE_AMBER_BORDER,
} from "@/config/cacheIconConstants";

/**
 * Get the SVG string for a cache type (used in map markers).
 *
 * These are hand-transcribed copies of the Lucide `chest`/`Compass`/
 * `HelpCircle` glyphs rendered by `cacheIcons.tsx` — keep them in lockstep.
 *
 * Strokes are emitted as `currentColor` so callers can recolor the glyph by
 * setting `color` on the wrapper element (or by string-replacing
 * `stroke="currentColor"` for static markup). If a caller doesn't override
 * the color, the wrapper's `color` should default to white to match the
 * original behavior.
 */
function getCacheIconSvg(type: string): string {
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
 */
function getArtModifierIconSvg(): string {
  return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/>
    <circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/>
    <circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/>
    <circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/>
    <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>
  </svg>`;
}

/**
 * Get the color for a cache type (used in map markers).
 * Mirrors the Tailwind `colorClasses` palette in `@/config/cacheIconConstants`.
 */
function getCacheColor(type: string): string {
  const cacheType = type.toLowerCase() as CacheType;

  const colors = {
    traditional: '#299e5e', // Brand green (primary)
    multi: '#f59e0b',      // Amber-500
    mystery: '#8b5cf6',    // Purple-500
  };

  return colors[cacheType] || colors.traditional;
}

/**
 * Per-theme map marker variants.
 * - 'default'   → circular colored pin (light/dark/system themes).
 * - 'adventure' → square parchment-blue quest marker.
 * - 'mojave'    → Pip-Boy CRT amber glyph on a near-black terminal panel.
 */
export type MapIconTheme = 'default' | 'adventure' | 'mojave';

// Cached Leaflet DivIcon instances: 3 types × 3 themes = 9 icons, plus the
// claimed-FTF / art / lightning variants. Shared across every map in the app
// so we don't duplicate the DOM allocations once per map instance.
const iconCache = new Map<string, L.DivIcon>();

/**
 * Shared shell for the small 16px corner badges composited onto markers
 * (claimed-FTF trophy, lightning bolt).
 *
 * All badges anchor to the marker's right edge. `slot` is the vertical
 * position: slot 0 hugs the top-right corner, slot 1 sits directly below it,
 * etc. — so when a marker carries more than one badge they stack vertically
 * instead of fighting over the same corner.
 */
function buildCornerBadgeHtml(slot: number, background: string, iconSvg: string): string {
  return `
  <div style="
    position: absolute;
    top: ${-4 + slot * 18}px;
    right: -4px;
    width: 16px;
    height: 16px;
    background: ${background};
    border: 2px solid white;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 1px 3px rgba(0,0,0,0.35);
    z-index: 2;
    pointer-events: none;
  ">
    ${iconSvg}
  </div>
`;
}

/**
 * Small trophy-on-tan badge HTML.
 *
 * Indicates that a first-to-find treasure has already been claimed (a
 * verified found log exists or the F tag is locked). Rendered as a separate
 * absolutely-positioned element so it composes with every theme variant
 * without redrawing the underlying glyph.
 */
function buildClaimedBadgeHtml(slot: number = 0): string {
  return buildCornerBadgeHtml(
    slot,
    '#b45309',
    `<svg xmlns="http://www.w3.org/2000/svg" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/>
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
      <path d="M4 22h16"/>
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>
    </svg>`,
  );
}

/**
 * Small white-bolt-on-yellow badge HTML.
 *
 * Indicates the treasure is lightning-enabled (carries an
 * `["l", "payout-lnurl-w", …]` payout label), i.e. finding it pays out sats.
 */
function buildLightningBadgeHtml(slot: number = 0): string {
  return buildCornerBadgeHtml(
    slot,
    '#eab308',
    `<svg xmlns="http://www.w3.org/2000/svg" width="9" height="9" viewBox="0 0 24 24" fill="#ffffff" stroke="#ffffff" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
    </svg>`,
  );
}

function buildCacheIconHtml(type: string, iconTheme: MapIconTheme, isArt: boolean): string {
  // When the treasure carries the `art` modifier we swap the per-type glyph
  // for a Palette glyph so the marker visibly signals "this cache IS a
  // piece of art". The cache type's color and marker frame stay so the
  // type itself is still readable from the marker shape.
  const iconSvg = isArt ? getArtModifierIconSvg() : getCacheIconSvg(type);
  const color = getCacheColor(type);

  if (iconTheme === 'adventure') {
    const adventureColors = {
      background: '#6495ED',
      border: '#4169E1',
      icon: '#FFFFFF',
    };
    return `
      <div style="
        background: ${adventureColors.background};
        border: 2px solid ${adventureColors.border};
        border-radius: 4px;
        width: 36px;
        height: 36px;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2px 4px rgba(65, 105, 225, 0.3);
        position: relative;
        cursor: pointer;
        color: ${adventureColors.icon};
      ">
        ${iconSvg.replace(/stroke="currentColor"/g, `stroke="${adventureColors.icon}"`).replace(/fill="currentColor"/g, `fill="${adventureColors.icon}"`)}
      </div>
      <div style="
        position: absolute;
        bottom: -6px;
        left: 50%;
        transform: translateX(-50%);
        width: 0;
        height: 0;
        border-left: 6px solid transparent;
        border-right: 6px solid transparent;
        border-top: 6px solid ${adventureColors.background};
      "></div>
    `;
  }

  if (iconTheme === 'mojave') {
    const mojaveColors = {
      background: MOJAVE_TERMINAL_BG,
      border: MOJAVE_AMBER_BORDER,
      icon: MOJAVE_AMBER,
      glow: MOJAVE_AMBER_GLOW,
    };
    return `
      <div style="
        background: ${mojaveColors.background};
        border: 2px solid ${mojaveColors.border};
        border-radius: 4px;
        width: 36px;
        height: 36px;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 0 8px ${mojaveColors.glow}, 0 2px 4px rgba(0, 0, 0, 0.6);
        position: relative;
        cursor: pointer;
        color: ${mojaveColors.icon};
      ">
        ${iconSvg.replace(/stroke="currentColor"/g, `stroke="${mojaveColors.icon}"`).replace(/fill="currentColor"/g, `fill="${mojaveColors.icon}"`)}
      </div>
      <div style="
        position: absolute;
        bottom: -6px;
        left: 50%;
        transform: translateX(-50%);
        width: 0;
        height: 0;
        border-left: 6px solid transparent;
        border-right: 6px solid transparent;
        border-top: 6px solid ${mojaveColors.border};
        filter: drop-shadow(0 0 3px ${mojaveColors.glow});
      "></div>
    `;
  }

  return `
    <div style="
      background: ${color};
      border: 3px solid white;
      border-radius: 50%;
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 4px rgba(0,0,0,0.25);
      position: relative;
      cursor: pointer;
      color: white;
    ">
      ${iconSvg}
    </div>
    <div style="
      position: absolute;
      bottom: -8px;
      left: 50%;
      transform: translateX(-50%);
      width: 0;
      height: 0;
      border-left: 8px solid transparent;
      border-right: 8px solid transparent;
      border-top: 8px solid ${color};
    "></div>
  `;
}

function buildIconDimensions(iconTheme: MapIconTheme): {
  iconSize: [number, number];
  iconAnchor: [number, number];
  popupAnchor: [number, number];
} {
  if (iconTheme === 'adventure' || iconTheme === 'mojave') {
    return {
      iconSize: [36, 42],
      iconAnchor: [18, 42],
      popupAnchor: [0, -42],
    };
  }
  return {
    iconSize: [40, 48],
    iconAnchor: [20, 48],
    popupAnchor: [0, -48],
  };
}

export function getCachedCacheIcon(
  type: string,
  iconTheme: MapIconTheme,
  isArt: boolean = false,
  isLightning: boolean = false,
): L.DivIcon {
  const key = `${type}-${iconTheme}${isArt ? '-art' : ''}${isLightning ? '-lightning' : ''}`;
  const cached = iconCache.get(key);
  if (cached) return cached;

  const dims = buildIconDimensions(iconTheme);
  const baseClassName =
    iconTheme === 'adventure'
      ? 'custom-cache-icon adventure-cache-icon adventure-quest-marker'
      : iconTheme === 'mojave'
        ? 'custom-cache-icon mojave-cache-icon'
        : 'custom-cache-icon';
  let className = isArt ? `${baseClassName} art-cache-icon` : baseClassName;
  if (isLightning) className = `${className} lightning-cache-icon`;

  // The bolt badge needs a positioning shell so it can be absolutely
  // positioned relative to the marker as a whole (same approach as the
  // claimed-FTF trophy badge). It's the only badge here, so it takes
  // slot 0 (top-right corner).
  let html = buildCacheIconHtml(type, iconTheme, isArt);
  if (isLightning) {
    html = `
      <div style="position: relative; width: 100%; height: 100%;">
        ${html}
        ${buildLightningBadgeHtml(0)}
      </div>
    `;
  }

  const icon = L.divIcon({
    html,
    className,
    ...dims,
  });

  iconCache.set(key, icon);
  return icon;
}

/**
 * Same as `getCachedCacheIcon` but composites a small claimed-trophy badge
 * in the upper-right corner. Used for first-to-find treasures whose prize
 * has already been won — every viewer sees the badge so they know to
 * choose a different target.
 *
 * `isArt` propagates the art-modifier glyph swap, so an art treasure
 * remains visibly art-flagged even after its FTF claim is taken.
 * `isLightning` composes the bolt badge in the upper-left corner so both
 * indicators can coexist on one marker.
 */
export function getCachedClaimedFtfIcon(
  type: string,
  iconTheme: MapIconTheme,
  isArt: boolean = false,
  isLightning: boolean = false,
): L.DivIcon {
  const key = `claimed-ftf-${type}-${iconTheme}${isArt ? '-art' : ''}${isLightning ? '-lightning' : ''}`;
  const cached = iconCache.get(key);
  if (cached) return cached;

  const dims = buildIconDimensions(iconTheme);
  const baseClassName =
    iconTheme === 'adventure'
      ? 'custom-cache-icon adventure-cache-icon adventure-quest-marker claimed-ftf-marker'
      : iconTheme === 'mojave'
        ? 'custom-cache-icon mojave-cache-icon claimed-ftf-marker'
        : 'custom-cache-icon claimed-ftf-marker';
  let className = isArt ? `${baseClassName} art-cache-icon` : baseClassName;
  if (isLightning) className = `${className} lightning-cache-icon`;

  // Wrap the underlying marker HTML in a positioning shell so the corner
  // badges can be absolutely positioned relative to the marker as a whole.
  // The trophy takes slot 0 (top-right); when the treasure is also
  // lightning-enabled the bolt stacks vertically below it in slot 1.
  const innerHtml = buildCacheIconHtml(type, iconTheme, isArt);
  const html = `
    <div style="position: relative; width: 100%; height: 100%;">
      ${innerHtml}
      ${buildClaimedBadgeHtml(0)}
      ${isLightning ? buildLightningBadgeHtml(1) : ''}
    </div>
  `;

  const icon = L.divIcon({
    html,
    className,
    ...dims,
  });

  iconCache.set(key, icon);
  return icon;
}

/** Map a map-style key to its marker theme. Convenience for callers. */
export function mapStyleToIconTheme(mapStyle: string): MapIconTheme {
  if (mapStyle === 'adventure') return 'adventure';
  if (mapStyle === 'mojave') return 'mojave';
  return 'default';
}
