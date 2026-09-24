import React from 'react';
import { Map, Moon, Satellite, Sword, Mountain } from "lucide-react";

/**
 * App-default map tile server: a self-hosted OpenFreeMap instance serving
 * vector tiles, styles, fonts and sprites. Users can point the app at any
 * OpenFreeMap-compatible server instead (Settings → Map tiles, synced
 * cross-device); see `AppConfig.mapTilesUrl`.
 */
export const DEFAULT_MAP_TILES_URL = 'https://maps.dreamith.to';

/**
 * Normalize a user-entered tile server URL: trim, default to https, drop the
 * trailing slash. Returns null unless it's a valid https URL (the app's CSP
 * only allows https connections).
 */
export function normalizeMapTilesUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
    if (url.protocol !== 'https:' || url.search || url.hash) return null;
    return `${url.origin}${url.pathname}`.replace(/\/+$/, '');
  } catch {
    return null;
  }
}

/** The tile server to use for a configured value ('' or invalid = app default). */
export function resolveMapTilesUrl(configured: string | undefined): string {
  return (configured && normalizeMapTilesUrl(configured)) || DEFAULT_MAP_TILES_URL;
}

/** URL of one of the stock OpenFreeMap styles on a tile server. */
export function mapStyleUrl(tilesUrl: string, style: OpenFreeMapStyle): string {
  return `${tilesUrl}/styles/${style}`;
}

/**
 * Server-rendered PNG tiles of the same styles, for browsers without WebGL2.
 * `/raster/` is a Treasures addition (tileserver-gl) to the app-default tile
 * server, not part of OpenFreeMap, so custom tile servers don't provide it and
 * the fallback always uses the default server.
 */
export const RASTER_TILES_URL = DEFAULT_MAP_TILES_URL;

/**
 * Leaflet tile URL template (`{r}` = `@2x` on high-DPI screens). With an
 * image proxy (the wsrv.nl-compatible `AppConfig.imageProxy`), tiles are
 * fetched through it so its CDN absorbs repeat requests instead of the
 * tile renderer.
 */
export function rasterTileUrl(style: OpenFreeMapStyle, imageProxy = ''): string {
  const tile = `${RASTER_TILES_URL}/raster/${style}/{z}/{x}/{y}{r}.png`;
  if (!imageProxy) return tile;
  // Same proxy and `default=` fallback as getThumbnailUrl, but built by hand:
  // URLSearchParams would encode Leaflet's {z}/{x}/{y} placeholders. No
  // resize/WebP — map labels need the lossless PNG. Tiles are re-rendered
  // from the weekly data, so cache for a day like the tile server does.
  return `${imageProxy.replace(/\/+$/, '')}/?url=${tile}&maxage=1d&default=${tile}`;
}

/**
 * Layers dropped from every vector style to keep the map as calm as the old
 * Carto basemap: POI icons, airport and state labels, and neighbourhood-level
 * place names. Road information (names, route shields, one-way arrows),
 * water, town, city and country names stay.
 *
 * Keep in sync with HIDDEN_LAYERS in the raster tile server's style
 * generator (/opt/tileserver/generate-styles.mjs on the map server), so the
 * fallback map matches.
 */
export const HIDDEN_STYLE_LAYERS: ReadonlySet<string> = new Set([
  // liberty / positron
  'poi_r20',
  'poi_r7',
  'poi_r1',
  'poi_transit',
  'airport',
  'label_state',
  'label_other',
  // dark
  'place_state',
  'place_other',
]);

/** CSS `filter` equivalent of a color filter chain. */
export function colorFilterToCss(filter: ColorFilterOp[]): string {
  return filter.map((f) => {
    switch (f.op) {
      case 'sepia': return `sepia(${f.amount})`;
      case 'hue-rotate': return `hue-rotate(${f.deg}deg)`;
      case 'saturate': return `saturate(${f.amount})`;
      case 'brightness': return `brightness(${f.amount})`;
    }
  }).join(' ');
}

