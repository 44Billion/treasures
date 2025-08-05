import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAdaptiveReliableGeocaches } from '@/features/geocache/hooks/useReliableProximitySearch';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock geocache data WITH stats (simulating what useGeocaches returns after processing)
const mockGeocachesWithStats = [
  {
    id: 'test-id-1',
    dTag: 'test-dtag-1',
    pubkey: '0000000000000000000000000000000000000000000000000000000000000001',
    name: 'Test Cache 1',
    description: 'Test description 1',
    location: { lat: 40.7128, lng: -74.0060 },
    difficulty: 1,
    terrain: 1,
    size: 'small',
    type: 'traditional',
    created_at: 1234567890,
    // Stats that should be preserved
    foundCount: 5,
    logCount: 8,
    zapTotal: 1000,
  },
  {
    id: 'test-id-2',
    dTag: 'test-dtag-2',
    pubkey: '0000000000000000000000000000000000000000000000000000000000000002',
    name: 'Test Cache 2',
    description: 'Test description 2',
    location: { lat: 40.7589, lng: -73.9851 },
    difficulty: 2,
    terrain: 2,
    size: 'regular',
    type: 'multi',
    created_at: 1234567891,
    // Stats that should be preserved
    foundCount: 3,
    logCount: 4,
    zapTotal: 500,
  },
];

const mockFetchGeocaches = vi.fn().mockResolvedValue({
  success: true,
  data: mockGeocachesWithStats,
});

vi.mock('@/shared/stores/hooks', () => ({
  useGeocacheStoreContext: () => ({
    fetchGeocaches: mockFetchGeocaches,
  }),
}));

vi.mock('@nostrify/react', () => ({
  useNostr: () => ({
    nostr: {
      query: vi.fn().mockResolvedValue([]),
    },
  }),
}));

vi.mock('@/shared/stores/useZapStore', () => ({
  useZapStore: vi.fn(() => ({
    setZaps: vi.fn(),
  })),
}));

vi.mock('@/shared/utils/batchQuery', () => ({
  batchedQuery: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/shared/utils/wot', () => ({
  useIsWotEnabled: () => false,
  useWotStore: () => ({
    wotPubkeys: new Set(),
  }),
}));

vi.mock('@/features/auth/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    user: null,
  }),
}));

describe('Simple Stats Consistency Test', () => {
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

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );

  it('should preserve stats when passing geocaches from useGeocaches to useAdaptiveReliableGeocaches', async () => {
    // Test useAdaptiveReliableGeocaches with the pre-fetched data
    const { result } = renderHook(
      () => useAdaptiveReliableGeocaches({
        baseGeocaches: mockGeocachesWithStats,
        search: '',
      }),
      { wrapper }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
      expect(result.current.data).toHaveLength(2);
    });

    const adaptiveGeocaches = result.current.data;

    // Debug: log actual values
    console.log('DEBUG - Actual values received:', {
      firstCache: {
        name: adaptiveGeocaches[0]?.name,
        foundCount: adaptiveGeocaches[0]?.foundCount,
        logCount: adaptiveGeocaches[0]?.logCount,
        zapTotal: adaptiveGeocaches[0]?.zapTotal
      },
      secondCache: {
        name: adaptiveGeocaches[1]?.name,
        foundCount: adaptiveGeocaches[1]?.foundCount,
        logCount: adaptiveGeocaches[1]?.logCount,
        zapTotal: adaptiveGeocaches[1]?.zapTotal
      }
    });

    // Verify stats are preserved
    expect(adaptiveGeocaches[0]?.foundCount).toBe(5);
    expect(adaptiveGeocaches[0]?.logCount).toBe(8);
    expect(adaptiveGeocaches[0]?.zapTotal).toBe(1000);
    expect(adaptiveGeocaches[1]?.foundCount).toBe(3);
    expect(adaptiveGeocaches[1]?.logCount).toBe(4);
    expect(adaptiveGeocaches[1]?.zapTotal).toBe(500);

    // Verify other properties are preserved
    expect(adaptiveGeocaches[0]?.name).toBe('Test Cache 1');
    expect(adaptiveGeocaches[1]?.name).toBe('Test Cache 2');
    expect(adaptiveGeocaches[0]?.id).toBe('test-id-1');
    expect(adaptiveGeocaches[1]?.id).toBe('test-id-2');

    // Verify the store fetch was not called since we provided baseGeocaches
    expect(mockFetchGeocaches).not.toHaveBeenCalled();
  });

  it('should preserve stats when filtering in useAdaptiveReliableGeocaches', async () => {
    const { result } = renderHook(
      () => useAdaptiveReliableGeocaches({
        baseGeocaches: mockGeocachesWithStats,
        search: 'Test Cache 1', // Filter to only first cache
      }),
      { wrapper }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
      expect(result.current.data).toHaveLength(1);
    });

    const filteredGeocaches = result.current.data;

    // Verify stats are preserved in filtered results
    expect(filteredGeocaches[0]?.foundCount).toBe(5);
    expect(filteredGeocaches[0]?.logCount).toBe(8);
    expect(filteredGeocaches[0]?.zapTotal).toBe(1000);
    expect(filteredGeocaches[0]?.name).toBe('Test Cache 1');
  });

  it('should preserve stats when using proximity search', async () => {
    const { result } = renderHook(
      () => useAdaptiveReliableGeocaches({
        baseGeocaches: mockGeocachesWithStats,
        userLocation: { lat: 40.7128, lng: -74.0060 },
        searchRadius: 1, // Very small radius to only get first cache
        showNearMe: true,
      }),
      { wrapper }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
      expect(result.current.data).toHaveLength(1); // Only first cache should be within 1km
    });

    const proximityGeocaches = result.current.data;

    // Verify stats are preserved in proximity results
    expect(proximityGeocaches[0]?.foundCount).toBe(5);
    expect(proximityGeocaches[0]?.logCount).toBe(8);
    expect(proximityGeocaches[0]?.zapTotal).toBe(1000);
    expect(proximityGeocaches[0]?.name).toBe('Test Cache 1');
    
    // Verify distance is calculated
    expect(proximityGeocaches[0]?.distance).toBeDefined();
    expect(proximityGeocaches[0]?.distance).toBeLessThan(1);
  });

  it('should handle empty baseGeocaches gracefully', async () => {
    const { result } = renderHook(
      () => useAdaptiveReliableGeocaches({
        baseGeocaches: [],
        search: '',
      }),
      { wrapper }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
      expect(result.current.data).toHaveLength(0);
    });
  });
});