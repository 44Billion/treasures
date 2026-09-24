import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/lib/i18n';
import { MapView } from '@/components/map/MapView';
import { MAP_STYLES } from '@/config/mapStyles';
import { AppContext, type AppConfig } from '@/contexts/AppContext';

// A failure that isn't about WebGL support (e.g. the worker didn't load).
vi.mock('maplibre-gl', async (importOriginal) => ({
  ...(await importOriginal<typeof import('maplibre-gl')>()),
  Map: class {
    constructor() {
      throw new Error('Failed to fetch worker script (404)');
    }
  },
}));

describe('MapView failure notice', () => {
  it('reports errors other than missing WebGL as a load failure with the reason', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    render(
      <I18nextProvider i18n={i18n}>
        <AppContext.Provider value={{ config: { mapTilesUrl: '' } as AppConfig, updateConfig: () => {} }}>
          <MapView center={[40.7, -74]} zoom={10} mapStyle={MAP_STYLES.original!} />
        </AppContext.Provider>
      </I18nextProvider>,
    );

    expect(screen.getByText('The map failed to load.')).toBeInTheDocument();
    expect(screen.getByText('Failed to fetch worker script (404)')).toBeInTheDocument();
    expect(screen.queryByText(/WebGL is unavailable/)).not.toBeInTheDocument();
    // No list action unless the page offers one
    expect(screen.queryByRole('button', { name: /show list/i })).not.toBeInTheDocument();
  });
});