/** Style names every OpenFreeMap-compatible server provides. */
export type OpenFreeMapStyle = 'liberty' | 'dark' | 'positron';

/**
 * A chain of CSS-filter-equivalent color operations, applied in order to every
 * paint color of a vector style. Lets a theme retint a stock style (e.g. the
 * Pip-Boy amber Mojave look) without maintaining a forked style JSON.
 */
export type ColorFilterOp =
  | { op: 'sepia'; amount: number }
  | { op: 'hue-rotate'; deg: number }
  | { op: 'saturate'; amount: number }
  | { op: 'brightness'; amount: number };

export type MapStyleSource =
  | {
      type: 'vector';
      /** Style on the configured OpenFreeMap-compatible tile server */
      style: OpenFreeMapStyle;
      colorFilter?: ColorFilterOp[];
    }
  | {
      type: 'raster';
      tiles: string[];
      tileSize: number;
      /** Highest zoom the tile server provides; MapLibre overzooms past it */
      maxzoom: number;
      attribution: string;
    };

export interface MapStyle {
  key: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  source: MapStyleSource;
}

export const MAP_STYLES: Record<string, MapStyle> = {
  original: {
    key: "original",
    name: "Original",
    description: "Clean, bright cartography",
    icon: React.createElement(Map, { className: "h-4 w-4" }),
    source: { type: 'vector', style: 'liberty' },
  },
  dark: {
    key: "dark",
    name: "Dark Mode",
    description: "Dark theme for night use",
    icon: React.createElement(Moon, { className: "h-4 w-4" }),
    source: { type: 'vector', style: 'dark' },
  },
  satellite: {
    key: "satellite",
    name: "Satellite",
    description: "Aerial imagery view",
    icon: React.createElement(Satellite, { className: "h-4 w-4" }),
    source: {
      type: 'raster',
      tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
      tileSize: 256,
      maxzoom: 19,
      attribution: '&copy; <a href="https://www.esri.com/">Esri</a>, Maxar, Earthstar Geographics',
    },
  },
  adventure: {
    key: "adventure",
    name: "Quest Map",
    description: "For true adventurers",
    icon: React.createElement(Sword, { className: "h-4 w-4" }),
    // Light, low-contrast base; the parchment look comes from the blend-mode
    // overlays rendered by the map components.
    source: { type: 'vector', style: 'positron' },
  },
  mojave: {
    key: "mojave",
    name: "Mojave",
    description: "For wayward couriers",
    icon: React.createElement(Mountain, { className: "h-4 w-4" }),
    // Pip-Boy CRT: the dark style is already dark ground with bright features,
    // so sepia turns the glow brown (by luminance), the hue rotation pushes it
    // toward amber, and the saturation boost makes it read as phosphor. The
    // brightness lift makes up for this style being dimmer than the old raster
    // tiles; it's multiplicative, so the dark ground stays dark.
    source: {
      type: 'vector',
      style: 'dark',
      colorFilter: [
        { op: 'sepia', amount: 1 },
        { op: 'hue-rotate', deg: -25 },
        { op: 'saturate', amount: 3 },
        { op: 'brightness', amount: 1.4 },
      ],
    },
  },
};

export const ADVENTURE_COLORS = {
  primary: '#a0825a', // Bronze
  primaryLight: '#b4966e', // Light bronze
  accent: '#d4af37', // Gold
  background: '#f5f1e8', // Parchment
  text: '#3c2e1f', // Dark brown
  textMuted: '#6b5b3f', // Medium brown
};

export const MOJAVE_COLORS = {
  primary: '#e8a838',       // Pip-Boy amber CRT
  primaryLight: '#f2c266',  // Amber highlight
  accent: '#8b2a1f',        // Legion rust / oxblood
  background: '#d6ccb8',    // Bleached bone
  text: '#2a1810',          // Dried blood
  textMuted: '#5a4a3a',     // Weathered leather
  sage: '#7a8b5a',          // Mesquite sage
};
