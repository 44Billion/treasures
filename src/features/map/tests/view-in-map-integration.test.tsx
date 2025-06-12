import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useSearchParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import type { Geocache } from '@/types/geocache';

// Simulate the complete "View in Map" flow
describe('View in Map Integration', () => {
  const mockGeocache: Geocache = {
    id: 'test-cache-1',
    pubkey: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    created_at: Date.now() / 1000,
    dTag: 'test-dtag',
    name: 'Test Cache',
    description: 'A test geocache',
    location: { lat: 40.7128, lng: -74.0060 },
    difficulty: 3,
    terrain: 2,
    size: 'regular',
    type: 'traditional',
    relays: ['wss://relay.example.com'],
  };

  // Simulate CacheMenu URL generation
  function generateViewInMapUrl(geocache: Geocache): string {
    return `/map?lat=${geocache.location.lat}&lng=${geocache.location.lng}&zoom=16&highlight=${geocache.dTag}&tab=map`;
  }

  // Simulate Map component URL parsing logic
  function useMapTabLogic() {
    const [searchParams] = useSearchParams();
    const [activeTab, setActiveTab] = useState<string>("list");
    const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | null>(null);
    const [highlightedGeocache, setHighlightedGeocache] = useState<string | null>(null);

    useEffect(() => {
      const lat = searchParams.get('lat');
      const lng = searchParams.get('lng');
      const tab = searchParams.get('tab');
      const highlight = searchParams.get('highlight');

      if (lat && lng) {
        const center = {
          lat: parseFloat(lat),
          lng: parseFloat(lng),
        };
        setMapCenter(center);
      }

      if (highlight) {
        setHighlightedGeocache(highlight);
      }

      // Handle tab switching logic
      if (tab && (tab === 'list' || tab === 'map')) {
        // Explicit tab parameter takes priority
        setActiveTab(tab);
      } else if (lat && lng) {
        // If coordinates are provided but no valid tab, switch to map tab on mobile
        setActiveTab('map');
      }
    }, [searchParams]);

    return { activeTab, mapCenter, highlightedGeocache };
  }

  const createWrapper = (initialEntries: string[] = ['/map']) => {
    return ({ children }: { children: React.ReactNode }) => (
      <MemoryRouter initialEntries={initialEntries}>
        {children}
      </MemoryRouter>
    );
  };

  it('should complete the full "View in Map" flow correctly', () => {
    // Step 1: Generate URL from CacheMenu
    const generatedUrl = generateViewInMapUrl(mockGeocache);
    expect(generatedUrl).toBe('/map?lat=40.7128&lng=-74.006&zoom=16&highlight=test-dtag&tab=map');

    // Step 2: Simulate navigation to that URL and test Map component logic
    const Wrapper = createWrapper([generatedUrl]);
    const { result } = renderHook(() => useMapTabLogic(), { wrapper: Wrapper });

    // Step 3: Verify that the Map component correctly parses the URL
    expect(result.current.activeTab).toBe('map');
    expect(result.current.mapCenter).toEqual({ lat: 40.7128, lng: -74.006 });
    expect(result.current.highlightedGeocache).toBe('test-dtag');
  });

  it('should handle different geocache locations correctly', () => {
    const londonGeocache: Geocache = {
      ...mockGeocache,
      location: { lat: 51.5074, lng: -0.1278 },
      dTag: 'london-cache'
    };

    // Generate URL for London geocache
    const generatedUrl = generateViewInMapUrl(londonGeocache);
    expect(generatedUrl).toBe('/map?lat=51.5074&lng=-0.1278&zoom=16&highlight=london-cache&tab=map');

    // Test Map component parsing
    const Wrapper = createWrapper([generatedUrl]);
    const { result } = renderHook(() => useMapTabLogic(), { wrapper: Wrapper });

    expect(result.current.activeTab).toBe('map');
    expect(result.current.mapCenter).toEqual({ lat: 51.5074, lng: -0.1278 });
    expect(result.current.highlightedGeocache).toBe('london-cache');
  });

  it('should prioritize explicit tab parameter over coordinate-based logic', () => {
    // Generate URL but manually override tab to 'list'
    const baseUrl = generateViewInMapUrl(mockGeocache);
    const modifiedUrl = baseUrl.replace('tab=map', 'tab=list');

    const Wrapper = createWrapper([modifiedUrl]);
    const { result } = renderHook(() => useMapTabLogic(), { wrapper: Wrapper });

    // Should respect the explicit tab=list parameter
    expect(result.current.activeTab).toBe('list');
    // But still set map center and highlight
    expect(result.current.mapCenter).toEqual({ lat: 40.7128, lng: -74.006 });
    expect(result.current.highlightedGeocache).toBe('test-dtag');
  });

  it('should handle edge cases gracefully', () => {
    // Test with missing highlight parameter
    const urlWithoutHighlight = '/map?lat=40.7128&lng=-74.006&zoom=16&tab=map';
    
    const Wrapper = createWrapper([urlWithoutHighlight]);
    const { result } = renderHook(() => useMapTabLogic(), { wrapper: Wrapper });

    expect(result.current.activeTab).toBe('map');
    expect(result.current.mapCenter).toEqual({ lat: 40.7128, lng: -74.006 });
    expect(result.current.highlightedGeocache).toBeNull();
  });

  it('should demonstrate the mobile behavior correctly', () => {
    // This is the exact URL that CacheMenu generates when "View in Map" is clicked
    const viewInMapUrl = generateViewInMapUrl(mockGeocache);
    
    const Wrapper = createWrapper([viewInMapUrl]);
    const { result } = renderHook(() => useMapTabLogic(), { wrapper: Wrapper });

    // On mobile, this should:
    // 1. Switch to the map tab (because tab=map is explicit)
    // 2. Center the map on the geocache location
    // 3. Highlight the specific geocache
    expect(result.current.activeTab).toBe('map');
    expect(result.current.mapCenter).toEqual({ 
      lat: mockGeocache.location.lat, 
      lng: mockGeocache.location.lng 
    });
    expect(result.current.highlightedGeocache).toBe(mockGeocache.dTag);
  });
});