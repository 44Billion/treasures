import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { GeocacheCard } from '@/components/geocache-card';

// Helper to fire a synthetic auxclick MouseEvent. @testing-library/react's
// `fireEvent` doesn't ship a dedicated `auxClick` shortcut, so we dispatch a
// real MouseEvent that React's synthetic-event system will pick up.
function fireAuxClick(target: HTMLElement, button: number) {
  const event = new MouseEvent('auxclick', {
    bubbles: true,
    cancelable: true,
    button,
  });
  target.dispatchEvent(event);
}

// Stable mock URL returned by useGeocacheNavigation. Tests assert that this URL
// is the one passed to window.open for middle-click / modifier-click actions.
const MOCK_URL = '/naddr1mockedgeocacheurl';

const mockNavigateToGeocache = vi.fn();
const mockOnClick = vi.fn();

vi.mock('@/hooks/useGeocacheNavigation', () => ({
  useGeocacheNavigation: () => ({
    navigateToGeocache: mockNavigateToGeocache,
    getGeocacheUrl: vi.fn(() => MOCK_URL),
  }),
}));

vi.mock('@/hooks/useAuthor', () => ({
  useAuthor: () => ({ data: null, isLoading: false }),
}));

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: null }),
}));

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({ theme: 'light', resolvedTheme: 'light', setTheme: vi.fn() }),
}));

// Force desktop so the primary-click path uses the onClick prop instead of
// auto-navigating, making the regular-click assertions unambiguous.
vi.mock('@/hooks/useIsMobile', () => ({
  useIsMobile: () => false,
}));

vi.mock('@/hooks/useThumbnailUrl', () => ({
  useThumbnailUrl: () => vi.fn(),
}));

vi.mock('@/stores/useZapStore', () => ({
  useZapStore: vi.fn(),
}));

vi.mock('zustand', async (importOriginal) => {
  const zustand = await importOriginal() as Record<string, unknown>;
  return { ...zustand, useStore: () => 0 };
});

vi.mock('@/components/CacheMenu', () => ({
  CacheMenu: () => <div data-testid="cache-menu" />,
}));

vi.mock('@/components/SaveButton', () => ({
  SaveButton: () => <div data-testid="save-button" />,
}));

vi.mock('@/components/BlurredImage', () => ({
  BlurredImage: () => <div data-testid="blurred-image" />,
}));

const mockCache = {
  id: 'test-id',
  dTag: 'test-dtag',
  pubkey: 'test-pubkey',
  name: 'Test Cache',
  location: { lat: 40.7128, lng: -74.006 },
  difficulty: 2,
  terrain: 3,
  size: 'regular',
  type: 'traditional',
};

function renderCard() {
  // Render the compact variant so the InteractiveCard root is the only
  // clickable surface we need to interact with.
  render(
    <MemoryRouter>
      <GeocacheCard cache={mockCache as never} variant="compact" onClick={mockOnClick} />
    </MemoryRouter>,
  );
  // The compact card has hover-shadow classes; pick the outermost clickable
  // ancestor by walking up from a known interior element. The card root is
  // the closest element matching the cursor-pointer class set by InteractiveCard.
  const interior = screen.getByText('Test Cache');
  let el: HTMLElement | null = interior;
  while (el && !el.className?.toString().includes('cursor-pointer')) {
    el = el.parentElement;
  }
  if (!el) throw new Error('Could not find clickable card root');
  return el;
}

describe('GeocacheCard middle-click and modifier-click behavior', () => {
  let openSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
  });

  it('opens a new tab on middle-click (auxclick button=1)', () => {
    const card = renderCard();
    fireAuxClick(card, 1);

    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(openSpy).toHaveBeenCalledWith(MOCK_URL, '_blank', 'noopener,noreferrer');
    // Aux click must not fall through to the regular onClick handler.
    expect(mockOnClick).not.toHaveBeenCalled();
    expect(mockNavigateToGeocache).not.toHaveBeenCalled();
  });

  it('opens a new tab on Ctrl+click', () => {
    const card = renderCard();
    fireEvent.click(card, { button: 0, ctrlKey: true });

    expect(openSpy).toHaveBeenCalledWith(MOCK_URL, '_blank', 'noopener,noreferrer');
    expect(mockOnClick).not.toHaveBeenCalled();
  });

  it('opens a new tab on Cmd+click (metaKey)', () => {
    const card = renderCard();
    fireEvent.click(card, { button: 0, metaKey: true });

    expect(openSpy).toHaveBeenCalledWith(MOCK_URL, '_blank', 'noopener,noreferrer');
    expect(mockOnClick).not.toHaveBeenCalled();
  });

  it('opens a new tab on Shift+click', () => {
    const card = renderCard();
    fireEvent.click(card, { button: 0, shiftKey: true });

    expect(openSpy).toHaveBeenCalledWith(MOCK_URL, '_blank', 'noopener,noreferrer');
    expect(mockOnClick).not.toHaveBeenCalled();
  });

  it('falls through to the existing onClick handler on a plain left-click', () => {
    const card = renderCard();
    fireEvent.click(card, { button: 0 });

    expect(openSpy).not.toHaveBeenCalled();
    expect(mockOnClick).toHaveBeenCalledTimes(1);
  });

  it('ignores aux events that are not middle-button (e.g. right-click)', () => {
    const card = renderCard();
    fireAuxClick(card, 2);

    expect(openSpy).not.toHaveBeenCalled();
    expect(mockOnClick).not.toHaveBeenCalled();
  });
});
