import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NostrProvider } from '@nostrify/react';
import Map from '@/pages/Map';

// Mock the necessary hooks and components
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

describe('Map View "View in Map" Action', () => {
  beforeEach(() => {
    // Reset window.innerWidth before each test
    mockInnerWidth(1024);
    vi.clearAllMocks();
  });

  it('should switch to map tab on mobile when URL has tab=map parameter', async () => {
    // Set mobile width
    mockInnerWidth(768);
    
    const Wrapper = createWrapper(['/map?lat=40.7128&lng=-74.0060&zoom=16&highlight=test-cache&tab=map']);
    
    render(<Map />, { wrapper: Wrapper });

    // Wait for component to render and process URL params
    await waitFor(() => {
      // Check if the map tab is active on mobile
      const mapTab = screen.getByRole('tab', { name: /map/i });
      expect(mapTab).toHaveAttribute('data-state', 'active');
    });
  });

  it('should switch to map tab on mobile when URL has coordinates but no tab parameter', async () => {
    // Set mobile width
    mockInnerWidth(768);
    
    const Wrapper = createWrapper(['/map?lat=40.7128&lng=-74.0060&zoom=16&highlight=test-cache']);
    
    render(<Map />, { wrapper: Wrapper });

    // Wait for component to render and process URL params
    await waitFor(() => {
      // Check if the map tab is active on mobile when coordinates are provided
      const mapTab = screen.getByRole('tab', { name: /map/i });
      expect(mapTab).toHaveAttribute('data-state', 'active');
    });
  });

  it('should default to list tab on mobile when no coordinates or tab parameter', async () => {
    // Set mobile width
    mockInnerWidth(768);
    
    const Wrapper = createWrapper(['/map']);
    
    render(<Map />, { wrapper: Wrapper });

    // Wait for component to render
    await waitFor(() => {
      // Check if the list tab is active by default
      const listTab = screen.getByRole('tab', { name: /list/i });
      expect(listTab).toHaveAttribute('data-state', 'active');
    });
  });

  it('should not affect tab selection on desktop', async () => {
    // Set desktop width
    mockInnerWidth(1200);
    
    const Wrapper = createWrapper(['/map?lat=40.7128&lng=-74.0060&zoom=16&highlight=test-cache&tab=map']);
    
    render(<Map />, { wrapper: Wrapper });

    // On desktop, the mobile tabs should not be visible
    await waitFor(() => {
      // Desktop view should show the sidebar and map side by side
      expect(screen.getByTestId('geocache-map')).toBeInTheDocument();
    });
  });
});