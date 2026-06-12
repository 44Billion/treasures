/**
 * Render tests for the lightning bolt modifier badge.
 *
 * Contract:
 *  - compact size (cards, map popup rows): bolt-only, no inline label —
 *    "tl;dr: lightning".
 *  - default size (cache detail page): bolt + "Lightning" label for a little
 *    more context.
 *  - both sizes: a tooltip explains the Lightning payout. On touch devices
 *    hover doesn't exist, so clicking/tapping the badge opens the tooltip
 *    too (without bubbling to the surrounding card's navigation handler).
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ModifierBadges, LightningBadge } from '@/components/ModifierBadges';
import i18n from '@/lib/i18n';

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <I18nextProvider i18n={i18n}>
      <TooltipProvider>{ui}</TooltipProvider>
    </I18nextProvider>,
  );
}

describe('ModifierBadges — lightning', () => {
  it('renders a bolt-only badge at compact size (cards/popups)', () => {
    renderWithProviders(
      <ModifierBadges cache={{ lightningEnabled: true }} size="compact" />,
    );
    const badge = screen.getByLabelText('Lightning');
    expect(badge).toBeInTheDocument();
    expect(badge).not.toHaveTextContent('Lightning');
  });

  it('renders bolt + label at default size (detail page)', () => {
    renderWithProviders(
      <ModifierBadges cache={{ lightningEnabled: true }} />,
    );
    expect(screen.getByLabelText('Lightning')).toHaveTextContent('Lightning');
  });

  it('renders nothing when the treasure is not lightning-enabled', () => {
    const { container } = renderWithProviders(
      <ModifierBadges cache={{}} size="compact" />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('coexists with other modifier badges', () => {
    renderWithProviders(
      <ModifierBadges
        cache={{ lightningEnabled: true, modifiers: ['art'] }}
        size="compact"
      />,
    );
    expect(screen.getByLabelText('Lightning')).toBeInTheDocument();
    expect(screen.getByText('Art')).toBeInTheDocument();
  });

  it('skips kinds listed in exclude (popup renders the bolt in its D/T row itself)', () => {
    renderWithProviders(
      <ModifierBadges
        cache={{ lightningEnabled: true, modifiers: ['art'] }}
        size="compact"
        exclude={['lightning']}
      />,
    );
    expect(screen.queryByLabelText('Lightning')).not.toBeInTheDocument();
    expect(screen.getByText('Art')).toBeInTheDocument();
  });
});

describe('LightningBadge — tooltip interaction', () => {
  it('opens the payout explanation on click (touch fallback)', async () => {
    renderWithProviders(<LightningBadge size="compact" />);
    fireEvent.click(screen.getByLabelText('Lightning'));
    const explanations = await screen.findAllByText(
      'Pays out bitcoin over the Lightning Network when found.',
    );
    expect(explanations.length).toBeGreaterThan(0);
  });

  it('does not bubble the click to surrounding card navigation', () => {
    const onCardClick = vi.fn();
    renderWithProviders(
      <div onClick={onCardClick}>
        <LightningBadge size="compact" />
      </div>,
    );
    fireEvent.click(screen.getByLabelText('Lightning'));
    expect(onCardClick).not.toHaveBeenCalled();
  });
});
