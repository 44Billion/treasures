import { useEffect, useRef, useState } from 'react';
import { useGeocacheStoreContext } from '@/stores/hooks';
import {
  geohashesForBounds,
  geohashPrecisionForZoom,
  type GeoBounds,
} from '@/utils/geo';

/** Current map viewport, supplied by the Map page on pan/zoom settle. */
export interface Viewport {
  bounds: GeoBounds;
  zoom: number;
}

interface UseViewportGeocachesOptions {
  /** Debounce delay (ms) before querying after the viewport settles. */
  debounceMs?: number;
  /** When false, viewport querying is disabled (e.g. while a search is active). */
  enabled?: boolean;
}

/**
 * Viewport-aware local discovery for the map.
 *
 * Whenever the map viewport settles (debounced), this computes the geohash
 * prefixes covering the visible area at a precision appropriate for the zoom
 * level, then asks the geocache store to fetch any treasures with matching
 * `g` tags and merge them into the shared list cache.
 *
 * This fixes the "missing local discovery" gap: previously the map only ever
 * showed the globally-paginated newest treasures, so older or far-flung caches
 * in the area the user was actually looking at never appeared. Now panning to a
 * region pulls that region's treasures directly from relays.
 *
 * Results are merged into the store (no separate list), so cards, markers, and
 * the result count all benefit automatically.
 *
 * @param viewport The current map viewport, or null when unknown.
 */
export function useViewportGeocaches(
  viewport: Viewport | null,
  options: UseViewportGeocachesOptions = {},
) {
  const { debounceMs = 600, enabled = true } = options;
  const geocacheStore = useGeocacheStoreContext();

  // Track which prefix sets we've already fetched so panning back over an
  // already-loaded area doesn't re-hit relays.
  const fetchedKeysRef = useRef<Set<string>>(new Set());
  const [isFetching, setIsFetching] = useState(false);

  useEffect(() => {
    if (!enabled || !viewport) return;

    const precision = geohashPrecisionForZoom(viewport.zoom);
    if (precision === 0) return; // Too zoomed out — rely on the global list.

    const prefixes = geohashesForBounds(viewport.bounds, precision);
    if (prefixes.length === 0) return; // Whole-world / too-many-cells — skip.

    // Stable key for this prefix set (order-independent).
    const key = `${precision}:${[...prefixes].sort().join(',')}`;
    if (fetchedKeysRef.current.has(key)) return;

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      if (cancelled) return;
      fetchedKeysRef.current.add(key);
      setIsFetching(true);
      try {
        await geocacheStore.fetchGeocachesByGeohash(prefixes);
      } catch {
        // On failure, drop the key so a later pan can retry this region.
        fetchedKeysRef.current.delete(key);
      } finally {
        if (!cancelled) setIsFetching(false);
      }
    }, debounceMs);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [viewport, enabled, debounceMs, geocacheStore]);

  return { isFetching };
}
