import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { NostrProvider } from '@nostrify/react';
import Map from '@/pages/Map';

// Mock the hooks
vi.mock('../hooks/useGeolocation', () => ({
  useGeolocation: () => ({
    loading: false,
    coords: null,
    getLocation: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock('@/hooks/useAppContext', () => ({
  useAppContext: () => ({
    config: { relayUrl: 'wss://test.relay' },
  }),
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

// Mock Leaflet components
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="map-container">{children}</div>,
  TileLayer: () => <div data-testid="tile-layer" />,
  Marker: () => <div data-testid="marker" />,
  Popup: ({ children }: { children: React.ReactNode }) => <div data-testid="popup">{children}</div>,
  Circle: () => <div data-testid="circle" />,
  useMap: () => ({
    setView: vi.fn(),
    getBounds: vi.fn(() => ({
      getCenter: () => ({ lat: 40.7128, lng: -74.0060 }),
      getNorthEast: () => ({ lat: 40.8, lng: -73.9 }),
      getSouthWest: () => ({ lat: 40.6, lng: -74.1 }),
      getNorth: () => 40.8,
      getSouth: () => 40.6,
      getEast: () => -73.9,
      getWest: () => -74.1,
    })),
    eachLayer: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    getContainer: () => ({
      classList: {
        remove: vi.fn(),
        add: vi.fn(),
      },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
    invalidateSize: vi.fn(),
    addControl: vi.fn(),
    removeControl: vi.fn(),
  }),
}));

// Mock GeocacheMap component
vi.mock('../components/GeocacheMap', () => ({
  GeocacheMap: ({ onMarkerClick }: { onMarkerClick?: (geocache: any) => void }) => (
    <div data-testid="geocache-map">
      <button 
        data-testid="test-marker" 
        onClick={() => onMarkerClick?.({ dTag: 'test-cache', name: 'Test Cache' })}
      >
        Test Marker
      </button>
    </div>
  ),
}));

// Mock other components
vi.mock('@/components/DesktopHeader', () => ({
  DesktopHeader: () => <div data-testid="desktop-header" />,
}));

vi.mock('@/components/LocationSearch', () => ({
  LocationSearch: ({ onLocationSelect }: { onLocationSelect: (loc: any) => void }) => (
    <button 
      data-testid="location-search"
      onClick={() => onLocationSelect({ lat: 40.7128, lng: -74.0060, name: 'New York' })}
    >
      Search Location
    </button>
  ),
}));

vi.mock('@/components/FilterButton', () => ({
  FilterButton: () => <div data-testid="filter-button" />,
}));

vi.mock('@/components/GeocacheDialog', () => ({
  GeocacheDialog: ({ isOpen }: { isOpen: boolean }) => 
    isOpen ? <div data-testid="geocache-dialog">Dialog Open</div> : null,
}));

vi.mock('@/components/ui/mobile-button-patterns', () => ({
  MapViewTabs: ({ children }: { children: React.ReactNode }) => <div data-testid="map-view-tabs">{children}</div>,
}));

vi.mock('@/components/ui/skeleton-patterns', () => ({
  SmartLoadingState: ({ children }: { children: React.ReactNode }) => <div data-testid="loading-state">{children}</div>,
}));

vi.mock('@/components/ui/geocache-card', () => ({
  CompactGeocacheCard: ({ onClick }: { onClick: () => void }) => (
    <button data-testid="geocache-card" onClick={onClick}>Cache Card</button>
  ),
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
      <NostrProvider relays={['wss://test.relay']}>
        <BrowserRouter>
          {children}
        </BrowserRouter>
      </NostrProvider>
    </QueryClientProvider>
  );
};

describe('Map Fixes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render Near Me button with proper feedback', async () => {
    render(
      <TestWrapper>
        <Map />
      </TestWrapper>
    );

    // Should find Near Me button
    const nearMeButton = screen.getByText('Near Me');
    expect(nearMeButton).toBeInTheDocument();
  });

  it('should handle marker click and prevent popup conflicts', async () => {
    render(
      <TestWrapper>
        <Map />
      </TestWrapper>
    );

    // Find and click a test marker
    const testMarker = screen.getByTestId('test-marker');
    fireEvent.click(testMarker);

    // Should open dialog
    await waitFor(() => {
      expect(screen.getByTestId('geocache-dialog')).toBeInTheDocument();
    });
  });

  it('should handle location search properly', async () => {
    render(
      <TestWrapper>
        <Map />
      </TestWrapper>
    );

    // Find and click location search
    const locationSearch = screen.getByTestId('location-search');
    fireEvent.click(locationSearch);

    // Should not throw errors (basic functionality test)
    expect(locationSearch).toBeInTheDocument();
  });

  it('should handle Near Me button click', async () => {
    const mockGetLocation = vi.fn().mockResolvedValue(undefined);
    
    // Re-mock with our test function
    vi.doMock('../hooks/useGeolocation', () => ({
      useGeolocation: () => ({
        loading: false,
        coords: null,
        getLocation: mockGetLocation,
      }),
    }));

    render(
      <TestWrapper>
        <Map />
      </TestWrapper>
    );

    const nearMeButton = screen.getByText('Near Me');
    fireEvent.click(nearMeButton);

    // Should call getLocation
    await waitFor(() => {
      expect(mockGetLocation).toHaveBeenCalled();
    });
  });
});