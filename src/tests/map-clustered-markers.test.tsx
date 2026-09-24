import { describe, it, expect, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { MapContext } from '@/components/map/mapContext';
import type { LatLng, MapHandle, MarkerOptions } from '@/components/map/mapHandle';
import { createMarkerElement } from '@/components/map/mapMarkers';
import type { MapIcon } from '@/utils/mapIcons';
import { ClusteredMarkers, type ClusterPoint } from '@/components/map/ClusteredMarkers';
import { getCachedCacheIcon } from '@/utils/cacheMapIcons';

interface FakeMarker {
  element: HTMLElement;
  lngLat: [number, number];
}

// Records markers the way a real map handle would place them.
function createFakeMap(initialZoom: number) {
  let zoom = initialZoom;
  const listeners = new Map<string, Set<() => void>>();
  const markers = new Set<FakeMarker>();
  const handle = {
    getZoom: () => zoom,
    setView: vi.fn(),
    on: (event: string, fn: () => void) => {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event)!.add(fn);
    },
    off: (event: string, fn: () => void) => listeners.get(event)?.delete(fn),
    addMarker: (markerIcon: MapIcon, position: LatLng, options?: MarkerOptions) => {
      const marker: FakeMarker = {
        element: createMarkerElement(markerIcon, options),
        lngLat: [position.lng, position.lat],
      };
      markers.add(marker);
      return {
        setPosition: (p: LatLng) => { marker.lngLat = [p.lng, p.lat]; },
        remove: () => { markers.delete(marker); },
      };
    },
  };
  return {
    handle: handle as unknown as MapHandle,
    setView: handle.setView,
    markers: () => [...markers],
    zoomTo(next: number) {
      zoom = next;
      listeners.get('zoomend')?.forEach(fn => fn());
    },
  };
}

const icon = getCachedCacheIcon('traditional', 'default');

// Two treasures ~15m apart, one far away.
const points: ClusterPoint[] = [
  { id: 'a', lat: 40.7128, lng: -74.006, icon, title: 'A' },
  { id: 'b', lat: 40.7129, lng: -74.0061, icon, title: 'B' },
  { id: 'c', lat: 51.5, lng: -0.12, icon, title: 'C' },
];

function renderMarkers(map: ReturnType<typeof createFakeMap>, onPointClick = vi.fn()) {
  render(
    <MapContext.Provider value={map.handle}>
      <ClusteredMarkers points={points} onPointClick={onPointClick} />
    </MapContext.Provider>,
  );
  return onPointClick;
}

describe('ClusteredMarkers', () => {
  it('clusters nearby treasures at low zoom', () => {
    const map = createFakeMap(10);
    renderMarkers(map);

    const markers = map.markers();
    expect(markers).toHaveLength(2);
    const cluster = markers.find(m => m.element.classList.contains('custom-cluster-icon'));
    expect(cluster?.element.textContent).toBe('2');
    expect(markers.some(m => m.element.title === 'C')).toBe(true);
  });

  it('shows every treasure individually from the disable-clustering zoom', () => {
    const map = createFakeMap(10);
    renderMarkers(map);

    act(() => map.zoomTo(14));

    const titles = map.markers().map(m => m.element.title).sort();
    expect(titles).toEqual(['A', 'B', 'C']);
  });

  it('keeps the DOM element of a marker that stays visible across zooms', () => {
    const map = createFakeMap(14);
    renderMarkers(map);
    const before = map.markers().find(m => m.element.title === 'C')!.element;

    act(() => map.zoomTo(15));

    expect(map.markers().find(m => m.element.title === 'C')!.element).toBe(before);
  });

  it('reports point clicks and zooms into clusters', () => {
    const map = createFakeMap(10);
    const onPointClick = renderMarkers(map);

    map.markers().find(m => m.element.title === 'C')!.element.click();
    expect(onPointClick).toHaveBeenCalledWith(expect.objectContaining({ id: 'c' }));

    map.markers().find(m => m.element.classList.contains('custom-cluster-icon'))!.element.click();
    expect(map.setView).toHaveBeenCalledTimes(1);
    const [, zoom] = map.setView.mock.calls[0]!;
    expect(zoom).toBeGreaterThan(10);
  });

  it('places the icon anchor on the coordinate', () => {
    const map = createFakeMap(14);
    renderMarkers(map);
    const marker = map.markers().find(m => m.element.title === 'C')!;
    expect(marker.lngLat).toEqual([-0.12, 51.5]);
    expect(marker.element.style.width).toBe(`${icon.iconSize[0]}px`);
  });
});
