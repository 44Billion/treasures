/**
 * Turns a `MapStyle` config entry into something MapLibre can render:
 * vector styles load by URL (optionally retinted with a color filter), raster
 * providers are wrapped in a minimal single-layer style.
 */

import type { Map as MapLibreMap, TransformStyleFunction } from 'maplibre-gl';
import { HIDDEN_STYLE_LAYERS, mapStyleUrl, type ColorFilterOp, type MapStyle } from '@/config/mapStyles';

type StyleSpecification = ReturnType<TransformStyleFunction>;

type Rgba = [number, number, number, number];
type Matrix3 = [number, number, number, number, number, number, number, number, number];

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Parse the color formats used by the OpenFreeMap styles: hex, rgb[a](), hsl[a](). */
export function parseColor(value: string): Rgba | null {
  const s = value.trim().toLowerCase();

  if (s.startsWith('#')) {
    const hex = s.slice(1);
    if (!/^[0-9a-f]+$/.test(hex)) return null;
    if (hex.length === 3 || hex.length === 4) {
      const [r, g, b, a = 'ff'] = hex.split('').map(c => c + c) as string[];
      return [parseInt(r!, 16), parseInt(g!, 16), parseInt(b!, 16), parseInt(a!, 16) / 255];
    }
    if (hex.length === 6 || hex.length === 8) {
      const a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1;
      return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16), a];
    }
    return null;
  }

  const fn = /^(rgba?|hsla?)\(([^)]*)\)$/.exec(s);
  if (!fn) return null;
  const parts = fn[2]!.split(/[\s,/]+/).filter(Boolean);
  if (parts.length < 3) return null;
  const alpha = parts[3] !== undefined ? parseAlpha(parts[3]) : 1;

  if (fn[1]!.startsWith('rgb')) {
    const [r, g, b] = parts.slice(0, 3).map(p => p.endsWith('%') ? parseFloat(p) * 2.55 : parseFloat(p));
    if ([r, g, b, alpha].some(n => !Number.isFinite(n))) return null;
    return [r!, g!, b!, alpha];
  }

  const h = parseFloat(parts[0]!);
  const sat = parseFloat(parts[1]!) / 100;
  const light = parseFloat(parts[2]!) / 100;
  if ([h, sat, light, alpha].some(n => !Number.isFinite(n))) return null;
  return [...hslToRgb(h, sat, light), alpha];
}

function parseAlpha(p: string): number {
  return p.endsWith('%') ? parseFloat(p) / 100 : parseFloat(p);
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0) * 255, f(8) * 255, f(4) * 255];
}

// Matrices from the Filter Effects spec, so a filter chain here renders the
// same as the equivalent CSS `filter:` shorthand did on the old raster tiles.
function filterMatrix(op: ColorFilterOp): Matrix3 {
  switch (op.op) {
    case 'sepia': {
      const a = 1 - clamp01(op.amount);
      return [
        0.393 + 0.607 * a, 0.769 - 0.769 * a, 0.189 - 0.189 * a,
        0.349 - 0.349 * a, 0.686 + 0.314 * a, 0.168 - 0.168 * a,
        0.272 - 0.272 * a, 0.534 - 0.534 * a, 0.131 + 0.869 * a,
      ];
    }
    case 'saturate': {
      const s = op.amount;
      return [
        0.213 + 0.787 * s, 0.715 - 0.715 * s, 0.072 - 0.072 * s,
        0.213 - 0.213 * s, 0.715 + 0.285 * s, 0.072 - 0.072 * s,
        0.213 - 0.213 * s, 0.715 - 0.715 * s, 0.072 + 0.928 * s,
      ];
    }
    case 'hue-rotate': {
      const rad = (op.deg * Math.PI) / 180;
      const c = Math.cos(rad);
      const s = Math.sin(rad);
      return [
        0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928,
        0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.140, 0.072 - c * 0.072 - s * 0.283,
        0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072,
      ];
    }
    case 'brightness': {
      const b = op.amount;
      return [b, 0, 0, 0, b, 0, 0, 0, b];
    }
  }
}

/** Apply a filter chain to one color string. Non-color strings are returned unchanged. */
export function filterColor(value: string, filter: ColorFilterOp[]): string {
  const rgba = parseColor(value);
  if (!rgba) return value;

  let [r, g, b] = [rgba[0] / 255, rgba[1] / 255, rgba[2] / 255];
  for (const op of filter) {
    const m = filterMatrix(op);
    [r, g, b] = [
      clamp01(m[0] * r + m[1] * g + m[2] * b),
      clamp01(m[3] * r + m[4] * g + m[5] * b),
      clamp01(m[6] * r + m[7] * g + m[8] * b),
    ];
  }

  const to255 = (v: number) => Math.round(v * 255);
  return `rgba(${to255(r)}, ${to255(g)}, ${to255(b)}, ${Number(rgba[3].toFixed(3))})`;
}

/**
 * Walk a paint value (a literal or an expression) and retint every color
 * literal in it. Expression operators and match labels never parse as colors,
 * so they pass through untouched.
 */
function filterPaintValue(value: unknown, filter: ColorFilterOp[]): unknown {
  if (typeof value === 'string') return filterColor(value, filter);
  if (Array.isArray(value)) return value.map(v => filterPaintValue(v, filter));
  if (value && typeof value === 'object') {
    // Legacy function syntax: { stops: [[zoom, color], ...] }
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, filterPaintValue(v, filter)]),
    );
  }
  return value;
}

/** Return a copy of `style` with every `*-color` paint property passed through `filter`. */
export function applyColorFilterToStyle(style: StyleSpecification, filter: ColorFilterOp[]): StyleSpecification {
  return {
    ...style,
    layers: style.layers.map(layer => {
      if (!('paint' in layer) || !layer.paint) return layer;
      const paint = Object.fromEntries(
        Object.entries(layer.paint).map(([prop, value]) =>
          prop.endsWith('-color') ? [prop, filterPaintValue(value, filter)] : [prop, value],
        ),
      );
      return { ...layer, paint } as typeof layer;
    }),
  };
}

/** Drop the `HIDDEN_STYLE_LAYERS` (label/icon clutter) from a style. */
export function declutterStyle(style: StyleSpecification): StyleSpecification {
  return { ...style, layers: style.layers.filter(layer => !HIDDEN_STYLE_LAYERS.has(layer.id)) };
}

/** Minimal style wrapping a raster XYZ tile provider. */
export function buildRasterStyle(source: Extract<MapStyle['source'], { type: 'raster' }>): StyleSpecification {
  return {
    version: 8,
    sources: {
      raster: {
        type: 'raster',
        tiles: source.tiles,
        tileSize: source.tileSize,
        maxzoom: source.maxzoom,
        attribution: source.attribution,
      },
    },
    layers: [{ id: 'raster', type: 'raster', source: 'raster' }],
  };
}

/**
 * Load `mapStyle` into the map, replacing the current style. Vector styles
 * come from `tilesUrl`, an OpenFreeMap-compatible server.
 */
export function applyMapStyle(map: MapLibreMap, mapStyle: MapStyle, tilesUrl: string): void {
  const { source } = mapStyle;
  if (source.type === 'raster') {
    map.setStyle(buildRasterStyle(source), { diff: false });
    return;
  }
  const filter = source.colorFilter;
  map.setStyle(mapStyleUrl(tilesUrl, source.style), {
    diff: false,
    transformStyle: (_previous, next) => {
      const decluttered = declutterStyle(next);
      return filter ? applyColorFilterToStyle(decluttered, filter) : decluttered;
    },
  });
}
