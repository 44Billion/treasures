import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import '@testing-library/jest-dom';

// Mock lucide-react
vi.mock('lucide-react', () => ({
  MapPin: () => <svg data-testid="map-pin-icon" />,
}));

describe('SearchInViewButton', () => {
  let mockOnSearchInView: any;
  let mockMap: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockOnSearchInView = vi.fn();
    mockMap = {
      getCenter: () => ({ lat: 40.7128, lng: -74.0060 }),
      getZoom: () => 10,
      getBounds: () => ({
        getCenter: () => ({ lat: 40.7128, lng: -74.0060 }),
        getNorthEast: () => ({ lat: 40.8, lng: -73.9 }),
        getSouthWest: () => ({ lat: 40.6, lng: -74.1 }),
      }),
      on: vi.fn(),
      off: vi.fn(),
      options: {
        center: [40.7128, -74.0060],
        zoom: 10,
      },
    };
  });

  it('should not render when map has not been moved', async () => {
    const { SearchInViewButton } = await import('@/components/SearchInViewButton');
    
    render(
      <SearchInViewButton 
        map={mockMap}
        onSearchInView={mockOnSearchInView} 
        isAdventureTheme={false} 
      />
    );

    // Wait for initial check to complete
    await waitFor(() => {
      expect(screen.queryByText('Search in View')).not.toBeInTheDocument();
    });
  });

  it('should render when map has been moved', async () => {
    const { SearchInViewButton } = await import('@/components/SearchInViewButton');
    
    // Mock map movement
    mockMap.getCenter = () => ({ lat: 40.8, lng: -73.9 });
    mockMap.getZoom = () => 11;

    render(
      <SearchInViewButton 
        map={mockMap}
        onSearchInView={mockOnSearchInView} 
        isAdventureTheme={false} 
      />
    );

    // Wait for the movement check to complete
    await waitFor(() => {
      expect(screen.getByText('Search Here')).toBeInTheDocument();
    });
  });

  it('should call onSearchInView when clicked', async () => {
    const { SearchInViewButton } = await import('@/components/SearchInViewButton');
    
    // Mock map movement
    mockMap.getCenter = () => ({ lat: 40.8, lng: -73.9 });
    mockMap.getZoom = () => 11;

    render(
      <SearchInViewButton 
        map={mockMap}
        onSearchInView={mockOnSearchInView} 
        isAdventureTheme={false} 
      />
    );

    // Wait for button to appear
    await waitFor(() => {
      expect(screen.getByText('Search Here')).toBeInTheDocument();
    });

    // Click the button
    fireEvent.click(screen.getByText('Search Here'));

    // Verify the callback was called with bounds
    await waitFor(() => {
      expect(mockOnSearchInView).toHaveBeenCalledWith(
        expect.objectContaining({
          getCenter: expect.any(Function),
          getNorthEast: expect.any(Function),
          getSouthWest: expect.any(Function),
        })
      );
    });
  });

  it('should show loading state when searching', async () => {
    const { SearchInViewButton } = await import('@/components/SearchInViewButton');
    
    // Mock map movement
    mockMap.getCenter = () => ({ lat: 40.8, lng: -73.9 });
    mockMap.getZoom = () => 11;

    // Mock a slow search
    mockOnSearchInView.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));

    render(
      <SearchInViewButton 
        map={mockMap}
        onSearchInView={mockOnSearchInView} 
        isAdventureTheme={false} 
      />
    );

    // Wait for button to appear
    await waitFor(() => {
      expect(screen.getByText('Search Here')).toBeInTheDocument();
    });

    // Click the button
    fireEvent.click(screen.getByText('Search Here'));

    // Check for loading state
    await waitFor(() => {
      expect(screen.getByText('Searching...')).toBeInTheDocument();
    });

    // Wait for search to complete
    await waitFor(() => {
      expect(screen.queryByText('Searching...')).not.toBeInTheDocument();
    }, { timeout: 200 });
  });

  it('should apply adventure theme styling', async () => {
    const { SearchInViewButton } = await import('@/components/SearchInViewButton');
    
    // Mock map movement
    mockMap.getCenter = () => ({ lat: 40.8, lng: -73.9 });
    mockMap.getZoom = () => 11;

    render(
      <SearchInViewButton 
        map={mockMap}
        onSearchInView={mockOnSearchInView} 
        isAdventureTheme={true} 
      />
    );

    // Wait for button to appear
    await waitFor(() => {
      const button = screen.getByText('Search Here');
      expect(button).toBeInTheDocument();
      expect(button).toHaveClass('bg-amber-600');
    });
  });
});