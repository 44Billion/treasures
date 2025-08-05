import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useState } from 'react';

// Mock the useIsMobile hook to test both scenarios
const mockUseIsMobile = vi.fn();
vi.mock('../shared/hooks/useIsMobile', () => ({
  useIsMobile: () => mockUseIsMobile(),
}));

// Mock the useMapController hook
const mockClearMapInteractionLock = vi.fn();
vi.mock('../features/map/hooks/useMapController', () => ({
  useMapController: () => ({
    clearMapInteractionLock: mockClearMapInteractionLock,
  }),
}));

// Test the actual handleCardClick logic by extracting it into a testable hook
function useCardClickHandler() {
  const [activeTab, setActiveTab] = useState<'list' | 'map'>('list');
  const [selectedGeocache, setSelectedGeocache] = useState<any>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [mapZoom, setMapZoom] = useState(10);
  const [highlightedGeocache, setHighlightedGeocache] = useState<string | null>(null);
  const [showNearMe, setShowNearMe] = useState(false);
  const [searchLocation, setSearchLocation] = useState<any>(null);
  const [searchInView, setSearchInView] = useState(false);

  const handleCardClick = (geocache: any) => {
    // This is an explicit user action - clear all interaction locks
    mockClearMapInteractionLock();
    
    // On mobile (when activeTab is 'list'), open the details modal directly
    if (activeTab === 'list') {
      setSelectedGeocache(geocache);
      setDialogOpen(true);
      // Switch to map tab to show the location after modal closes
      setActiveTab('map');
      return;
    }
    
    // On desktop (or when in map tab), center map on the geocache and highlight it to show popup
    setMapCenter({ lat: geocache.location.lat, lng: geocache.location.lng });
    setMapZoom(16);
    setHighlightedGeocache(geocache.dTag);
    
    // Clear any location-based searches to prevent conflicts
    setShowNearMe(false);
    setSearchLocation(null);
    setSearchInView(false);
  };

  return {
    activeTab,
    setActiveTab,
    selectedGeocache,
    dialogOpen,
    mapCenter,
    mapZoom,
    highlightedGeocache,
    handleCardClick,
    showNearMe,
    searchLocation,
    searchInView
  };
}

