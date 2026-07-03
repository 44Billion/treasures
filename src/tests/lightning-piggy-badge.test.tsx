/**
 * Render tests for the Lightning Piggy badge + explainer popover.
 *
 * Contract:
 *  - compact size (map popup rows): pig-only, no inline label.
 *  - default size (cache detail page): pig + "Lightning Piggy" label.
 *  - clicking/tapping the badge opens a popover that briefly explains what
 *    a Lightning Piggy treasure is and offers a "Learn more" button linking
 *    to https://lightningpiggy.com/treasure-hunt/ in a new tab.
 *  - the badge click does not bubble into surrounding card/popup
 *    navigation handlers.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import {
  LightningPiggyBadge,
  LightningPiggyCallout,
  LIGHTNING_PIGGY_TREASURE_HUNT_URL,
} from '@/components/LightningPiggyBadge';
import i18n from '@/lib/i18n';

function renderWithProviders(ui: React.ReactElement) {
  return render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>);
}

describe('LightningPiggyBadge', () => {
  it('renders a pig-only badge at compact size (map popup rows)', () => {
    renderWithProviders(<LightningPiggyBadge size="compact" />);
    const trigger = screen.getByRole('button', { name: 'Lightning Piggy' });
    expect(trigger).toBeInTheDocument();
    expect(trigger.querySelector('.lucide-piggy-bank')).not.toBeNull();
    // Compact: icon only, no inline label text.
    expect(trigger.textContent).toBe('');
  });

  it('renders the label at default size (detail page)', () => {
    renderWithProviders(<LightningPiggyBadge />);
    const trigger = screen.getByRole('button', { name: 'Lightning Piggy' });
    expect(trigger.textContent).toContain('Lightning Piggy');
  });

  it('opens an explainer popover with a learn-more link on click', () => {
    renderWithProviders(<LightningPiggyBadge />);
    fireEvent.click(screen.getByRole('button', { name: 'Lightning Piggy' }));

    expect(screen.getByText('Lightning Piggy treasure')).toBeInTheDocument();
    expect(
      screen.getByText(/bitcoin piggy bank for kids/i),
    ).toBeInTheDocument();

    const link = screen.getByRole('link', { name: /learn more/i });
    expect(link).toHaveAttribute('href', LIGHTNING_PIGGY_TREASURE_HUNT_URL);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });

  it('does not bubble the badge click into surrounding handlers', () => {
    const onOuterClick = vi.fn();
    renderWithProviders(
      <div onClick={onOuterClick}>
        <LightningPiggyBadge size="compact" />
      </div>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Lightning Piggy' }));
    expect(onOuterClick).not.toHaveBeenCalled();
  });
});

describe('LightningPiggyCallout', () => {
  it('renders the one-liner with a directly visible learn-more link', () => {
    const { container } = renderWithProviders(<LightningPiggyCallout />);

    expect(container.querySelector('.lucide-piggy-bank')).not.toBeNull();
    expect(screen.getByText('Lightning Piggy')).toBeInTheDocument();
    expect(screen.getByText(/piggy bank for kids/i)).toBeInTheDocument();

    const link = screen.getByRole('link', { name: /learn more/i });
    expect(link).toHaveAttribute('href', LIGHTNING_PIGGY_TREASURE_HUNT_URL);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });

  it('renders a larger full-bleed strip at default size (detail page)', () => {
    const { container } = renderWithProviders(<LightningPiggyCallout size="default" />);
    const banner = container.firstElementChild as HTMLElement;
    expect(banner.className).toContain('border-y');
    expect(banner.className).not.toContain('rounded');
    expect(banner.className).toContain('px-4');
  });

  it('renders a dense full-bleed strip at compact size (map popup)', () => {
    const { container } = renderWithProviders(<LightningPiggyCallout size="compact" />);
    const banner = container.firstElementChild as HTMLElement;
    expect(banner.className).toContain('border-y');
    expect(banner.className).not.toContain('rounded');
    expect(banner.className).toContain('px-2.5');
  });

  it('does not bubble the learn-more click into surrounding handlers', () => {
    const onOuterClick = vi.fn();
    renderWithProviders(
      <div onClick={onOuterClick}>
        <LightningPiggyCallout />
      </div>,
    );
    const link = screen.getByRole('link', { name: /learn more/i });
    // Prevent jsdom from actually navigating on the anchor click.
    link.addEventListener('click', (e) => e.preventDefault());
    fireEvent.click(link);
    expect(onOuterClick).not.toHaveBeenCalled();
  });
});
