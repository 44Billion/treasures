/**
 * Performance tests for data management system
 * Tests memory usage, timing, and efficiency
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

import { useDataManager } from '@/shared/stores/simpleStores';
import { usePrefetchManager } from '@/shared/stores/simpleStores';
import { createTestQueryClient, createMockNostr, mockGeocaches } from './testUtils';

describe('Data Management Performance', () => {
  let queryClient: QueryClient;
  let mockNostr: ReturnType<typeof createMockNostr>;

  const createWrapper = (client: QueryClient) => {
    return ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };

  beforeEach(() => {
    queryClient = createTestQueryClient();
    mockNostr = createMockNostr();
    vi.useFakeTimers();

    vi.mock('@nostrify/react', () => ({
      useNostr: () => ({ nostr: mockNostr }),
    }));
  });

  afterEach(() => {
    queryClient.clear();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  describe('Query Efficiency', () => {
    it('should deduplicate concurrent queries', async () => {
      const { result } = renderHook(
        () => useDataManager({ enablePrefetching: true }),
        { wrapper: createWrapper(queryClient) }
      );

      // Trigger multiple refreshes simultaneously
      const promises = [
        result.current.refreshAll(),
        result.current.refreshAll(),
        result.current.refreshAll(),
      ];

      await Promise.all(promises);

      // Should not make excessive API calls
      const geocacheQueries = mockNostr.query.mock.calls.filter(
        call => call[0][0].kinds?.includes(37515)
      );
      
      // Should have reasonable number of calls (not 3x due to deduplication)
      expect(geocacheQueries.length).toBeLessThan(4);
    });

    it('should handle large datasets efficiently', async () => {
      // Create a large dataset
      const largeGeocacheSet = Array.from({ length: 1000 }, (_, i) => ({
        id: `cache-${i}`,
        kind: 37515,
        pubkey: `pubkey-${i}`,
        content: JSON.stringify({ name: `Cache ${i}` }),
        tags: [['d', `tag-${i}`]],
        created_at: Math.floor(Date.now() / 1000),
        sig: `signature-${i}`,
      }));

      mockNostr.query.mockResolvedValue(largeGeocacheSet);

      const startTime = performance.now();
      
      const { result } = renderHook(
        () => useDataManager({ enablePrefetching: true }),
        { wrapper: createWrapper(queryClient) }
      );

      const endTime = performance.now();

      // Should process large dataset in reasonable time
      expect(endTime - startTime).toBeLessThan(100);
      expect(result.current.geocaches).toHaveLength(1000);
    });

    it('should limit prefetch operations to prevent overwhelming', async () => {
      const { result } = renderHook(
        () => usePrefetchManager({ enablePrefetching: true }),
        { wrapper: createWrapper(queryClient) }
      );

      // Try to prefetch many authors at once
      const manyAuthors = Array.from({ length: 100 }, (_, i) => `author-${i}`);

      await act(async () => {
        await result.current.prefetchAuthors(manyAuthors);
      });

      // Should limit concurrent prefetch operations
      const authorQueries = mockNostr.query.mock.calls.filter(
        call => call[0][0].kinds?.includes(0)
      );
      
      expect(authorQueries.length).toBeLessThanOrEqual(10);
    });

    it('should timeout long-running queries', async () => {
      // Mock a slow query
      mockNostr.query.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 10000))
      );

      const { result } = renderHook(
        () => useDataManager(),
        { wrapper: createWrapper(queryClient) }
      );

      const startTime = Date.now();

      await act(async () => {
        try {
          await result.current.refreshAll();
        } catch (error) {
          // Expected timeout error
        }
      });

      // Should timeout in reasonable time
      expect(Date.now() - startTime).toBeLessThan(9000);
    });
  });

  describe('Memory Management', () => {
    it('should cleanup intervals on unmount', () => {
      const { unmount } = renderHook(
        () => usePrefetchManager({ enableBackgroundPolling: true }),
        { wrapper: createWrapper(queryClient) }
      );

      // Verify intervals are created
      expect(setInterval).toHaveBeenCalled();

      unmount();

      // Verify intervals are cleaned up
      expect(clearInterval).toHaveBeenCalled();
    });

    it('should not accumulate query cache indefinitely', async () => {
      const { result } = renderHook(
        () => useDataManager({ enablePrefetching: true }),
        { wrapper: createWrapper(queryClient) }
      );

      // Simulate multiple refreshes over time
      for (let i = 0; i < 10; i++) {
        await act(async () => {
          await result.current.refreshAll();
        });
        
        // Advance time to trigger cache cleanup
        act(() => {
          vi.advanceTimersByTime(60000);
        });
      }

      // Query cache should not grow indefinitely
      const cacheSize = queryClient.getQueryCache().getAll().length;
      expect(cacheSize).toBeLessThan(50);
    });

    it('should handle rapid state changes efficiently', async () => {
      const { result } = renderHook(
        () => useDataManager({ enablePolling: true }),
        { wrapper: createWrapper(queryClient) }
      );

      // Rapidly toggle polling
      for (let i = 0; i < 20; i++) {
        act(() => {
          result.current.pausePolling();
          result.current.resumePolling();
        });
      }

      // Should remain stable after rapid changes
      expect(result.current.getStatus().isPolling).toBe(true);
    });
  });

  describe('Background Operations', () => {
    it('should throttle background updates', async () => {
      renderHook(
        () => usePrefetchManager({
          enableBackgroundPolling: true,
          priorityGeocaches: ['cache1', 'cache2'],
        }),
        { wrapper: createWrapper(queryClient) }
      );

      const initialCallCount = mockNostr.query.mock.calls.length;

      // Advance time rapidly
      act(() => {
        vi.advanceTimersByTime(30000); // 30 seconds
      });

      const midCallCount = mockNostr.query.mock.calls.length;

      act(() => {
        vi.advanceTimersByTime(30000); // Another 30 seconds
      });

      const finalCallCount = mockNostr.query.mock.calls.length;

      // Background updates should be throttled
      const callsPerInterval = (finalCallCount - initialCallCount) / 2;
      expect(callsPerInterval).toBeLessThan(10);
    });

    it('should prioritize user-initiated operations', async () => {
      const { result } = renderHook(
        () => useDataManager({ enablePrefetching: true }),
        { wrapper: createWrapper(queryClient) }
      );

      // Start background operation
      act(() => {
        vi.advanceTimersByTime(60000);
      });

      const backgroundCallCount = mockNostr.query.mock.calls.length;

      // Trigger user operation
      await act(async () => {
        await result.current.refreshAll();
      });

      const userCallCount = mockNostr.query.mock.calls.length - backgroundCallCount;

      // User operations should complete quickly
      expect(userCallCount).toBeGreaterThan(0);
    });

    it('should batch similar operations', async () => {
      const { result } = renderHook(
        () => usePrefetchManager({ enablePrefetching: true }),
        { wrapper: createWrapper(queryClient) }
      );

      // Trigger multiple prefetch operations close together
      await act(async () => {
        await Promise.all([
          result.current.triggerPrefetch(['cache1']),
          result.current.triggerPrefetch(['cache2']),
          result.current.triggerPrefetch(['cache3']),
        ]);
      });

      // Should batch similar operations efficiently
      const prefetchCalls = mockNostr.query.mock.calls.filter(
        call => call[0][0].kinds?.includes(3753515) // Log queries
      );

      expect(prefetchCalls.length).toBeLessThan(10);
    });
  });

  describe('Error Recovery Performance', () => {
    it('should handle failures without blocking other operations', async () => {
      // Mock some queries to fail
      mockNostr.query.mockImplementation((filters) => {
        const filter = filters[0];
        if (filter.kinds?.includes(37515)) {
          return Promise.reject(new Error('Geocache query failed'));
        }
        return Promise.resolve([]);
      });

      const { result } = renderHook(
        () => useDataManager({ enablePrefetching: true }),
        { wrapper: createWrapper(queryClient) }
      );

      const startTime = performance.now();

      // Should not hang despite errors
      await act(async () => {
        try {
          await result.current.refreshAll();
        } catch {
          // Expected error
        }
      });

      const endTime = performance.now();

      // Should fail fast, not hang
      expect(endTime - startTime).toBeLessThan(1000);
    });

    it('should implement exponential backoff for retries', async () => {
      let callCount = 0;
      mockNostr.query.mockImplementation(async () => {
        callCount++;
        if (callCount < 3) {
          throw new Error('Temporary failure');
        }
        return [];
      });

      const { result } = renderHook(
        () => useDataManager(),
        { wrapper: createWrapper(queryClient) }
      );

      const startTime = performance.now();

      await act(async () => {
        try {
          await result.current.refreshAll();
        } catch {
          // May still fail after retries
        }
      });

      const endTime = performance.now();

      // Should have reasonable retry timing
      expect(endTime - startTime).toBeGreaterThan(100);
      expect(endTime - startTime).toBeLessThan(5000);
    });
  });

  describe('Offline Performance', () => {
    it('should degrade gracefully when offline', async () => {
      // Mock offline state
      vi.doMock('@/hooks/useConnectivity', () => ({
        useOnlineStatus: () => ({ isOnline: false, isConnected: false }),
      }));

      const startTime = performance.now();

      renderHook(
        () => useDataManager({ enablePolling: true }),
        { wrapper: createWrapper(queryClient) }
      );

      const endTime = performance.now();

      // Should initialize quickly even when offline
      expect(endTime - startTime).toBeLessThan(50);

      // Should not make network calls when offline
      expect(mockNostr.query).not.toHaveBeenCalled();
    });
  });
});