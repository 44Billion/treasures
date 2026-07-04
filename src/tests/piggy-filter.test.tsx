/**
 * Tests for the "Lightning Piggy" (source) filter.
 *
 * Contract:
 *  - `useAdaptiveReliableGeocaches({ piggyOnly: true })` returns only
 *    treasures whose `client` tag identifies Lightning Piggy (matching is
 *    case/separator-insensitive via `isLightningPiggyClient`).
 *  - When the flag is off/omitted, all treasures pass through unchanged.
 *  - `FilterButton` exposes "Source" chips ("Treasures" default, "Lightning
 *    Piggy") that report changes via `onShowPiggyOnlyChange`, count toward
 *    the active-filter badge, and are reset by "Clear all".
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import { useAdaptiveReliableGeocaches } from '@/hooks/useReliableProximitySearch';
import { FilterButton } from '@/components/FilterButton';
import i18n from '@/lib/i18n';
import type { Geocache } from '@/types/geocache';

vi.mock('@/stores/hooks', () => ({
  useGeocacheStoreContext: () => ({
    fetchGeocaches: vi.fn().mockResolvedValue({ success: true, data: [] }),
  }),
}));

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: null }),
}));

const baseCache: Geocache = {
  id: 'id-plain',
  dTag: 'dtag-plain',
  pubkey: '0000000000000000000000000000000000000000000000000000000000000001',
  name: 'Plain treasure',
  description: 'An ordinary treasure',
  location: { lat: 40.7128, lng: -74.006 },
  difficulty: 1,
  terrain: 1,
  size: 'small',
  type: 'traditional',
  created_at: 1234567890,
} as Geocache;

const testGeocaches: Geocache[] = [
  baseCache,
  {
    ...baseCache,
    id: 'id-piggy',
    dTag: 'dtag-piggy',
    name: 'Piggy treasure',
    client: 'Lightning Piggy',
  },
  {
    ...baseCache,
    id: 'id-piggy-identifier',
    dTag: 'dtag-piggy-identifier',
    name: 'Piggy identifier treasure',
    client: 'com.lightning-piggy.app',
  },
  {
    ...baseCache,
    id: 'id-other-client',
    dTag: 'dtag-other-client',
    name: 'Other client treasure',
    client: 'https://treasures.to',
  },
];

describe('useAdaptiveReliableGeocaches — piggyOnly filter', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it('returns only Lightning Piggy treasures when piggyOnly is true', async () => {
    const { result } = renderHook(
      () => useAdaptiveReliableGeocaches({ baseGeocaches: testGeocaches, piggyOnly: true }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const ids = result.current.data.map((g) => g.id).sort();
    expect(ids).toEqual(['id-piggy', 'id-piggy-identifier']);
  });

  it('returns all treasures when piggyOnly is omitted', async () => {
    const { result } = renderHook(
      () => useAdaptiveReliableGeocaches({ baseGeocaches: testGeocaches }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(testGeocaches.length);
  });
});

describe('FilterButton — Lightning Piggy source filter', () => {
  const noop = () => {};

  function renderFilterButton(overrides: Partial<React.ComponentProps<typeof FilterButton>> = {}) {
    const onShowPiggyOnlyChange = vi.fn();
    render(
      <I18nextProvider i18n={i18n}>
        <FilterButton
          difficultyOperator="all"
          onDifficultyChange={noop}
          onDifficultyOperatorChange={noop}
          terrainOperator="all"
          onTerrainChange={noop}
          onTerrainOperatorChange={noop}
          onCacheTypeChange={noop}
          showPiggyOnly={false}
          onShowPiggyOnlyChange={onShowPiggyOnlyChange}
          {...overrides}
        />
      </I18nextProvider>,
    );
    return { onShowPiggyOnlyChange };
  }

  function openPopover() {
    // The trigger is the only button initially rendered.
    fireEvent.click(screen.getAllByRole('button')[0]);
  }

  it('renders source chips with "Treasures" selected by default', () => {
    renderFilterButton();
    openPopover();

    const treasuresChip = screen.getByRole('button', { name: /Treasures/ });
    const piggyChip = screen.getByRole('button', { name: /Lightning Piggy/ });
    expect(treasuresChip).toHaveAttribute('aria-pressed', 'true');
    expect(piggyChip).toHaveAttribute('aria-pressed', 'false');
  });

  it('reports selecting the Lightning Piggy source chip', () => {
    const { onShowPiggyOnlyChange } = renderFilterButton();
    openPopover();

    fireEvent.click(screen.getByRole('button', { name: /Lightning Piggy/ }));
    expect(onShowPiggyOnlyChange).toHaveBeenCalledWith(true);
  });

  it('reports switching back to the Treasures source chip', () => {
    const { onShowPiggyOnlyChange } = renderFilterButton({ showPiggyOnly: true });
    openPopover();

    fireEvent.click(screen.getByRole('button', { name: /Treasures/ }));
    expect(onShowPiggyOnlyChange).toHaveBeenCalledWith(false);
  });

  it('counts the piggy filter toward the active-filter badge', () => {
    renderFilterButton({ showPiggyOnly: true });
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('resets the piggy filter via Clear all', () => {
    const { onShowPiggyOnlyChange } = renderFilterButton({ showPiggyOnly: true });
    openPopover();

    fireEvent.click(screen.getByText('Clear all'));
    expect(onShowPiggyOnlyChange).toHaveBeenCalledWith(false);
  });

  it('does not render the source section when the handler is absent', () => {
    renderFilterButton({ onShowPiggyOnlyChange: undefined });
    openPopover();

    expect(screen.queryByText('Lightning Piggy')).not.toBeInTheDocument();
    expect(screen.queryByText('Source')).not.toBeInTheDocument();
  });
});
