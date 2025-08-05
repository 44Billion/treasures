import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useGeocaches } from '@/features/geocache/hooks/useGeocaches';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock many geocaches to test stats loading beyond 10
const mockManyGeocaches = Array.from({ length: 15 }, (_, i) => ({
  id: `test-id-${i}`,
  dTag: `test-dtag-${i}`,
  pubkey: '0000000000000000000000000000000000000000000000000000000000000001',
  name: `Test Cache ${i + 1}`,
  description: `Test description ${i + 1}`,
  location: { lat: 40.7128 + (i * 0.01), lng: -74.0060 + (i * 0.01) },
  difficulty: 1,
  terrain: 1,
  size: 'small',
  type: 'traditional',
  created_at: 1234567890 + i,
  zapTotal: 0, // Add zapTotal property
}));

const mockFetchGeocaches = vi.fn().mockResolvedValue({
  success: true,
  data: mockManyGeocaches,
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
  batchedQuery: vi.fn().mockImplementation(async (_nostr, filters, batchSize, _signal) => {
    console.log('Mock batchedQuery called with:', {
      filterCount: filters.length,
      batchSize,
      filters: filters.map((f: { kinds: any; limit: any; }) => ({ kinds: f.kinds, limit: f.limit }))
    });
    
    // Mock some log events for first 12 geocaches (to test the limit issue)
    const mockEvents = [];
    
    // Only add events for first 12 geocaches to simulate the limit issue
    for (let i = 0; i < 12; i++) {
      // Add found log
      mockEvents.push({
        id: `found-log-${i}`,
        kind: 7001,
        pubkey: `user-${i}`,
        tags: [['a', `30309:0000000000000000000000000000000000000000000000000000000000000001:test-dtag-${i}`]],
        created_at: 1234567891 + i,
      });
      
      // Add comment log
      mockEvents.push({
        id: `comment-log-${i}`,
        kind: 7002,
        pubkey: `user-${i}`,
        tags: [['a', `30309:0000000000000000000000000000000000000000000000000000000000000001:test-dtag-${i}`]],
        created_at: 1234567892 + i,
      });
    }
    
    return mockEvents;
  }),
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

describe('Stats Loading Test', () => {
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

  it('should load stats for all geocaches, not just first 10', async () => {
    const { result } = renderHook(() => useGeocaches(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
      expect(result.current.data).toHaveLength(15);
    });

    const geocachesWithStats = result.current.data;

    // Log the actual stats to see what's happening
    console.log('📊 Stats loading results:', {
      totalGeocaches: geocachesWithStats.length,
      geocachesWithStats: geocachesWithStats.map((g, i) => ({
        index: i,
        name: g.name,
        foundCount: g.foundCount,
        logCount: g.logCount,
        zapTotal: g.zapTotal
      }))
    });

    // First 12 should have stats (since we mocked events for them)
    for (let i = 0; i < 12; i++) {
      expect(geocachesWithStats[i]?.foundCount).toBe(1);
      expect(geocachesWithStats[i]?.logCount).toBe(2);
    }

    // Last 3 should have zero stats (no events mocked for them)
    for (let i = 12; i < 15; i++) {
      expect(geocachesWithStats[i]?.foundCount).toBe(0);
      expect(geocachesWithStats[i]?.logCount).toBe(0);
    }

    // Verify that batchedQuery was called with consolidated filters
    const { batchedQuery } = await import('@/shared/utils/batchQuery');
    expect(batchedQuery).toHaveBeenCalled();
    
    // Check that it was called with 3 filters (found logs, comment logs, zaps) not 45 filters (15 geocaches * 3)
    const batchedQueryCall = (batchedQuery as any).mock.calls[0];
    expect(batchedQueryCall[1]).toHaveLength(3); // Should have 3 consolidated filters
  });

  it('should handle large numbers of geocaches efficiently', async () => {
    // Test with even more geocaches
    const mockLotsOfGeocaches = Array.from({ length: 50 }, (_, i) => ({
      ...mockManyGeocaches[0],
      id: `test-id-${i}`,
      dTag: `test-dtag-${i}`,
      name: `Test Cache ${i + 1}`,
    }));

    mockFetchGeocaches.mockResolvedValue({
      success: true,
      data: mockLotsOfGeocaches,
    });

    const { result } = renderHook(() => useGeocaches(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
      expect(result.current.data).toHaveLength(50);
    });

    // Should still complete without timeout
    expect(result.current.isError).toBe(false);
  });
});