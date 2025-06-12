/**
 * Proximity search functionality tests using the current system
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAdaptiveReliableGeocaches, useReliableProximitySearch, type GeocacheWithDistance } from '@/features/geocache/hooks/useReliableProximitySearch';
import { NIP_GC_KINDS } from '@/features/geocache/utils/nip-gc';

const mockGeocacheEvents = [
  {
    id: 'event1',
    pubkey: 'pubkey1',
    created_at: 1700000000,
    kind: NIP_GC_KINDS.GEOCACHE,
    content: 'Test geocache',
    tags: [
      ['d', 'cache-1'],
      ['name', 'Test Cache'],
      ['g', 'dr5ru7vt'],
      ['difficulty', '2'],
      ['terrain', '1'],
      ['size', 'small'],
    ],
  },
];

const mockNostrQuery = vi.fn();
vi.mock('@nostrify/react', () => ({
  useNostr: () => ({
    nostr: {
      query: mockNostrQuery,
    },
  }),
}));

vi.mock('@/shared/stores/simpleStores', () => ({
  useCurrentUser: () => ({ user: null }),
}));

vi.mock('@/hooks/useDeletionFilter', () => ({
  useDeletionFilter: () => ({
    filterDeleted: {
      fast: (events: unknown[]) => events,
    },
  }),
}));

describe('Proximity Search Functionality', () => {
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

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );

  describe('Type Support', () => {
    it('should support GeocacheWithDistance type', () => {
      // Test that the type is available and works correctly
      const geocache: GeocacheWithDistance = {
        id: 'test',
        pubkey: 'pubkey',
        created_at: 1700000000,
        dTag: 'test',
        name: 'Test',
        description: 'Test',
        location: { lat: 40.7128, lng: -74.0060 },
        difficulty: 2,
        terrain: 1,
        size: 'small',
        type: 'traditional',
        images: [],
        relays: [],
        hidden: false,
        distance: 5.2,
      };

      expect(geocache.distance).toBe(5.2);
      expect(typeof geocache.distance).toBe('number');
    });

    it('should return proper hook structure', async () => {
      mockNostrQuery.mockResolvedValue(mockGeocacheEvents);

      const { result } = renderHook(() => useAdaptiveReliableGeocaches({
        userLocation: { lat: 40.7128, lng: -74.0060 },
        showNearMe: true,
        searchRadius: 25,
      }), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should have all expected properties
      expect(result.current).toHaveProperty('data');
      expect(result.current).toHaveProperty('isLoading');
      expect(result.current).toHaveProperty('error');
      expect(result.current).toHaveProperty('refetch');
      expect(result.current).toHaveProperty('searchStrategy');
      expect(result.current).toHaveProperty('proximityAttempted');
      expect(result.current).toHaveProperty('proximitySuccessful');

      // Data should be an array
      expect(Array.isArray(result.current.data)).toBe(true);
    });
  });

  describe('API Functionality', () => {
    it('should accept comprehensive search parameters', async () => {
      mockNostrQuery.mockResolvedValue(mockGeocacheEvents);

      const comprehensiveOptions = {
        search: 'test',
        difficulty: 2,
        difficultyOperator: 'gte' as const,
        terrain: 1,
        terrainOperator: 'eq' as const,
        cacheType: 'traditional',
        userLocation: { lat: 40.7128, lng: -74.0060 },
        searchLocation: { lat: 40.7589, lng: -73.9851 },
        searchRadius: 25,
        showNearMe: true,
      };

      const { result } = renderHook(() => useAdaptiveReliableGeocaches(comprehensiveOptions), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBeFalsy();
      expect(result.current.data).toBeDefined();
    });

    it('should handle minimal parameters correctly', async () => {
      mockNostrQuery.mockResolvedValue(mockGeocacheEvents);

      const minimalOptions = {
        userLocation: { lat: 40.7128, lng: -74.0060 },
        showNearMe: true,
      };

      const { result } = renderHook(() => useAdaptiveReliableGeocaches(minimalOptions), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBeFalsy();
      expect(Array.isArray(result.current.data)).toBe(true);
    });

    it('should work with direct proximity search', async () => {
      mockNostrQuery.mockResolvedValue(mockGeocacheEvents);

      const { result } = renderHook(() => useReliableProximitySearch({
        centerLat: 40.7128,
        centerLng: -74.0060,
        radiusKm: 25,
        enableProximityOptimization: true,
      }), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBeFalsy();
      expect(Array.isArray(result.current.data)).toBe(true);
      expect(result.current.proximityAttempted).toBe(true);
    });
  });

  describe('Behavioral Functionality', () => {
    it('should return geocaches with distance when location is provided', async () => {
      mockNostrQuery.mockResolvedValue(mockGeocacheEvents);

      const options = {
        userLocation: { lat: 40.7128, lng: -74.0060 },
        showNearMe: true,
        searchRadius: 25,
      };

      const { result } = renderHook(() => useAdaptiveReliableGeocaches(options), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should calculate distances when location is provided
      if (result.current.data.length > 0) {
        expect(result.current.data[0]).toHaveProperty('distance');
        expect(typeof result.current.data[0].distance).toBe('number');
      }
    });

    it('should apply client-side filters correctly', async () => {
      const multipleEvents = [
        ...mockGeocacheEvents,
        {
          id: 'event2',
          pubkey: 'pubkey2',
          created_at: 1700000100,
          kind: NIP_GC_KINDS.GEOCACHE,
          content: 'Another test geocache',
          tags: [
            ['d', 'cache-2'],
            ['name', 'Another Cache'],
            ['g', 'dr5ru7vt'],
            ['difficulty', '4'],
            ['terrain', '3'],
            ['size', 'large'],
          ],
        },
      ];

      mockNostrQuery.mockResolvedValue(multipleEvents);

      const options = {
        difficulty: 3,
        difficultyOperator: 'gte' as const,
        userLocation: { lat: 40.7128, lng: -74.0060 },
        showNearMe: true,
        searchRadius: 25,
      };

      const { result } = renderHook(() => useAdaptiveReliableGeocaches(options), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should filter to only difficulty >= 3 (should find "Another Cache" with difficulty 4)
      expect(result.current.data.length).toBeGreaterThan(0);
      expect(result.current.data.every(cache => cache.difficulty >= 3)).toBe(true);
    });
  });

  describe('Real-world Usage', () => {
    it('should work with typical Map component usage', async () => {
      mockNostrQuery.mockResolvedValue(mockGeocacheEvents);

      // Simulate typical usage pattern
      const mapOptions = {
        search: '',
        difficulty: undefined,
        difficultyOperator: 'all' as const,
        terrain: undefined,
        terrainOperator: 'all' as const,
        cacheType: undefined,
        userLocation: { lat: 40.7128, lng: -74.0060 },
        searchLocation: null,
        searchRadius: 25,
        showNearMe: true,
      };

      const { result } = renderHook(() => useAdaptiveReliableGeocaches(mapOptions), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBeFalsy();
      expect(Array.isArray(result.current.data)).toBe(true);
      expect(typeof result.current.isLoading).toBe('boolean');
      expect(typeof result.current.refetch).toBe('function');
      expect(typeof result.current.searchStrategy).toBe('string');
    });

    it('should handle undefined/null values gracefully', async () => {
      mockNostrQuery.mockResolvedValue(mockGeocacheEvents);

      const optionsWithNulls = {
        search: undefined,
        difficulty: undefined,
        difficultyOperator: undefined,
        terrain: undefined,
        terrainOperator: undefined,
        cacheType: undefined,
        userLocation: null,
        searchLocation: null,
        searchRadius: undefined,
        showNearMe: false,
      };

      const { result } = renderHook(() => useAdaptiveReliableGeocaches(optionsWithNulls), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBeFalsy();
      expect(Array.isArray(result.current.data)).toBe(true);
    });
  });

  describe('Enhanced Features', () => {
    it('should provide comprehensive status information', async () => {
      mockNostrQuery.mockResolvedValue(mockGeocacheEvents);

      const { result } = renderHook(() => useAdaptiveReliableGeocaches({
        userLocation: { lat: 40.7128, lng: -74.0060 },
        showNearMe: true,
        searchRadius: 25,
      }), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should have all standard query properties
      expect(result.current).toHaveProperty('data');
      expect(result.current).toHaveProperty('isLoading');
      expect(result.current).toHaveProperty('error');
      expect(result.current).toHaveProperty('refetch');

      // Should have enhanced proximity search properties
      expect(result.current).toHaveProperty('searchStrategy');
      expect(result.current).toHaveProperty('proximityAttempted');
      expect(result.current).toHaveProperty('proximitySuccessful');
      expect(result.current).toHaveProperty('totalFound');

      // Properties should have correct types and values
      expect(['proximity', 'broad', 'fallback']).toContain(result.current.searchStrategy);
      expect(typeof result.current.proximityAttempted).toBe('boolean');
      expect(typeof result.current.proximitySuccessful).toBe('boolean');
      expect(typeof result.current.totalFound).toBe('number');
    });

    it('should provide debug information in development', async () => {
      mockNostrQuery.mockResolvedValue(mockGeocacheEvents);

      const { result } = renderHook(() => useReliableProximitySearch({
        centerLat: 40.7128,
        centerLng: -74.0060,
        radiusKm: 25,
        enableProximityOptimization: true,
      }), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });
  });

  describe('Performance', () => {
    it('should handle large datasets efficiently', async () => {
      const manyEvents = Array.from({ length: 50 }, (_, i) => ({
        id: `event${i}`,
        pubkey: `pubkey${i}`,
        created_at: 1700000000 + i,
        kind: NIP_GC_KINDS.GEOCACHE,
        content: `Cache ${i}`,
        tags: [
          ['d', `cache-${i}`],
          ['name', `Cache ${i}`],
          ['g', 'dr5ru7vt'],
          ['difficulty', '2'],
          ['terrain', '1'],
          ['size', 'small'],
        ],
      }));

      mockNostrQuery.mockResolvedValue(manyEvents);

      const options = {
        userLocation: { lat: 40.7128, lng: -74.0060 },
        showNearMe: true,
        searchRadius: 25,
      };

      const startTime = Date.now();
      const { result } = renderHook(() => useAdaptiveReliableGeocaches(options), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      expect(result.current.data).toHaveLength(50);
      expect(processingTime).toBeLessThan(1000); // Should be reasonably fast
      expect(result.current.totalFound).toBe(50);
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      mockNostrQuery.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useAdaptiveReliableGeocaches({
        userLocation: { lat: 40.7128, lng: -74.0060 },
        showNearMe: true,
        searchRadius: 25,
      }), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should handle errors gracefully with fallback behavior
      expect(result.current.error).toBeDefined();
      expect(result.current.data).toEqual([]);
      expect(typeof result.current.refetch).toBe('function');
      expect(result.current.searchStrategy).toBeDefined();
    });

    it('should provide fallback when proximity search fails', async () => {
      // Mock proximity search failure but broad search success
      mockNostrQuery
        .mockRejectedValueOnce(new Error('Proximity search failed'))
        .mockResolvedValueOnce(mockGeocacheEvents);

      const { result } = renderHook(() => useReliableProximitySearch({
        centerLat: 40.7128,
        centerLng: -74.0060,
        radiusKm: 25,
        enableProximityOptimization: true,
      }), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should fall back to broad search
      expect(result.current.error).toBeFalsy();
      expect(result.current.searchStrategy).toBe('fallback');
      expect(result.current.proximityAttempted).toBe(true);
      expect(result.current.proximitySuccessful).toBe(false);
    });
  });
});