import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/lib/i18n';
import { AppContext, type AppConfig } from '@/contexts/AppContext';
import { MapTileSettings } from '@/components/MapTileSettings';
import {
  DEFAULT_MAP_TILES_URL,
  normalizeMapTilesUrl,
  resolveMapTilesUrl,
  mapStyleUrl,
  MAP_STYLES,
} from '@/config/mapStyles';
import { applyMapStyle } from '@/lib/mapStyleLoader';
import type { Map as MapLibreMap } from 'maplibre-gl';

const toast = vi.fn();
vi.mock('@/hooks/useToast', () => ({ useToast: () => ({ toast }) }));

const mutate = vi.fn();
vi.mock('@/hooks/useEncryptedSettings', () => ({
  useEncryptedSettings: () => ({ updateSettings: { mutate } }),
}));

let currentUser: { pubkey: string } | undefined;
vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: currentUser }),
}));

describe('map tile server URLs', () => {
  it('normalizes user input to an https origin + path without trailing slash', () => {
    expect(normalizeMapTilesUrl('tiles.openfreemap.org/')).toBe('https://tiles.openfreemap.org');
    expect(normalizeMapTilesUrl(' https://maps.example.com/ofm/ ')).toBe('https://maps.example.com/ofm');
  });

  it('rejects non-https and malformed URLs', () => {
    expect(normalizeMapTilesUrl('http://maps.example.com')).toBeNull();
    expect(normalizeMapTilesUrl('https://maps.example.com/?key=1')).toBeNull();
    expect(normalizeMapTilesUrl('')).toBeNull();
    expect(normalizeMapTilesUrl('not a url')).toBeNull();
  });

  it('falls back to the app default for empty or invalid config', () => {
    expect(resolveMapTilesUrl('')).toBe(DEFAULT_MAP_TILES_URL);
    expect(resolveMapTilesUrl('http://insecure.example')).toBe(DEFAULT_MAP_TILES_URL);
    expect(resolveMapTilesUrl('https://tiles.openfreemap.org')).toBe('https://tiles.openfreemap.org');
  });

  it('loads vector styles from the configured server', () => {
    const setStyle = vi.fn();
    const map = { setStyle } as unknown as MapLibreMap;

    applyMapStyle(map, MAP_STYLES.mojave!, 'https://tiles.example.org');

    expect(setStyle).toHaveBeenCalledWith(
      mapStyleUrl('https://tiles.example.org', 'dark'),
      expect.objectContaining({ transformStyle: expect.any(Function) }),
    );
  });
});

function renderSettings(initial: Partial<AppConfig> = {}) {
  let latest: AppConfig | null = null;

  function Harness() {
    const [config, setConfig] = useState({ mapTilesUrl: '', ...initial } as AppConfig);
    latest = config;
    return (
      <AppContext.Provider value={{ config, updateConfig: (fn) => setConfig(fn) }}>
        <MapTileSettings />
      </AppContext.Provider>
    );
  }

  render(
    <I18nextProvider i18n={i18n}>
      <Harness />
    </I18nextProvider>,
  );
  return { config: () => latest! };
}

function submit(url: string) {
  fireEvent.change(screen.getByLabelText(/use your own server/i), { target: { value: url } });
  fireEvent.click(screen.getByRole('button', { name: /use server/i }));
}

describe('MapTileSettings', () => {
  beforeEach(() => {
    toast.mockClear();
    mutate.mockClear();
    vi.mocked(global.fetch).mockReset();
    currentUser = undefined;
  });

  it('shows the app default server', () => {
    renderSettings();
    expect(screen.getByText('maps.dreamith.to')).toBeInTheDocument();
    expect(screen.getByText('Default')).toBeInTheDocument();
  });

  it('saves a server that serves OpenFreeMap styles and syncs it when logged in', async () => {
    currentUser = { pubkey: 'abc' };
    vi.mocked(global.fetch).mockResolvedValue(
      new Response(JSON.stringify({ version: 8, sources: {}, layers: [] })),
    );
    const { config } = renderSettings();

    submit('tiles.openfreemap.org');

    await waitFor(() => expect(config().mapTilesUrl).toBe('https://tiles.openfreemap.org'));
    expect(global.fetch).toHaveBeenCalledWith(
      'https://tiles.openfreemap.org/styles/liberty',
      expect.anything(),
    );
    expect(mutate).toHaveBeenCalledWith({ mapTilesUrl: 'https://tiles.openfreemap.org' });
    expect(screen.getByText('tiles.openfreemap.org')).toBeInTheDocument();
  });

  it('does not save a server that fails the style check', async () => {
    vi.mocked(global.fetch).mockResolvedValue(new Response('nope', { status: 404 }));
    const { config } = renderSettings();

    submit('https://wrong.example.com');

    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' })));
    expect(config().mapTilesUrl).toBe('');
    expect(mutate).not.toHaveBeenCalled();
  });

  it('rejects insecure URLs without contacting them', () => {
    const { config } = renderSettings();

    submit('http://maps.example.com');

    expect(global.fetch).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' }));
    expect(config().mapTilesUrl).toBe('');
  });

  it('resets a custom server back to the default', () => {
    currentUser = { pubkey: 'abc' };
    const { config } = renderSettings({ mapTilesUrl: 'https://tiles.openfreemap.org' });

    fireEvent.click(screen.getByRole('button', { name: /reset/i }));

    expect(config().mapTilesUrl).toBe('');
    expect(mutate).toHaveBeenCalledWith({ mapTilesUrl: '' });
  });
});
