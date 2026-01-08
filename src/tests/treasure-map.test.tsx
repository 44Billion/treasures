import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { TreasureMapsList } from '@/features/treasure-map/components/TreasureMapsList';
import { TreasureMapView } from '@/features/treasure-map/components/TreasureMapView';
import { PREDEFINED_TREASURE_MAPS } from '@/features/treasure-map/data/predefined-maps';

// Mock the useNostr hook
jest.mock('@nostrify/react', () => ({
  useNostr: () => ({
    nostr: {
      query: jest.fn().mockResolvedValue([]),
      event: jest.fn().mockResolvedValue({}),
    },
  }),
}));

// Mock the useTheme hook
jest.mock('@/shared/hooks/useTheme', () => ({
  useTheme: () => ({
    theme: 'light',
    systemTheme: 'light',
    setTheme: jest.fn()
  })
}));

// Mock the geocache components
jest.mock('@/components/ui/geocache-card', () => ({
  CompactGeocacheCard: ({ cache, onClick }: any) => (
    <div data-testid="geocache-card" onClick={onClick}>
      {cache.name}
    </div>
  ),
}));

const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

const renderWithProviders = (component: React.ReactElement) => {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {component}
      </BrowserRouter>
    </QueryClientProvider>
  );
};

describe('TreasureMaps Components', () => {
  describe('TreasureMapsList', () => {
    it('renders treasure maps list with search and filters', async () => {
      renderWithProviders(<TreasureMapsList />);

      // Check if header is rendered
      expect(screen.getByText('Treasure Maps')).toBeInTheDocument();
      expect(screen.getByText('Embark on epic adventures with curated treasure maps from around the world')).toBeInTheDocument();

      // Check if search input is rendered
      expect(screen.getByPlaceholderText('Search treasure maps...')).toBeInTheDocument();

      // Check if category filters are rendered
      expect(screen.getByText('All Maps')).toBeInTheDocument();
      expect(screen.getByText('City Adventure')).toBeInTheDocument();
      expect(screen.getByText('Park Expedition')).toBeInTheDocument();

      // Wait for predefined maps to load
      await waitFor(() => {
        expect(screen.getByText('Central Park Quest')).toBeInTheDocument();
        expect(screen.getByText('Golden Gate Expedition')).toBeInTheDocument();
      });
    });

    it('filters treasure maps by search query', async () => {
      renderWithProviders(<TreasureMapsList />);

      // Wait for maps to load
      await waitFor(() => {
        expect(screen.getByText('Central Park Quest')).toBeInTheDocument();
      });

      // Search for "Central"
      const searchInput = screen.getByPlaceholderText('Search treasure maps...');
      fireEvent.change(searchInput, { target: { value: 'Central' } });

      // Should only show Central Park Quest
      expect(screen.getByText('Central Park Quest')).toBeInTheDocument();
      expect(screen.queryByText('Golden Gate Expedition')).not.toBeInTheDocument();
    });

    it('filters treasure maps by category', async () => {
      renderWithProviders(<TreasureMapsList />);

      // Wait for maps to load
      await waitFor(() => {
        expect(screen.getByText('Central Park Quest')).toBeInTheDocument();
        expect(screen.getByText('Golden Gate Expedition')).toBeInTheDocument();
      });

      // Filter by park category
      const parkButton = screen.getByText('Park Expedition');
      fireEvent.click(parkButton);

      // Should show both park maps
      expect(screen.getByText('Central Park Quest')).toBeInTheDocument();
      expect(screen.getByText('Golden Gate Expedition')).toBeInTheDocument();

      // Filter by city category
      const cityButton = screen.getByText('City Adventure');
      fireEvent.click(cityButton);

      // Should show city maps
      expect(screen.getByText('Royal Parks Adventure')).toBeInTheDocument();
      expect(screen.getByText('Le Marais Mystery')).toBeInTheDocument();
    });

    it('shows no results when no maps match filters', async () => {
      renderWithProviders(<TreasureMapsList />);

      // Wait for maps to load
      await waitFor(() => {
        expect(screen.getByText('Central Park Quest')).toBeInTheDocument();
      });

      // Search for something that doesn't exist
      const searchInput = screen.getByPlaceholderText('Search treasure maps...');
      fireEvent.change(searchInput, { target: { value: 'NonExistentMap' } });

      // Should show no results message
      expect(screen.getByText('No treasure maps found')).toBeInTheDocument();
      expect(screen.getByText('Try adjusting your search or filters')).toBeInTheDocument();
    });
  });

  describe('TreasureMapView', () => {
    const mockTreasureMap = PREDEFINED_TREASURE_MAPS[0];

    it('renders treasure map view with map and geocache list', async () => {
      // Mock URL params
      jest.mock('react-router-dom', () => ({
        ...jest.requireActual('react-router-dom'),
        useParams: () => ({ mapId: mockTreasureMap.id }),
        useNavigate: () => jest.fn(),
      }));

      renderWithProviders(<TreasureMapView />);

      // Check if back button is rendered
      expect(screen.getByText('Back to Maps')).toBeInTheDocument();

      // Check if treasure map details are rendered
      expect(screen.getByText(mockTreasureMap.name)).toBeInTheDocument();
      expect(screen.getByText(mockTreasureMap.description!)).toBeInTheDocument();

      // Check if map section is rendered
      expect(screen.getByText('Treasure Map')).toBeInTheDocument();
      expect(screen.getByText('Adventure Mode')).toBeInTheDocument();

      // Check if geocache list section is rendered
      expect(screen.getByText('Treasures')).toBeInTheDocument();
      expect(screen.getByText('Geocaches in this treasure map area')).toBeInTheDocument();

      // Check if start adventure button is rendered
      expect(screen.getByText('Start Adventure')).toBeInTheDocument();
    });

    it('shows loading state while map is loading', () => {
      // Mock URL params
      jest.mock('react-router-dom', () => ({
        ...jest.requireActual('react-router-dom'),
        useParams: () => ({ mapId: 'non-existent-id' }),
        useNavigate: () => jest.fn(),
      }));

      renderWithProviders(<TreasureMapView />);

      // Should show loading skeletons
      expect(screen.getByTestId('skeleton')).toBeInTheDocument();
    });
  });
});

