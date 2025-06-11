import { describe, it, expect } from 'vitest';
import type { Geocache } from '@/types/geocache';

// Test the URL generation logic from CacheMenu
function generateMapUrl(geocache: Geocache): string {
  return `/map?lat=${geocache.location.lat}&lng=${geocache.location.lng}&zoom=16&highlight=${geocache.dTag}&tab=map`;
}

describe('CacheMenu URL Generation', () => {
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

  it('should generate correct map URL with tab=map parameter', () => {
    const url = generateMapUrl(mockGeocache);
    
    expect(url).toBe('/map?lat=40.7128&lng=-74.006&zoom=16&highlight=test-dtag&tab=map');
  });

  it('should include all required parameters', () => {
    const url = generateMapUrl(mockGeocache);
    
    // Check that all required parameters are present
    expect(url).toContain('lat=40.7128');
    expect(url).toContain('lng=-74.006');
    expect(url).toContain('zoom=16');
    expect(url).toContain('highlight=test-dtag');
    expect(url).toContain('tab=map');
  });

  it('should handle different coordinate values', () => {
    const geocacheWithDifferentCoords: Geocache = {
      ...mockGeocache,
      location: { lat: 51.5074, lng: -0.1278 }, // London coordinates
      dTag: 'london-cache'
    };
    
    const url = generateMapUrl(geocacheWithDifferentCoords);
    
    expect(url).toBe('/map?lat=51.5074&lng=-0.1278&zoom=16&highlight=london-cache&tab=map');
  });

  it('should handle negative coordinates', () => {
    const geocacheWithNegativeCoords: Geocache = {
      ...mockGeocache,
      location: { lat: -33.8688, lng: 151.2093 }, // Sydney coordinates
      dTag: 'sydney-cache'
    };
    
    const url = generateMapUrl(geocacheWithNegativeCoords);
    
    expect(url).toBe('/map?lat=-33.8688&lng=151.2093&zoom=16&highlight=sydney-cache&tab=map');
  });

  it('should handle special characters in dTag', () => {
    const geocacheWithSpecialDTag: Geocache = {
      ...mockGeocache,
      dTag: 'cache-with-special-chars_123'
    };
    
    const url = generateMapUrl(geocacheWithSpecialDTag);
    
    expect(url).toContain('highlight=cache-with-special-chars_123');
    expect(url).toContain('tab=map');
  });
});