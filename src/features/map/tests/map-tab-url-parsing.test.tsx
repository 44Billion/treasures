import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useSearchParams } from 'react-router-dom';
import { useState, useEffect } from 'react';

// Test the URL parsing logic in isolation
function useMapTabLogic() {
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<string>("list");

  // Replicate the exact logic from Map.tsx
  useEffect(() => {
    const lat = searchParams.get('lat');
    const lng = searchParams.get('lng');
    const tab = searchParams.get('tab');

    // Handle tab switching logic
    if (tab && (tab === 'list' || tab === 'map')) {
      // Explicit tab parameter takes priority
      setActiveTab(tab);
    } else if (lat && lng) {
      // If coordinates are provided but no valid tab, switch to map tab on mobile
      setActiveTab('map');
    }
  }, [searchParams]);

  return { activeTab };
}

const createWrapper = (initialEntries: string[] = ['/map']) => {
  return ({ children }: { children: React.ReactNode }) => (
    <MemoryRouter initialEntries={initialEntries}>
      {children}
    </MemoryRouter>
  );
};

describe('Map Tab URL Parsing Logic', () => {
  it('should set map tab when tab=map parameter is provided', () => {
    const Wrapper = createWrapper(['/map?lat=40.7128&lng=-74.0060&zoom=16&highlight=test-cache&tab=map']);
    
    const { result } = renderHook(() => useMapTabLogic(), { wrapper: Wrapper });
    
    expect(result.current.activeTab).toBe('map');
  });

  it('should set list tab when tab=list parameter is provided', () => {
    const Wrapper = createWrapper(['/map?lat=40.7128&lng=-74.0060&zoom=16&highlight=test-cache&tab=list']);
    
    const { result } = renderHook(() => useMapTabLogic(), { wrapper: Wrapper });
    
    expect(result.current.activeTab).toBe('list');
  });

  it('should set map tab when coordinates are provided without explicit tab parameter', () => {
    const Wrapper = createWrapper(['/map?lat=40.7128&lng=-74.0060&zoom=16&highlight=test-cache']);
    
    const { result } = renderHook(() => useMapTabLogic(), { wrapper: Wrapper });
    
    expect(result.current.activeTab).toBe('map');
  });

  it('should default to list tab when no coordinates or tab parameter are provided', () => {
    const Wrapper = createWrapper(['/map']);
    
    const { result } = renderHook(() => useMapTabLogic(), { wrapper: Wrapper });
    
    expect(result.current.activeTab).toBe('list');
  });

  it('should prioritize explicit tab parameter over coordinate-based logic', () => {
    const Wrapper = createWrapper(['/map?lat=40.7128&lng=-74.0060&tab=list']);
    
    const { result } = renderHook(() => useMapTabLogic(), { wrapper: Wrapper });
    
    expect(result.current.activeTab).toBe('list');
  });

  it('should handle only lat parameter (no lng) by defaulting to list', () => {
    const Wrapper = createWrapper(['/map?lat=40.7128']);
    
    const { result } = renderHook(() => useMapTabLogic(), { wrapper: Wrapper });
    
    expect(result.current.activeTab).toBe('list');
  });

  it('should handle only lng parameter (no lat) by defaulting to list', () => {
    const Wrapper = createWrapper(['/map?lng=-74.0060']);
    
    const { result } = renderHook(() => useMapTabLogic(), { wrapper: Wrapper });
    
    expect(result.current.activeTab).toBe('list');
  });

  it('should ignore invalid tab values', () => {
    const Wrapper = createWrapper(['/map?lat=40.7128&lng=-74.0060&tab=invalid']);
    
    const { result } = renderHook(() => useMapTabLogic(), { wrapper: Wrapper });
    
    // Should fall back to coordinate-based logic since tab is invalid
    expect(result.current.activeTab).toBe('map');
  });
});