describe('TreasureMap Data Structures', () => {
  it('predefined maps have correct structure', () => {
    PREDEFINED_TREASURE_MAPS.forEach((map) => {
      expect(map).toHaveProperty('id');
      expect(map).toHaveProperty('name');
      expect(map).toHaveProperty('description');
      expect(map).toHaveProperty('area');
      expect(map).toHaveProperty('theme', 'adventure');
      expect(map).toHaveProperty('created_at');
      expect(map).toHaveProperty('creator');
      expect(map).toHaveProperty('category');
      
      // Check area structure
      if (map.area.center) {
        expect(map.area.center).toHaveProperty('lat');
        expect(map.area.center).toHaveProperty('lng');
      }
      if (map.area.radius) {
        expect(typeof map.area.radius).toBe('number');
      }
      if (map.area.bounds) {
        expect(map.area.bounds).toHaveProperty('northEast');
        expect(map.area.bounds).toHaveProperty('southWest');
      }
    });
  });

  it('predefined maps cover different categories', () => {
    const categories = PREDEFINED_TREASURE_MAPS.map(map => map.category);
    const uniqueCategories = [...new Set(categories)];
    
    expect(uniqueCategories).toContain('park');
    expect(uniqueCategories).toContain('city');
    expect(uniqueCategories).toContain('landmark');
  });

  it('predefined maps have reasonable geographic coverage', () => {
    PREDEFINED_TREASURE_MAPS.forEach((map) => {
      if (map.area.center) {
        expect(map.area.center.lat).toBeGreaterThanOrEqual(-90);
        expect(map.area.center.lat).toBeLessThanOrEqual(90);
        expect(map.area.center.lng).toBeGreaterThanOrEqual(-180);
        expect(map.area.center.lng).toBeLessThanOrEqual(180);
      }
      
      if (map.area.radius) {
        expect(map.area.radius).toBeGreaterThan(0);
        expect(map.area.radius).toBeLessThanOrEqual(100); // Reasonable radius limit
      }
    });
  });
});