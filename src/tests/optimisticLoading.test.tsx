import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useOptimisticGeocaches } from '@/features/geocache/hooks/useOptimisticGeocaches';
import { QUERY_LIMITS } from '@/shared/config';

// Mock the dependencies
vi.mock('@nostrify/react', () => ({
  useNostr: () => ({
    nostr: {
      query: vi.fn().mockResolvedValue([
        {
          id: 'test-event-1',
          pubkey: 'test-pubkey-1',
          created_at: Date.now() / 1000,
          kind: 37515,
          tags: [
            ['d', 'test-cache-1'],
            ['name', 'Test Cache 1'],
            ['g', 'u4pruydqqvj'],
            ['difficulty', '2'],
            ['terrain', '3'],
            ['size', 'regular'],
            ['type', 'traditional'],
          ],
          content: JSON.stringify({
            description: 'A test geocache',
            hint: 'Look for the obvious',
          }),
          sig: 'test-sig-1',
        },
        {
          id: 'test-event-2',
          pubkey: 'test-pubkey-2',
          created_at: Date.now() / 1000,
          kind: 37515,
          tags: [
            ['d', 'test-cache-2'],
            ['name', 'Test Cache 2'],
            ['g', 'u4pruydqqvk'],
            ['difficulty', '3'],
            ['terrain', '2'],
            ['size', 'small'],
            ['type', 'mystery'],
          ],
          content: JSON.stringify({
            description: 'Another test geocache',
            hint: 'Think outside the box',
          }),
          sig: 'test-sig-2',
        },
      ]),
    },
  }),
}));

vi.mock('@/shared/stores/simpleStores', () => ({
  useCurrentUser: () => ({ user: null }),
}));

vi.mock('@/hooks/usePerformanceOptimization', () => ({
  usePerformanceOptimization: () => ({
    warmCache: vi.fn(),
  }),
}));

describe('useOptimisticGeocaches', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it('should load geocaches optimistically', async () => {
    const { result } = renderHook(
      () => useOptimisticGeocaches({ fastInitialLoad: true }),
      { wrapper }
    );

    // Initially loading
    expect(result.current.isLoading).toBe(true);
    expect(result.current.geocaches).toEqual([]);
    expect(result.current.hasInitialData).toBe(false);

    // Wait for data to load
    await waitFor(() => {
      expect(result.current.hasInitialData).toBe(true);
    });

    // Should have loaded geocaches
    expect(result.current.geocaches.length).toBeGreaterThan(0);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.geocaches[0]).toHaveProperty('name');
    expect(result.current.geocaches[0]).toHaveProperty('difficulty');
  });

  it('should handle fast initial load correctly', async () => {
    const { result } = renderHook(
      () => useOptimisticGeocaches({ 
        fastInitialLoad: true,
        staleWhileRevalidate: true 
      }),
      { wrapper }
    );

    await waitFor(() => {
      expect(result.current.hasInitialData).toBe(true);
    });

    // Should show data quickly
    expect(result.current.geocaches.length).toBeGreaterThan(0);
    
    // May be stale while full data loads
    expect(typeof result.current.isStale).toBe('boolean');
  });

  it('should provide refresh functionality', async () => {
    const { result } = renderHook(
      () => useOptimisticGeocaches(),
      { wrapper }
    );

    await waitFor(() => {
      expect(result.current.hasInitialData).toBe(true);
    });

    // Should have refresh function
    expect(typeof result.current.refresh).toBe('function');
    
    // Should be able to call refresh without error
    await expect(result.current.refresh()).resolves.not.toThrow();
  });

  it('should limit geocaches for home page', async () => {
    const { useHomePageGeocaches } = await import('@/hooks/useOptimisticGeocaches');
    
    const { result } = renderHook(
      () => useHomePageGeocaches(),
      { wrapper }
    );

    await waitFor(() => {
      expect(result.current.hasInitialData).toBe(true);
    });

    // Should limit to home page limit
    expect(result.current.geocaches.length).toBeLessThanOrEqual(QUERY_LIMITS.HOME_PAGE_LIMIT);
  });

  it('should handle errors gracefully', async () => {
    // Mock error
    vi.mocked(require('@nostrify/react').useNostr).mockReturnValue({
      nostr: {
        query: vi.fn().mockRejectedValue(new Error('Network error')),
      },
    });

    const { result } = renderHook(
      () => useOptimisticGeocaches(),
      { wrapper }
    );

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.geocaches).toEqual([]);
  });
});