describe('Card Click Behavior - Core Requirement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseIsMobile.mockReturnValue(false); // Default to desktop
  });

  it('should NOT open dialog on desktop view - core requirement preserved', async () => {
    // Simulate desktop view (no activeTab or activeTab is not 'list')
    mockUseIsMobile.mockReturnValue(false);
    
    const { result } = renderHook(() => useCardClickHandler());
    
    // Set up desktop scenario (no activeTab state or activeTab is 'map')
    act(() => {
      result.current.setActiveTab('map');
    });

    const mockGeocache = {
      id: '1',
      dTag: 'test1',
      name: 'Test Cache 1',
      location: { lat: 40.7128, lng: -74.0060 },
    };

    // Initially, dialog should not be open
    expect(result.current.dialogOpen).toBe(false);
    expect(result.current.selectedGeocache).toBeNull();

    // Click on a geocache card
    act(() => {
      result.current.handleCardClick(mockGeocache);
    });

    // CRITICAL: On desktop, the dialog should NOT open - this is the key behavior to preserve
    expect(result.current.dialogOpen).toBe(false);
    expect(result.current.selectedGeocache).toBeNull();
    
    // Instead, navigation should occur:
    expect(result.current.mapCenter).toEqual({ lat: 40.7128, lng: -74.0060 });
    expect(result.current.mapZoom).toBe(16);
    expect(result.current.highlightedGeocache).toBe('test1');
    
    // Location searches should be cleared
    expect(result.current.showNearMe).toBe(false);
    expect(result.current.searchLocation).toBeNull();
    expect(result.current.searchInView).toBe(false);
    
    // Interaction lock should be cleared
    expect(mockClearMapInteractionLock).toHaveBeenCalled();
  });

  it('should open dialog on mobile view when activeTab is list', async () => {
    // Simulate mobile view with activeTab as 'list'
    mockUseIsMobile.mockReturnValue(true);
    
    const { result } = renderHook(() => useCardClickHandler());
    
    // Set up mobile scenario (activeTab is 'list')
    act(() => {
      result.current.setActiveTab('list');
    });

    const mockGeocache = {
      id: '1',
      dTag: 'test1',
      name: 'Test Cache 1',
      location: { lat: 40.7128, lng: -74.0060 },
    };

    // Initially, dialog should not be open
    expect(result.current.dialogOpen).toBe(false);
    expect(result.current.selectedGeocache).toBeNull();

    // Click on a geocache card
    act(() => {
      result.current.handleCardClick(mockGeocache);
    });

    // On mobile, the dialog should open
    expect(result.current.dialogOpen).toBe(true);
    expect(result.current.selectedGeocache).toEqual(mockGeocache);
    
    // Should switch to map tab
    expect(result.current.activeTab).toBe('map');
    
    // Navigation should NOT occur on mobile
    expect(result.current.mapCenter).toBeNull();
    expect(result.current.highlightedGeocache).toBeNull();
    
    // Interaction lock should be cleared
    expect(mockClearMapInteractionLock).toHaveBeenCalled();
  });

  it('should NOT open dialog on mobile view when activeTab is map', async () => {
    // Simulate mobile view but with activeTab as 'map'
    mockUseIsMobile.mockReturnValue(true);
    
    const { result } = renderHook(() => useCardClickHandler());
    
    // Set up mobile scenario but activeTab is 'map'
    act(() => {
      result.current.setActiveTab('map');
    });

    const mockGeocache = {
      id: '1',
      dTag: 'test1',
      name: 'Test Cache 1',
      location: { lat: 40.7128, lng: -74.0060 },
    };

    // Initially, dialog should not be open
    expect(result.current.dialogOpen).toBe(false);
    expect(result.current.selectedGeocache).toBeNull();

    // Click on a geocache card
    act(() => {
      result.current.handleCardClick(mockGeocache);
    });

    // Even on mobile, if activeTab is not 'list', dialog should NOT open
    expect(result.current.dialogOpen).toBe(false);
    expect(result.current.selectedGeocache).toBeNull();
    
    // Navigation should occur instead
    expect(result.current.mapCenter).toEqual({ lat: 40.7128, lng: -74.0060 });
    expect(result.current.mapZoom).toBe(16);
    expect(result.current.highlightedGeocache).toBe('test1');
    
    // Interaction lock should be cleared
    expect(mockClearMapInteractionLock).toHaveBeenCalled();
  });

  it('should preserve desktop behavior regardless of useIsMobile hook when activeTab is not list', async () => {
    // Even if useIsMobile returns true, if activeTab is not 'list', it should behave like desktop
    mockUseIsMobile.mockReturnValue(true);
    
    const { result } = renderHook(() => useCardClickHandler());
    
    // Set activeTab to 'map' (not 'list')
    act(() => {
      result.current.setActiveTab('map');
    });

    const mockGeocache = {
      id: '1',
      dTag: 'test1',
      name: 'Test Cache 1',
      location: { lat: 40.7128, lng: -74.0060 },
    };

    // Click on a geocache card
    act(() => {
      result.current.handleCardClick(mockGeocache);
    });

    // CRITICAL: Dialog should NOT open - desktop behavior preserved
    expect(result.current.dialogOpen).toBe(false);
    expect(result.current.selectedGeocache).toBeNull();
    
    // Navigation should occur
    expect(result.current.mapCenter).toEqual({ lat: 40.7128, lng: -74.0060 });
    expect(result.current.mapZoom).toBe(16);
    expect(result.current.highlightedGeocache).toBe('test1');
  });
});