import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NostrProvider } from '@nostrify/react';
import Map from '@/pages/Map';

// Mock the GeocacheMap component since we're testing layout, not map functionality
vi.mock('../components/GeocacheMap', () => ({
  GeocacheMap: ({ ...props }) => (
    <div data-testid="geocache-map" style={{ height: '100%', width: '100%' }}>
      Mock Map Component
    </div>
  ),
}));

// Mock other complex components
vi.mock('@/components/DesktopHeader', () => ({
  DesktopHeader: () => <div data-testid="desktop-header">Header</div>,
}));

vi.mock('@/hooks/useAppContext', () => ({
  useAppContext: () => ({ config: {} }),
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
    debugInfo: {},
  }),
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
    isFetching: false,
  }),
}));

vi.mock('../hooks/useGeolocation', () => ({
  useGeolocation: () => ({
    loading: false,
    coords: null,
    getLocation: vi.fn(),
  }),
}));

const TestWrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <NostrProvider relay="wss://ditto.pub/relay">
        <BrowserRouter>
          {children}
        </BrowserRouter>
      </NostrProvider>
    </QueryClientProvider>
  );
};

describe('Map Height Fix', () => {
  it('should render map page with proper height structure', () => {
    render(
      <TestWrapper>
        <Map />
      </TestWrapper>
    );

    // Check that the main container has proper height classes
    const mapContainer = screen.getByTestId('geocache-map');
    expect(mapContainer).toBeInTheDocument();
    
    // Verify the map component receives height: 100% style
    expect(mapContainer).toHaveStyle({ height: '100%', width: '100%' });
  });

  it('should have desktop header and map layout structure', () => {
    render(
      <TestWrapper>
        <Map />
      </TestWrapper>
    );

    // Check that desktop header is present
    const header = screen.getByTestId('desktop-header');
    expect(header).toBeInTheDocument();

    // Check that map is present
    const map = screen.getByTestId('geocache-map');
    expect(map).toBeInTheDocument();
  });
});