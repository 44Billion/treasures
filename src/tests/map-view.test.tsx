import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/lib/i18n';
import { MapView } from '@/components/map/MapView';
import { MapMarker } from '@/components/map/MapMarker';
import { useMapHandle } from '@/components/map/mapContext';
import { MAP_STYLES } from '@/config/mapStyles';
import { AppContext, type AppConfig } from '@/contexts/AppContext';
import { getCachedCacheIcon } from '@/utils/cacheMapIcons';

function MapKind() {
  const map = useMapHandle();
  return <span data-testid="map-kind">{map.kind}</span>;
}

describe('MapView', () => {
  it('falls back to the raster map when WebGL2 is unavailable', async () => {
    // jsdom has no WebGL, so MapLibre can't create its context.
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const onLoad = vi.fn();
    const onUnavailable = vi.fn();

    const { container } = render(
      <I18nextProvider i18n={i18n}>
        <AppContext.Provider value={{ config: { mapTilesUrl: '' } as AppConfig, updateConfig: () => {} }}>
          <div style={{ height: 400 }}>
            <MapView
              center={[40.7, -74]}
              zoom={10}
              mapStyle={MAP_STYLES.original!}
              onLoad={onLoad}
              onUnavailable={onUnavailable}
            >
              <MapKind />
              <MapMarker position={{ lat: 40.7, lng: -74 }} icon={getCachedCacheIcon('traditional', 'default')} title="Chest" />
            </MapView>
          </div>
        </AppContext.Provider>
      </I18nextProvider>,
    );

    // Leaflet is loaded on demand, which can take a while under a busy test run
    await waitFor(() => expect(screen.getByTestId('map-kind')).toHaveTextContent('raster'), { timeout: 5000 });
    expect(onLoad).toHaveBeenCalledTimes(1);
    expect(onUnavailable).not.toHaveBeenCalled();

    const map = container.querySelector('.treasure-map');
    expect(map).toHaveClass('leaflet-container');
    // Server-rendered tiles of the same style
    await waitFor(() => {
      const tile = map!.querySelector<HTMLImageElement>('img.leaflet-tile');
      expect(tile?.src).toMatch(/^https:\/\/maps\.dreamith\.to\/raster\/liberty\/10\/\d+\/\d+\.png$/);
    }, { timeout: 5000 });
    // Markers use the same element as on the vector map
    expect(screen.getByRole('button', { name: 'Chest' })).toHaveClass('custom-cache-icon');
  });
});
