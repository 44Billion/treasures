import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { LocationPicker } from '@/components/LocationPicker';
import { LocationWarnings } from '@/components/LocationWarnings';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { LocationVerification } from '@/features/geocache/utils/osmVerification';

// Mock Leaflet components
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="map-container">{children}</div>,
  TileLayer: () => <div data-testid="tile-layer" />,
  Marker: () => <div data-testid="marker" />,
  useMap: () => ({
    setView: vi.fn(),
    getZoom: () => 15,
    invalidateSize: vi.fn(),
  }),
  useMapEvents: () => null,
}));

// Mock geolocation hook
vi.mock('../hooks/useGeolocation', () => ({
  useGeolocation: () => ({
    loading: false,
    coords: null,
    getLocation: vi.fn(),
  }),
}));

// Mock LocationSearch component
vi.mock('@/components/LocationSearch', () => ({
  LocationSearch: ({ placeholder }: { placeholder: string }) => (
    <input data-testid="location-search" placeholder={placeholder} />
  ),
}));

// Mock MapStyleSelector component
vi.mock('@/components/MapStyleSelector', () => ({
  MapStyleSelector: ({ currentStyle, onStyleChange }: { currentStyle: string; onStyleChange: (style: string) => void }) => (
    <div data-testid="map-style-selector">
      <button onClick={() => onStyleChange('satellite')}>Satellite</button>
      <button onClick={() => onStyleChange('original')}>Original</button>
      <span>Current: {currentStyle}</span>
    </div>
  ),
  MAP_STYLES: {
    original: {
      key: "original",
      name: "Original",
      url: "https://example.com/original/{z}/{x}/{y}.png",
      attribution: "Test attribution"
    },
    satellite: {
      key: "satellite", 
      name: "Satellite",
      url: "https://example.com/satellite/{z}/{x}/{y}.png",
      attribution: "Test attribution"
    }
  }
}));

// Mock next-themes
vi.mock('next-themes', () => ({
  useTheme: () => ({
    theme: 'light',
    systemTheme: 'light'
  })
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe('LocationPicker Improvements', () => {
  it('should render without card wrapper for cleaner mobile layout', () => {
    const Wrapper = createWrapper();
    
    render(
      <Wrapper>
        <LocationPicker
          value={null}
          onChange={vi.fn()}
        />
      </Wrapper>
    );

    // Should have map container
    expect(screen.getByTestId('map-container')).toBeInTheDocument();
    
    // Should have search input
    expect(screen.getByPlaceholderText(/search city, zip code/i)).toBeInTheDocument();
    
    // Should have current location button
    expect(screen.getByText(/use current location/i)).toBeInTheDocument();
    
    // Manual coordinates should be in a collapsible details element
    expect(screen.getByText(/enter coordinates manually/i)).toBeInTheDocument();
    
    // Should have map style selector
    expect(screen.getByTestId('map-style-selector')).toBeInTheDocument();
  });

  it('should show selected location in a clean format', () => {
    const Wrapper = createWrapper();
    const mockLocation = { lat: 40.7128, lng: -74.0060 };
    
    render(
      <Wrapper>
        <LocationPicker
          value={mockLocation}
          onChange={vi.fn()}
        />
      </Wrapper>
    );

    // Should show selected coordinates
    expect(screen.getByText(/selected: 40.712800, -74.006000/i)).toBeInTheDocument();
    
    // Should have OpenStreetMap link
    expect(screen.getByText(/view on openstreetmap/i)).toBeInTheDocument();
  });

  it('should include map style selector with original and satellite options', () => {
    const Wrapper = createWrapper();
    
    render(
      <Wrapper>
        <LocationPicker
          value={null}
          onChange={vi.fn()}
        />
      </Wrapper>
    );

    // Should have map style selector
    expect(screen.getByTestId('map-style-selector')).toBeInTheDocument();
    
    // Should have style options
    expect(screen.getByText('Original')).toBeInTheDocument();
    expect(screen.getByText('Satellite')).toBeInTheDocument();
    
    // Should show current style
    expect(screen.getByText(/current: original/i)).toBeInTheDocument();
  });
});

describe('LocationWarnings Improvements', () => {
  const mockVerification: LocationVerification = {
    isRestricted: false,
    warnings: ['Test warning'],
    nearbyFeatures: [],
    accessibility: {
      wheelchair: true,
      parking: true,
      publicTransport: undefined,
      fee: undefined,
      openingHours: undefined,
    },
    terrain: {
      surface: 'paved',
      hazards: [],
      lit: true,
      covered: undefined,
    },
    legal: {
      restrictions: [],
    },
    environmental: {
      nesting: undefined,
      protected: undefined,
      leaveNoTrace: undefined,
    },
    safety: {
      surveillance: undefined,
      cellCoverage: undefined,
      lighting: undefined,
    },
  };

  it('should render compact location features', () => {
    render(
      <LocationWarnings
        verification={mockVerification}
        hideCreatorWarnings={true}
      />
    );

    // Should show location info section
    expect(screen.getByText(/location info/i)).toBeInTheDocument();
    
    // Should show positive features as badges
    expect(screen.getByText(/wheelchair accessible/i)).toBeInTheDocument();
    expect(screen.getByText(/parking available/i)).toBeInTheDocument();
    expect(screen.getByText(/well lit/i)).toBeInTheDocument();
    
    // Should show expandable trigger for additional features
    expect(screen.getByText(/\+\d+ more/)).toBeInTheDocument();
  });

  it('should handle critical issues prominently', () => {
    const criticalVerification: LocationVerification = {
      ...mockVerification,
      warnings: ['⚠️ Location is underwater', 'Other warning'],
    };

    render(
      <LocationWarnings
        verification={criticalVerification}
        hideCreatorWarnings={false}
      />
    );

    // Should show critical issues section
    expect(screen.getByText(/critical issues/i)).toBeInTheDocument();
    expect(screen.getByText(/location is underwater/i)).toBeInTheDocument();
  });

  it('should provide expandable details for additional information', () => {
    const detailedVerification: LocationVerification = {
      ...mockVerification,
      warnings: Array.from({ length: 10 }, (_, i) => `Warning ${i + 1}`),
    };

    render(
      <LocationWarnings
        verification={detailedVerification}
        hideCreatorWarnings={true}
      />
    );

    // Should show expandable trigger
    expect(screen.getByText(/\+\d+ more/)).toBeInTheDocument();
  });
});