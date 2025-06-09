import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CacheMenu } from '@/components/CacheMenu';
import type { Geocache } from '@/types/geocache';

// Mock the ShareDialog component
vi.mock('@/components/ShareDialog', () => ({
  ShareDialog: ({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) => (
    <div data-testid="share-dialog" style={{ display: open ? 'block' : 'none' }}>
      <button onClick={() => onOpenChange(false)}>Close</button>
    </div>
  ),
}));

// Mock react-router-dom
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const mockGeocache: Geocache = {
  id: 'test-id',
  dTag: 'test-dtag',
  pubkey: 'test-pubkey',
  name: 'Test Cache',
  description: 'Test description',
  location: {
    lat: 40.7128,
    lng: -74.0060,
  },
  difficulty: 2,
  terrain: 3,
  size: 'Regular',
  type: 'Traditional',
  created_at: Date.now() / 1000,
  relays: ['wss://test.relay'],
};

function TestWrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {children}
      </BrowserRouter>
    </QueryClientProvider>
  );
}

describe('CacheMenu Mobile Scroll Fix', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    mockNavigate.mockClear();
    user = userEvent.setup();
    
    // Create a container for portals
    const portalContainer = document.createElement('div');
    portalContainer.setAttribute('id', 'portal-root');
    document.body.appendChild(portalContainer);
  });

  afterEach(() => {
    // Clean up portal container
    const portalContainer = document.getElementById('portal-root');
    if (portalContainer) {
      document.body.removeChild(portalContainer);
    }
  });

  it('should render the menu trigger button', () => {
    render(
      <TestWrapper>
        <CacheMenu geocache={mockGeocache} />
      </TestWrapper>
    );

    const menuButton = screen.getByRole('button', { name: /more options/i });
    expect(menuButton).toBeInTheDocument();
  });

  it('should open dropdown menu when clicked', async () => {
    render(
      <TestWrapper>
        <CacheMenu geocache={mockGeocache} />
      </TestWrapper>
    );

    const menuButton = screen.getByRole('button', { name: /more options/i });
    await user.click(menuButton);

    // Wait for dropdown to open and check for menu items
    await waitFor(() => {
      // Look for menu items in the document (they're rendered in a portal)
      expect(document.body).toHaveTextContent('View on Map');
      expect(document.body).toHaveTextContent('Share');
    });
  });

  it('should close dropdown and navigate when "View on Map" is clicked', async () => {
    render(
      <TestWrapper>
        <CacheMenu geocache={mockGeocache} />
      </TestWrapper>
    );

    const menuButton = screen.getByRole('button', { name: /more options/i });
    await user.click(menuButton);

    await waitFor(() => {
      expect(document.body).toHaveTextContent('View on Map');
    });

    // Find the "View on Map" button in the document
    const viewOnMapItem = screen.getByRole('menuitem', { name: /view on map/i });
    await user.click(viewOnMapItem);

    expect(mockNavigate).toHaveBeenCalledWith(
      `/map?lat=${mockGeocache.location.lat}&lng=${mockGeocache.location.lng}&zoom=16&highlight=${mockGeocache.dTag}&tab=map`
    );
  });

  it('should close dropdown and open share dialog when "Share" is clicked', async () => {
    render(
      <TestWrapper>
        <CacheMenu geocache={mockGeocache} />
      </TestWrapper>
    );

    const menuButton = screen.getByRole('button', { name: /more options/i });
    await user.click(menuButton);

    await waitFor(() => {
      expect(document.body).toHaveTextContent('Share');
    });

    const shareItem = screen.getByRole('menuitem', { name: /share/i });
    await user.click(shareItem);

    await waitFor(() => {
      expect(screen.getByTestId('share-dialog')).toBeVisible();
    });
  });

  it('should prevent event propagation on menu button click', () => {
    const mockParentClick = vi.fn();
    
    render(
      <TestWrapper>
        <div onClick={mockParentClick}>
          <CacheMenu geocache={mockGeocache} />
        </div>
      </TestWrapper>
    );

    const menuButton = screen.getByRole('button', { name: /more options/i });
    fireEvent.click(menuButton);

    // Parent click should not be triggered due to stopPropagation
    expect(mockParentClick).not.toHaveBeenCalled();
  });

  it('should render compact variant correctly', () => {
    render(
      <TestWrapper>
        <CacheMenu geocache={mockGeocache} variant="compact" />
      </TestWrapper>
    );

    const menuButton = screen.getByRole('button', { name: /more options/i });
    expect(menuButton).toBeInTheDocument();
    
    // Check that the button has the correct size class for compact variant (sm size)
    // The sm size for buttons in shadcn/ui is h-9 px-2 xs:px-3
    expect(menuButton).toHaveClass('h-9');
  });

  it('should apply custom className', () => {
    const customClass = 'custom-test-class';
    
    render(
      <TestWrapper>
        <CacheMenu geocache={mockGeocache} className={customClass} />
      </TestWrapper>
    );

    const menuButton = screen.getByRole('button', { name: /more options/i });
    expect(menuButton).toHaveClass(customClass);
  });
});