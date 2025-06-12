/**
 * Integration test for Map page proximity search functionality
 * Tests the fix for proximity search not working on the map page
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import Map from '@/pages/Map';

// Mock the hooks
const mockOptimisticGeocaches = {
  geocaches: [
    {
      id: 'cache1',
      name: 'Test Cache 1',
      description: 'A test cache',
      location: { lat: 40.7128, lng: -74.0060 },
      difficulty: 2,
      terrain: 1,
      type: 'traditional',
      size: 'regular',
      created_at: 1700000000,
      pubkey: 'pubkey1',
      dTag: 'cache1',
    },
    {
      id: 'cache2',
      name: 'Test Cache 2',
      description: 'Another test cache',
      location: { lat: 40.7589, lng: -73.9851 },
      difficulty: 3,
      terrain: 2,
      type: 'mystery',
      size: 'small',
      created_at: 1700000100,
      pubkey: 'pubkey2',
      dTag: 'cache2',
    },
  ],
  isLoading: false,
  isError: false,
  error: null,
  refresh: vi.fn(),
};

const mockProximitySearch = {
  data: [] as any[],
  isLoading: false,
  error: null,
  refetch: vi.fn(),
  searchStrategy: 'broad' as string,
  proximityAttempted: false,
  proximitySuccessful: false,
  totalFound: 0,
  debugInfo: undefined,
};

vi.mock('@/hooks/useOptimisticGeocaches', () => ({
  useMapPageGeocaches: () => mockOptimisticGeocaches,
}));

vi.mock('@/hooks/useReliableProximitySearch', () => ({
  useAdaptiveReliableGeocaches: () => mockProximitySearch,
}));

vi.mock('../hooks/useGeolocation', () => ({
  useGeolocation: () => ({
    loading: false,
    coords: null,
    getLocation: vi.fn(),
  }),
}));

vi.mock('../components/GeocacheMap', () => ({
  GeocacheMap: ({ geocaches }: { geocaches: any[] }) => (
    <div data-testid="geocache-map">
      Map with {geocaches.length} geocaches
    </div>
  ),
}));

vi.mock('@/components/LocationSearch', () => ({
  LocationSearch: ({ onLocationSelect }: { onLocationSelect: (location: any) => void }) => (
    <button
      data-testid="location-search"
      onClick={() => onLocationSelect({ lat: 40.7128, lng: -74.0060, name: 'New York' })}
    >
      Search Location
    </button>
  ),
}));

vi.mock('@/components/FilterButton', () => ({
  FilterButton: () => <div data-testid="filter-button">Filters</div>,
}));

vi.mock('@/components/DesktopHeader', () => ({
  DesktopHeader: () => <div data-testid="desktop-header">Header</div>,
}));

vi.mock('@/components/GeocacheDialog', () => ({
  GeocacheDialog: () => <div data-testid="geocache-dialog">Dialog</div>,
}));

describe('Map Page Proximity Search Integration', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  const renderMapPage = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Map />
        </BrowserRouter>
      </QueryClientProvider>
    );
  };

  it('should display optimistic geocaches when no proximity search is active', async () => {
    renderMapPage();

    // Should show the optimistic geocaches
    await waitFor(() => {
      expect(screen.getByText('2 caches')).toBeInTheDocument();
    });

    // Should show the geocache names
    expect(screen.getByText('Test Cache 1')).toBeInTheDocument();
    expect(screen.getByText('Test Cache 2')).toBeInTheDocument();

    // Map should receive the optimistic geocaches
    expect(screen.getByText('Map with 2 geocaches')).toBeInTheDocument();
  });

  it('should switch to proximity search when location is selected', async () => {
    // Mock proximity search to return results when location is set
    mockProximitySearch.data = [
      {
        id: 'nearby-cache',
        name: 'Nearby Cache',
        description: 'A cache found by proximity search',
        location: { lat: 40.7128, lng: -74.0060 },
        difficulty: 1,
        terrain: 1,
        type: 'traditional',
        size: 'regular',
        distance: 0.5,
        created_at: 1700000200,
        pubkey: 'pubkey3',
        dTag: 'nearby-cache',
      },
    ];
    mockProximitySearch.proximityAttempted = true;
    mockProximitySearch.proximitySuccessful = true;
    mockProximitySearch.searchStrategy = 'proximity';

    renderMapPage();

    // Initially should show optimistic geocaches
    await waitFor(() => {
      expect(screen.getByText('2 caches')).toBeInTheDocument();
    });

    // Click location search to trigger proximity search
    fireEvent.click(screen.getByTestId('location-search'));

    // Should now show proximity search results
    await waitFor(() => {
      expect(screen.getByText('1 cache • 25km radius')).toBeInTheDocument();
    });

    expect(screen.getByText('Nearby Cache')).toBeInTheDocument();
    expect(screen.getByText('Smart Search')).toBeInTheDocument();
  });

  it('should apply client-side filters to optimistic geocaches', async () => {
    renderMapPage();

    // Initially should show all caches
    await waitFor(() => {
      expect(screen.getByText('2 caches')).toBeInTheDocument();
    });

    // Type in search box to filter
    const searchInput = screen.getByPlaceholderText('Search caches...');
    fireEvent.change(searchInput, { target: { value: 'Test Cache 1' } });

    // Should filter to only show matching cache
    await waitFor(() => {
      expect(screen.getByText('1 cache')).toBeInTheDocument();
    });

    expect(screen.getByText('Test Cache 1')).toBeInTheDocument();
    expect(screen.queryByText('Test Cache 2')).not.toBeInTheDocument();
  });

  it('should handle Near Me button correctly', async () => {
    renderMapPage();

    // Initially should show optimistic geocaches
    await waitFor(() => {
      expect(screen.getByText('2 caches')).toBeInTheDocument();
    });

    // Click Near Me button
    const nearMeButton = screen.getByText('Near Me');
    fireEvent.click(nearMeButton);

    // Button should become active
    expect(nearMeButton.closest('button')).toHaveClass('bg-primary');
  });

  it('should show fallback search badge when proximity search fails', async () => {
    // Mock proximity search to fail and fallback
    mockProximitySearch.data = mockOptimisticGeocaches.geocaches;
    mockProximitySearch.proximityAttempted = true;
    mockProximitySearch.proximitySuccessful = false;
    mockProximitySearch.searchStrategy = 'fallback';

    renderMapPage();

    // Trigger proximity search by clicking location search
    fireEvent.click(screen.getByTestId('location-search'));

    // Should show fallback search badge
    await waitFor(() => {
      expect(screen.getByText('Fallback Search')).toBeInTheDocument();
    });
  });

  it('should clear proximity search when X button is clicked', async () => {
    renderMapPage();

    // Trigger proximity search
    fireEvent.click(screen.getByTestId('location-search'));

    // Should show radius controls
    await waitFor(() => {
      expect(screen.getByDisplayValue('25')).toBeInTheDocument();
    });

    // Click X button to clear
    const clearButton = screen.getByTitle('Clear location filter');
    fireEvent.click(clearButton);

    // Should go back to showing optimistic geocaches
    await waitFor(() => {
      expect(screen.getByText('2 caches')).toBeInTheDocument();
    });

    // Radius controls should be hidden
    expect(screen.queryByDisplayValue('25')).not.toBeInTheDocument();
  });
});