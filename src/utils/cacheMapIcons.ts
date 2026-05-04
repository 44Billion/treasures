import L from "leaflet";
import { getCacheIconSvg, getCacheColor } from "@/utils/cacheIconUtils";

/**
 * Per-theme map marker variants.
 * - 'default'   → circular colored pin (light/dark/system themes).
 * - 'adventure' → square parchment-blue quest marker.
 * - 'mojave'    → Pip-Boy CRT amber glyph on a near-black terminal panel.
 */
export type MapIconTheme = 'default' | 'adventure' | 'mojave';

// Cached Leaflet DivIcon instances: 3 types × 3 themes = 9 icons.
// Shared across every map in the app so we don't duplicate the DOM
// allocations once per map instance.
const iconCache = new Map<string, L.DivIcon>();

export function getCachedCacheIcon(type: string, iconTheme: MapIconTheme): L.DivIcon {
  const key = `${type}-${iconTheme}`;
  const cached = iconCache.get(key);
  if (cached) return cached;

  const iconSvg = getCacheIconSvg(type);
  const color = getCacheColor(type);

  let icon: L.DivIcon;

  if (iconTheme === 'adventure') {
    const adventureColors = {
      background: '#6495ED',
      border: '#4169E1',
      icon: '#FFFFFF',
    };

    icon = L.divIcon({
      html: `
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
      `,
      className: "custom-cache-icon adventure-cache-icon adventure-quest-marker",
      iconSize: [36, 42],
      iconAnchor: [18, 42],
      popupAnchor: [0, -42],
    });
  } else if (iconTheme === 'mojave') {
    // Pip-Boy CRT marker: amber outline glyph on a near-black terminal panel,
    // with an amber phosphor glow and an amber-tipped pointer tail.
    const mojaveColors = {
      background: '#0f0a05',   // CRT off-state
      border: '#c48f2a',       // Amber border
      icon: '#e8a838',         // Pip-Boy amber
      glow: 'rgba(232, 168, 56, 0.45)',
    };

    icon = L.divIcon({
      html: `
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
      `,
      className: "custom-cache-icon mojave-cache-icon",
      iconSize: [36, 42],
      iconAnchor: [18, 42],
      popupAnchor: [0, -42],
    });
  } else {
    icon = L.divIcon({
      html: `
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
      `,
      className: "custom-cache-icon",
      iconSize: [40, 48],
      iconAnchor: [20, 48],
      popupAnchor: [0, -48],
    });
  }

  iconCache.set(key, icon);
  return icon;
}

/** Map a map-style key to its marker theme. Convenience for callers. */
export function mapStyleToIconTheme(mapStyle: string): MapIconTheme {
  if (mapStyle === 'adventure') return 'adventure';
  if (mapStyle === 'mojave') return 'mojave';
  return 'default';
}
