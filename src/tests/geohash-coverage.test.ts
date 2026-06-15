import { describe, it, expect } from 'vitest';
import {
  geohashesForBounds,
  geohashPrecisionForZoom,
  type GeoBounds,
} from '@/utils/geo';
import { encodeGeohash } from '@/utils/nip-gc';

describe('geohashPrecisionForZoom', () => {
  it('returns 0 (no filter) for world / continental zoom', () => {
    expect(geohashPrecisionForZoom(1)).toBe(0);
    expect(geohashPrecisionForZoom(4)).toBe(0);
  });

  it('returns coarse precision for regional zoom', () => {
    expect(geohashPrecisionForZoom(5)).toBe(3);
    expect(geohashPrecisionForZoom(7)).toBe(3);
  });

  it('returns medium precision for metro zoom', () => {
    expect(geohashPrecisionForZoom(8)).toBe(4);
    expect(geohashPrecisionForZoom(10)).toBe(4);
  });

  it('caps at precision 4 for close zoom (so every cache matches)', () => {
    expect(geohashPrecisionForZoom(11)).toBe(4);
    expect(geohashPrecisionForZoom(18)).toBe(4);
  });
});

describe('geohashesForBounds', () => {
  it('returns empty for the whole world (>= 360° span)', () => {
    const world: GeoBounds = { south: -90, west: -200, north: 90, east: 200 };
    expect(geohashesForBounds(world, 5)).toEqual([]);
  });

  it('returns empty for precision below 1', () => {
    const b: GeoBounds = { south: 0, west: 0, north: 1, east: 1 };
    expect(geohashesForBounds(b, 0)).toEqual([]);
  });

  it('clamps precision above 9 to 9', () => {
    const b: GeoBounds = { south: 0, west: 0, north: 0.0001, east: 0.0001 };
    const prefixes = geohashesForBounds(b, 10, 200, 9);
    expect(prefixes.length).toBeGreaterThan(0);
    expect(prefixes[0]!).toHaveLength(9);
  });

  it('covers a small bounding box and includes the center cell', () => {
    // A small box around Berlin (~52.52, 13.405).
    const bounds: GeoBounds = {
      south: 52.5,
      west: 13.38,
      north: 52.54,
      east: 13.43,
    };
    const precision = 5;
    const prefixes = geohashesForBounds(bounds, precision);

    expect(prefixes.length).toBeGreaterThan(0);
    // The geohash of the center point must be among the covering cells.
    const center = encodeGeohash(52.52, 13.405, precision);
    expect(prefixes).toContain(center);
    // All returned prefixes should be at the requested precision.
    for (const p of prefixes) {
      expect(p).toHaveLength(precision);
    }
  });

  it('every corner of the box is covered by some returned cell', () => {
    const bounds: GeoBounds = {
      south: 40.0,
      west: -74.1,
      north: 40.1,
      east: -73.9,
    };
    const precision = 5;
    const prefixes = new Set(geohashesForBounds(bounds, precision));

    const corners = [
      [bounds.south, bounds.west],
      [bounds.south, bounds.east],
      [bounds.north, bounds.west],
      [bounds.north, bounds.east],
    ] as const;

    for (const [lat, lng] of corners) {
      expect(prefixes.has(encodeGeohash(lat, lng, precision))).toBe(true);
    }
  });

  it('steps down to a coarser precision instead of returning empty when over maxCells', () => {
    // A wide box that would need many cells at precision 5 must NOT return empty;
    // it should fall back to a coarser precision that still covers the area.
    const bounds: GeoBounds = { south: 0, west: 0, north: 10, east: 10 };
    const prefixes = geohashesForBounds(bounds, 5, 16);
    expect(prefixes.length).toBeGreaterThan(0);
    // Coarser than requested (precision < 5), and never below the floor of 3.
    const len = prefixes[0]!.length;
    expect(len).toBeLessThan(5);
    expect(len).toBeGreaterThanOrEqual(3);
  });

  it('never steps below the precision floor (caches do not store coarser tags)', () => {
    // Even an enormous box keeps precision >= 3 (the coarsest tag caches store).
    const bounds: GeoBounds = { south: -40, west: -120, north: 40, east: 120 };
    const prefixes = geohashesForBounds(bounds, 4);
    expect(prefixes.length).toBeGreaterThan(0);
    for (const p of prefixes) {
      expect(p.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('covers a whole U.S. state (Texas) at precision 3 including its major cities', () => {
    // Regression: a statewide view used to exceed the cell cap and return [],
    // so no treasures were ever fetched for the area the user was looking at.
    const texas: GeoBounds = { south: 26, west: -106.5, north: 36.5, east: -93.5 };
    const prefixes = new Set(geohashesForBounds(texas, geohashPrecisionForZoom(6)));

    expect(prefixes.size).toBeGreaterThan(0);
    // Austin (9v6), Dallas (9vg), Houston (9vk) at precision 3 must be covered.
    expect(prefixes.has(encodeGeohash(30.27, -97.74, 3))).toBe(true);
    expect(prefixes.has(encodeGeohash(32.78, -96.8, 3))).toBe(true);
    expect(prefixes.has(encodeGeohash(29.76, -95.37, 3))).toBe(true);
  });

  it('handles longitude wrap by normalizing into [-180, 180)', () => {
    // Box centered on the antimeridian, expressed with wrapped longitudes.
    const bounds: GeoBounds = {
      south: 0,
      west: 179.9,
      north: 0.05,
      east: 180.1,
    };
    const prefixes = geohashesForBounds(bounds, 4);
    // Should not throw and should produce valid geohashes.
    expect(prefixes.length).toBeGreaterThan(0);
    for (const p of prefixes) {
      expect(p).toMatch(/^[0-9bcdefghjkmnpqrstuvwxyz]+$/);
    }
  });
});
