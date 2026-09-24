import { describe, it, expect } from 'vitest';
import type { TransformStyleFunction } from 'maplibre-gl';
import {
  parseColor,
  filterColor,
  applyColorFilterToStyle,
  buildRasterStyle,
  declutterStyle,
} from '@/lib/mapStyleLoader';
import { MAP_STYLES, HIDDEN_STYLE_LAYERS, rasterTileUrl, type ColorFilterOp } from '@/config/mapStyles';
import { MapBounds, toGlZoom, fromGlZoom } from '@/components/map/mapHandle';

type StyleSpecification = ReturnType<TransformStyleFunction>;

describe('parseColor', () => {
  it('parses the color formats used by the OpenFreeMap styles', () => {
    expect(parseColor('#fff')).toEqual([255, 255, 255, 1]);
    expect(parseColor('#0a0b0c')).toEqual([10, 11, 12, 1]);
    expect(parseColor('rgb(1, 2, 3)')).toEqual([1, 2, 3, 1]);
    expect(parseColor('rgba(1,2,3,0.5)')).toEqual([1, 2, 3, 0.5]);
    const hsl = parseColor('hsl(0, 100%, 50%)')!;
    expect(hsl.map(Math.round)).toEqual([255, 0, 0, 1]);
    expect(parseColor('hsla(120, 100%, 25%, 0.25)')!.map(v => Math.round(v * 100) / 100)).toEqual([0, 127.5, 0, 0.25]);
  });

  it('rejects non-color strings such as expression operators and match labels', () => {
    expect(parseColor('interpolate')).toBeNull();
    expect(parseColor('motorway')).toBeNull();
    expect(parseColor('#zzz')).toBeNull();
  });
});

describe('filterColor', () => {
  it('matches the CSS sepia(1) matrix', () => {
    // sepia(1) on mid grey: each channel = 128/255 × row sum of the sepia matrix
    expect(filterColor('#808080', [{ op: 'sepia', amount: 1 }]))
      .toBe('rgba(173, 154, 120, 1)');
  });

  it('keeps black black and preserves alpha through the Mojave chain', () => {
    const mojave = MAP_STYLES.mojave!.source;
    expect(mojave.type).toBe('vector');
    const filter = (mojave as { colorFilter: ColorFilterOp[] }).colorFilter;
    expect(filterColor('rgba(0, 0, 0, 0.4)', filter)).toBe('rgba(0, 0, 0, 0.4)');
  });

  it('turns bright features amber under the Mojave chain', () => {
    const filter = (MAP_STYLES.mojave!.source as { colorFilter: ColorFilterOp[] }).colorFilter;
    const [r, g, b] = parseColor(filterColor('#9a9a9a', filter))!;
    expect(r).toBeGreaterThan(g);
    expect(g).toBeGreaterThan(b);
  });

  it('passes non-colors through unchanged', () => {
    expect(filterColor('zoom', [{ op: 'sepia', amount: 1 }])).toBe('zoom');
  });
});

describe('applyColorFilterToStyle', () => {
  const style: StyleSpecification = {
    version: 8,
    sources: {},
    layers: [
      { id: 'bg', type: 'background', paint: { 'background-color': '#808080' } },
      {
        id: 'roads',
        type: 'line',
        source: 'x',
        paint: {
          'line-color': ['match', ['get', 'class'], 'motorway', '#808080', '#000'],
          'line-width': 2,
        },
      },
      { id: 'no-paint', type: 'symbol', source: 'x', layout: { 'text-field': '{name}' } },
    ],
  } as StyleSpecification;

  it('retints color literals inside expressions and leaves everything else alone', () => {
    const result = applyColorFilterToStyle(style, [{ op: 'sepia', amount: 1 }]);
    const [bg, roads, noPaint] = result.layers as Array<{ paint?: Record<string, unknown> }>;
    expect(bg!.paint!['background-color']).toBe('rgba(173, 154, 120, 1)');
    expect(roads!.paint!['line-color']).toEqual([
      'match', ['get', 'class'], 'motorway', 'rgba(173, 154, 120, 1)', 'rgba(0, 0, 0, 1)',
    ]);
    expect(roads!.paint!['line-width']).toBe(2);
    expect(noPaint).toBe(style.layers[2]);
  });

  it('does not mutate the input style', () => {
    applyColorFilterToStyle(style, [{ op: 'sepia', amount: 1 }]);
    expect((style.layers[0] as { paint: Record<string, unknown> }).paint['background-color']).toBe('#808080');
  });
});

describe('buildRasterStyle', () => {
  it('wraps the satellite provider in a single raster layer', () => {
    const source = MAP_STYLES.satellite!.source;
    if (source.type !== 'raster') throw new Error('satellite should be raster');
    const style = buildRasterStyle(source);
    expect(style.layers).toEqual([{ id: 'raster', type: 'raster', source: 'raster' }]);
    expect(style.sources.raster).toMatchObject({ type: 'raster', tileSize: 256, maxzoom: 19 });
  });
});

describe('map zoom units', () => {
  it('converts between 256px-tile zooms and MapLibre zooms', () => {
    expect(toGlZoom(17)).toBe(16);
    expect(fromGlZoom(16)).toBe(17);
  });
});

describe('MapBounds', () => {
  it('builds from points and pads on every side', () => {
    const bounds = MapBounds.fromPoints([{ lat: 10, lng: 20 }, [20, 40]]);
    expect(bounds.getSouthWest()).toEqual({ lat: 10, lng: 20 });
    expect(bounds.getNorthEast()).toEqual({ lat: 20, lng: 40 });
    expect(bounds.getCenter()).toEqual({ lat: 15, lng: 30 });

    const padded = bounds.pad(0.1);
    expect(padded.getSouth()).toBeCloseTo(9);
    expect(padded.getNorth()).toBeCloseTo(21);
    expect(padded.getWest()).toBeCloseTo(18);
    expect(padded.getEast()).toBeCloseTo(42);
  });
});

describe('declutterStyle', () => {
  it('drops POIs and state labels but keeps place names and road info', () => {
    const style = {
      version: 8,
      sources: {},
      layers: ['road_shield_us', 'road_one_way_arrow', 'poi_r1', 'label_state', 'place_state', 'label_city', 'highway-name-major']
        .map(id => ({ id, type: 'symbol', source: 'openmaptiles' })),
    } as unknown as StyleSpecification;

    expect(declutterStyle(style).layers.map(l => l.id))
      .toEqual(['road_shield_us', 'road_one_way_arrow', 'label_city', 'highway-name-major']);
    expect(HIDDEN_STYLE_LAYERS.has('label_city')).toBe(false);
  });
});

describe('rasterTileUrl', () => {
  it('serves tiles straight from the tile server without a proxy', () => {
    expect(rasterTileUrl('dark')).toBe('https://maps.dreamith.to/raster/dark/{z}/{x}/{y}{r}.png');
  });

  it('routes tiles through the image proxy, keeping Leaflet placeholders intact', () => {
    const tile = 'https://maps.dreamith.to/raster/liberty/{z}/{x}/{y}{r}.png';
    expect(rasterTileUrl('liberty', 'https://wsrv.nl/'))
      .toBe(`https://wsrv.nl/?url=${tile}&maxage=1d&default=${tile}`);
  });
});
