/**
 * Comprehensive tests for the redesigned reliable proximity search
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useReliableProximitySearch, useAdaptiveReliableGeocaches } from '@/features/geocache/hooks/useReliableProximitySearch';
import { NIP_GC_KINDS } from '@/features/geocache/utils/nip-gc';

// Mock Nostr events for testing
const mockGeocacheEvents = [
  {
    id: 'event1',
    pubkey: 'pubkey1',
    created_at: 1700000000,
    kind: NIP_GC_KINDS.GEOCACHE,
    content: 'A test geocache in Central Park',
    tags: [
      ['d', 'cache-1'],
      ['name', 'Central Park Cache'],
      ['g', 'dr5ru7vt'], // Central Park area, 8-char geohash
      ['difficulty', '2'],
      ['terrain', '1'],
      ['size', 'small'],
    ],
  },
  {
    id: 'event2',
    pubkey: 'pubkey2',
    created_at: 1700000100,
    kind: NIP_GC_KINDS.GEOCACHE,
    content: 'A test geocache near Times Square',
    tags: [
      ['d', 'cache-2'],
      ['name', 'Times Square Cache'],
      ['g', 'dr5ru4rs'], // Times Square area, 8-char geohash
      ['difficulty', '3'],
      ['terrain', '2'],
      ['size', 'regular'],
    ],
  },
  {
    id: 'event3',
    pubkey: 'pubkey3',
    created_at: 1700000200,
    kind: NIP_GC_KINDS.GEOCACHE,
    content: 'A test geocache in Brooklyn',
    tags: [
      ['d', 'cache-3'],
      ['name', 'Brooklyn Cache'],
      ['g', 'dr5refkd'], // Brooklyn area, 8-char geohash
      ['difficulty', '4'],
      ['terrain', '3'],
      ['size', 'large'],
    ],
  },
];

// Mock the Nostr hook
const mockNostrQuery = vi.fn();
vi.mock('@nostrify/react', () => ({
  useNostr: () => ({
    nostr: {
      query: mockNostrQuery,
    },
  }),
}));

// Mock other dependencies
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

describe('Reliable Proximity Search', () => {
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

  describe('Proximity Search Success', () => {
    it('should successfully find geocaches with proximity search', async () => {
      // Mock successful proximity search
      mockNostrQuery.mockResolvedValueOnce(mockGeocacheEvents);

      const { result } = renderHook(() => useReliableProximitySearch({
        centerLat: 40.7128, // NYC
        centerLng: -74.0060,
        radiusKm: 25,
        enableProximityOptimization: true,
      }), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toHaveLength(3);
      expect(result.current.searchStrategy).toBe('proximity');
      expect(result.current.proximityAttempted).toBe(true);
      expect(result.current.proximitySuccessful).toBe(true);
      expect(result.current.totalFound).toBe(3);

      // Verify the query was called with geohash patterns
      expect(mockNostrQuery).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            kinds: [NIP_GC_KINDS.GEOCACHE],
            '#g': expect.any(Array),
          })
        ]),
        expect.any(Object)
      );
    });

    it('should calculate distances correctly for proximity results', async () => {
      mockNostrQuery.mockResolvedValueOnce(mockGeocacheEvents);

      const { result } = renderHook(() => useReliableProximitySearch({
        centerLat: 40.7128,
        centerLng: -74.0060,
        radiusKm: 25,
        enableProximityOptimization: true,
      }), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // All results should have distance calculated
      result.current.data.forEach(cache => {
        expect(cache.distance).toBeDefined();
        expect(typeof cache.distance).toBe('number');
        expect(cache.distance!).toBeGreaterThan(0);
        expect(cache.distance!).toBeLessThanOrEqual(25);
      });

      // Results should be sorted by distance
      const distances = result.current.data.map(c => c.distance!);
      for (let i = 1; i < distances.length; i++) {
        expect(distances[i]).toBeGreaterThanOrEqual(distances[i - 1]);
      }
    });
  });

  describe('Fallback Mechanism', () => {
    it('should fallback to broad search when proximity search fails', async () => {
      // Mock proximity search failure, then successful broad search
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

      expect(result.current.data).toHaveLength(3);
      expect(result.current.searchStrategy).toBe('fallback');
      expect(result.current.proximityAttempted).toBe(true);
      expect(result.current.proximitySuccessful).toBe(false);

      // Should have been called twice: proximity attempt + fallback
      expect(mockNostrQuery).toHaveBeenCalledTimes(2);
    });

    it('should fallback when proximity search returns no results', async () => {
      // Mock proximity search returning empty, then successful broad search
      mockNostrQuery
        .mockResolvedValueOnce([]) // Empty proximity results
        .mockResolvedValueOnce(mockGeocacheEvents); // Successful broad search

      const { result } = renderHook(() => useReliableProximitySearch({
        centerLat: 40.7128,
        centerLng: -74.0060,
        radiusKm: 25,
        enableProximityOptimization: true,
      }), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toHaveLength(3);
      expect(result.current.searchStrategy).toBe('fallback');
      expect(result.current.proximityAttempted).toBe(true);
      expect(result.current.proximitySuccessful).toBe(false);
    });
  });

  describe('Broad Search Only', () => {
    it('should use broad search when proximity is disabled', async () => {
      mockNostrQuery.mockResolvedValueOnce(mockGeocacheEvents);

      const { result } = renderHook(() => useReliableProximitySearch({
        centerLat: 40.7128,
        centerLng: -74.0060,
        radiusKm: 25,
        enableProximityOptimization: false,
      }), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toHaveLength(3);
      expect(result.current.searchStrategy).toBe('broad');
      expect(result.current.proximityAttempted).toBe(false);
      expect(result.current.proximitySuccessful).toBe(false);

      // Should only be called once for broad search
      expect(mockNostrQuery).toHaveBeenCalledTimes(1);
      expect(mockNostrQuery).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            kinds: [NIP_GC_KINDS.GEOCACHE],
            // Should NOT have #g filter
          })
        ]),
        expect.any(Object)
      );
    });

    it('should use broad search when no proximity parameters provided', async () => {
      mockNostrQuery.mockResolvedValueOnce(mockGeocacheEvents);

      const { result } = renderHook(() => useReliableProximitySearch({
        // No centerLat, centerLng, or radiusKm
      }), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.searchStrategy).toBe('broad');
      expect(result.current.proximityAttempted).toBe(false);
    });
  });

  describe('Client-side Filtering', () => {
    it('should apply text search filter', async () => {
      mockNostrQuery.mockResolvedValueOnce(mockGeocacheEvents);

      const { result } = renderHook(() => useReliableProximitySearch({
        search: 'Central Park',
      }), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toHaveLength(1);
      expect(result.current.data[0].name).toBe('Central Park Cache');
    });

    it('should apply difficulty filter', async () => {
      mockNostrQuery.mockResolvedValueOnce(mockGeocacheEvents);

      const { result } = renderHook(() => useReliableProximitySearch({
        difficulty: 3,
        difficultyOperator: 'gte',
      }), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should find caches with difficulty >= 3 (Times Square: 3, Brooklyn: 4)
      expect(result.current.data).toHaveLength(2);
      expect(result.current.data.every(c => c.difficulty >= 3)).toBe(true);
    });

    it('should apply radius filter in client-side processing', async () => {
      mockNostrQuery.mockResolvedValueOnce(mockGeocacheEvents);

      const { result } = renderHook(() => useReliableProximitySearch({
        centerLat: 40.7128,
        centerLng: -74.0060,
        radiusKm: 5, // Very small radius
        enableProximityOptimization: true,
      }), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should filter out caches that are too far away
      result.current.data.forEach(cache => {
        expect(cache.distance!).toBeLessThanOrEqual(5);
      });
    });
  });

  describe('Adaptive Hook', () => {
    it('should enable proximity search when user location and showNearMe are provided', async () => {
      mockNostrQuery.mockResolvedValueOnce(mockGeocacheEvents);

      const { result } = renderHook(() => useAdaptiveReliableGeocaches({
        userLocation: { lat: 40.7128, lng: -74.0060 },
        showNearMe: true,
        searchRadius: 25,
      }), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.proximityAttempted).toBe(true);
    });

    it('should use search location over user location', async () => {
      mockNostrQuery.mockResolvedValueOnce(mockGeocacheEvents);

      const { result } = renderHook(() => useAdaptiveReliableGeocaches({
        userLocation: { lat: 40.0, lng: -74.0 },
        searchLocation: { lat: 40.7128, lng: -74.0060 },
        searchRadius: 25,
      }), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.proximityAttempted).toBe(true);
      // The search should use searchLocation, not userLocation
    });
  });

  describe('Error Handling', () => {
    it('should handle complete search failure gracefully', async () => {
      mockNostrQuery.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useReliableProximitySearch({
        centerLat: 40.7128,
        centerLng: -74.0060,
        radiusKm: 25,
      }), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toHaveLength(0);
      expect(result.current.error).toBeDefined();
    });

    it('should provide debug information in development', async () => {
      // Mock development environment
      const originalEnv = import.meta.env.DEV;
      (import.meta.env as any).DEV = true;

      mockNostrQuery.mockResolvedValueOnce(mockGeocacheEvents);

      const { result } = renderHook(() => useReliableProximitySearch({
        centerLat: 40.7128,
        centerLng: -74.0060,
        radiusKm: 25,
        enableProximityOptimization: true,
      }), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.debugInfo).toBeDefined();
      expect(result.current.debugInfo).toHaveProperty('geohashPatterns');

      // Restore environment
      (import.meta.env as any).DEV = originalEnv;
    });
  });
});