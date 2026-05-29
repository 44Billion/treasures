import L from "leaflet";
import { getCacheIconSvg, getCacheColor, getArtModifierIconSvg } from "@/utils/cacheIconUtils";

/**
 * Per-theme map marker variants.
 * - 'default'   → circular colored pin (light/dark/system themes).
 * - 'adventure' → square parchment-blue quest marker.
 * - 'mojave'    → Pip-Boy CRT amber glyph on a near-black terminal panel.
 */
export type MapIconTheme = 'default' | 'adventure' | 'mojave';

// Cached Leaflet DivIcon instances: 3 types × 3 themes = 9 icons, plus the
// claimed-FTF variants. Shared across every map in the app so we don't
// duplicate the DOM allocations once per map instance.
const iconCache = new Map<string, L.DivIcon>();

/**
 * Small trophy-on-tan badge HTML, anchored to the top-right of the marker.
 *
 * Indicates that a first-to-find treasure has already been claimed (a
 * verified found log exists or the F tag is locked). Rendered as a separate
 * absolutely-positioned element so it composes with every theme variant
 * without redrawing the underlying glyph.
 */
const claimedBadgeHtml = `
  <div style="
    position: absolute;
    top: -4px;
    right: -4px;
    width: 16px;
    height: 16px;
    background: #b45309;
    border: 2px solid white;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 1px 3px rgba(0,0,0,0.35);
    z-index: 2;
    pointer-events: none;
  ">
    <svg xmlns="http://www.w3.org/2000/svg" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/>
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
      <path d="M4 22h16"/>
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>
    </svg>
  </div>
`;

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
      background: '#0f0a05',
      border: '#c48f2a',
      icon: '#e8a838',
      glow: 'rgba(232, 168, 56, 0.45)',
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
): L.DivIcon {
  const key = `${type}-${iconTheme}${isArt ? '-art' : ''}`;
  const cached = iconCache.get(key);
  if (cached) return cached;

  const dims = buildIconDimensions(iconTheme);
  const className =
    iconTheme === 'adventure'
      ? 'custom-cache-icon adventure-cache-icon adventure-quest-marker'
      : iconTheme === 'mojave'
        ? 'custom-cache-icon mojave-cache-icon'
        : 'custom-cache-icon';

  const icon = L.divIcon({
    html: buildCacheIconHtml(type, iconTheme, isArt),
    className: isArt ? `${className} art-cache-icon` : className,
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
 */
export function getCachedClaimedFtfIcon(
  type: string,
  iconTheme: MapIconTheme,
  isArt: boolean = false,
): L.DivIcon {
  const key = `claimed-ftf-${type}-${iconTheme}${isArt ? '-art' : ''}`;
  const cached = iconCache.get(key);
  if (cached) return cached;

  const dims = buildIconDimensions(iconTheme);
  const baseClassName =
    iconTheme === 'adventure'
      ? 'custom-cache-icon adventure-cache-icon adventure-quest-marker claimed-ftf-marker'
      : iconTheme === 'mojave'
        ? 'custom-cache-icon mojave-cache-icon claimed-ftf-marker'
        : 'custom-cache-icon claimed-ftf-marker';
  const className = isArt ? `${baseClassName} art-cache-icon` : baseClassName;

  // Wrap the underlying marker HTML in a positioning shell so the trophy
  // badge can be absolutely positioned relative to the marker as a whole.
  const innerHtml = buildCacheIconHtml(type, iconTheme, isArt);
  const html = `
    <div style="position: relative; width: 100%; height: 100%;">
      ${innerHtml}
      ${claimedBadgeHtml}
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
