import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NostrProvider } from '@nostrify/react';
import Map from '@/pages/Map';

// Mock all the necessary hooks and components
vi.mock('@/hooks/useAppContext', () => ({
  useAppContext: () => ({
    config: { relayUrl: 'wss://test.relay' }
  })
}));

vi.mock('@/hooks/useReliableProximitySearch', () => ({
  useAdaptiveReliableGeocaches: () => ({
    data: [],
    isLoading: false,
    error: null,
    refetch: vi.fn(),
    searchStrategy: 'broad',
    proximityAttempted: false,
    proximitySuccessful: false,
    totalFound: 0,
    debugInfo: {}
  })
}));

vi.mock('@/hooks/useOptimisticGeocaches', () => ({
  useMapPageGeocaches: () => ({
    geocaches: [],
    isLoading: false,
    isError: false,
    error: null,
    refresh: vi.fn(),
    hasInitialData: true,
    isStale: false,
    isFetching: false
  })
}));

vi.mock('../hooks/useGeolocation', () => ({
  useGeolocation: () => ({
    loading: false,
    coords: null,
    getLocation: vi.fn()
  })
}));

vi.mock('../components/GeocacheMap', () => ({
  GeocacheMap: ({ children, ...props }: any) => (
    <div data-testid="geocache-map" {...props}>
      Mocked GeocacheMap
      {children}
    </div>
  )
}));

vi.mock('@/components/DesktopHeader', () => ({
  DesktopHeader: () => <div data-testid="desktop-header">Desktop Header</div>
}));

vi.mock('@/components/LocationSearch', () => ({
  LocationSearch: ({ onLocationSelect }: any) => (
    <input 
      data-testid="location-search" 
      placeholder="Search city or zip..."
      onChange={() => {}}
    />
  )
}));

vi.mock('@/components/FilterButton', () => ({
  FilterButton: () => <button data-testid="filter-button">Filter</button>
}));

vi.mock('@/components/GeocacheDialog', () => ({
  GeocacheDialog: () => <div data-testid="geocache-dialog">Geocache Dialog</div>
}));

vi.mock('@/components/ui/skeleton-patterns', () => ({
  SmartLoadingState: ({ children }: any) => <div data-testid="smart-loading-state">{children}</div>
}));

// Mock window.innerWidth for mobile detection
const mockInnerWidth = (width: number) => {
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: width,
  });
  // Trigger resize event
  window.dispatchEvent(new Event('resize'));
};

const createWrapper = (initialEntries: string[] = ['/map']) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <MemoryRouter initialEntries={initialEntries}>
      <QueryClientProvider client={queryClient}>
        <NostrProvider relays={['wss://test.relay']}>
          {children}
        </NostrProvider>
      </QueryClientProvider>
    </MemoryRouter>
  );
};

describe('Map Tab Switching Integration', () => {
  beforeEach(() => {
    // Reset window.innerWidth before each test
    mockInnerWidth(1024);
    vi.clearAllMocks();
  });

  it('should switch to map tab on mobile when "View in Map" URL is used', async () => {
    // Set mobile width
    mockInnerWidth(768);
    
    // Simulate the URL that CacheMenu.handleViewOnMap() generates
    const Wrapper = createWrapper(['/map?lat=40.7128&lng=-74.0060&zoom=16&highlight=test-cache&tab=map']);
    
    render(<Map />, { wrapper: Wrapper });

    // Wait for component to render and process URL params
    await waitFor(() => {
      // On mobile, we should see the tabs
      const mapTab = screen.getByRole('tab', { name: /map/i });
      expect(mapTab).toBeInTheDocument();
      
      // The map tab should be active
      expect(mapTab).toHaveAttribute('data-state', 'active');
    }, { timeout: 3000 });
  });

  it('should switch to map tab on mobile when coordinates are provided without explicit tab parameter', async () => {
    // Set mobile width
    mockInnerWidth(768);
    
    const Wrapper = createWrapper(['/map?lat=40.7128&lng=-74.0060&zoom=16&highlight=test-cache']);
    
    render(<Map />, { wrapper: Wrapper });

    // Wait for component to render and process URL params
    await waitFor(() => {
      // The map tab should be active when coordinates are provided
      const mapTab = screen.getByRole('tab', { name: /map/i });
      expect(mapTab).toHaveAttribute('data-state', 'active');
    }, { timeout: 3000 });
  });

  it('should default to list tab on mobile when no special parameters are provided', async () => {
    // Set mobile width
    mockInnerWidth(768);
    
    const Wrapper = createWrapper(['/map']);
    
    render(<Map />, { wrapper: Wrapper });

    // Wait for component to render
    await waitFor(() => {
      // The list tab should be active by default
      const listTab = screen.getByRole('tab', { name: /list/i });
      expect(listTab).toHaveAttribute('data-state', 'active');
    }, { timeout: 3000 });
  });

  it('should handle tab parameter correctly', async () => {
    // Set mobile width
    mockInnerWidth(768);
    
    const Wrapper = createWrapper(['/map?tab=map']);
    
    render(<Map />, { wrapper: Wrapper });

    // Wait for component to render
    await waitFor(() => {
      // The map tab should be active when tab=map is specified
      const mapTab = screen.getByRole('tab', { name: /map/i });
      expect(mapTab).toHaveAttribute('data-state', 'active');
    }, { timeout: 3000 });
  });

  it('should handle list tab parameter correctly', async () => {
    // Set mobile width
    mockInnerWidth(768);
    
    const Wrapper = createWrapper(['/map?tab=list']);
    
    render(<Map />, { wrapper: Wrapper });

    // Wait for component to render
    await waitFor(() => {
      // The list tab should be active when tab=list is specified
      const listTab = screen.getByRole('tab', { name: /list/i });
      expect(listTab).toHaveAttribute('data-state', 'active');
    }, { timeout: 3000 });
  });
});