/**
 * Tests for the useDataManager hook
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

import { useDataManager } from '@/shared/stores/simpleStores';

// Mock dependencies
vi.mock('@/shared/stores/simpleStores', () => ({
  useCurrentUser: () => ({ user: { pubkey: 'test-pubkey' } }),
}));

vi.mock('@/hooks/useConnectivity', () => ({
  useOnlineStatus: () => ({ isOnline: true, isConnected: true }),
}));

vi.mock('@/hooks/useGeocaches', () => ({
  useGeocaches: () => ({
    data: [
      { id: 'cache1', name: 'Test Cache 1', pubkey: 'author1', dTag: 'tag1' },
      { id: 'cache2', name: 'Test Cache 2', pubkey: 'author2', dTag: 'tag2' },
    ],
    isLoading: false,
    isSuccess: true,
    isError: false,
    error: null,
    dataUpdatedAt: Date.now(),
  }),
}));

vi.mock('@/hooks/usePrefetchManager', () => ({
  usePrefetchManager: () => ({
    triggerPrefetch: vi.fn(),
    getPrefetchStatus: () => ({
      totalGeocaches: 2,
      prefetchedLogs: 1,
      prefetchedAuthors: 1,
      isPolling: true,
      isPrefetching: true,
    }),
  }),
}));

vi.mock('@/hooks/useCacheInvalidation', () => ({
  useCacheInvalidation: () => ({
    validateCachedGeocaches: vi.fn().mockResolvedValue(undefined),
  }),
}));

describe('useDataManager', () => {
  let queryClient: QueryClient;

  const createWrapper = (client: QueryClient) => {
    return ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: 0,
        },
      },
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it('should initialize with default options', () => {
    const { result } = renderHook(() => useDataManager(), {
      wrapper: createWrapper(queryClient),
    });

    expect(result.current.geocaches).toHaveLength(2);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isActive).toBe(true);
    expect(result.current.errorCount).toBe(0);
  });

  it('should accept custom options', () => {
    const options = {
      enablePolling: false,
      enablePrefetching: true,
      priorityGeocaches: ['cache1'],
    };

    const { result } = renderHook(() => useDataManager(options), {
      wrapper: createWrapper(queryClient),
    });

    expect(result.current.isActive).toBe(false); // polling disabled + online = false
  });

  it('should provide status information', () => {
    const { result } = renderHook(() => useDataManager(), {
      wrapper: createWrapper(queryClient),
    });

    const status = result.current.getStatus();

    expect(status).toEqual({
      isLoading: false,
      isPolling: true,
      isPrefetching: true,
      lastUpdate: expect.any(Date),
      errorCount: 0,
      prefetchStatus: {
        totalGeocaches: 2,
        prefetchedLogs: 1,
        prefetchedAuthors: 1,
        isPolling: true,
        isPrefetching: true,
      },
    });
  });

  it('should handle refresh all action', async () => {
    const { result } = renderHook(() => useDataManager(), {
      wrapper: createWrapper(queryClient),
    });

    // Mock invalidateQueries
    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.refreshAll();

    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['geocaches'] });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['geocache-logs'] });
  });

  it('should handle refresh specific geocache', async () => {
    const { result } = renderHook(() => useDataManager(), {
      wrapper: createWrapper(queryClient),
    });

    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await result.current.refreshGeocache('cache1');

    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['geocache', 'cache1'] });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({
      queryKey: ['geocache-logs'],
      predicate: expect.any(Function),
    });
  });

  it('should handle pause and resume polling', () => {
    const { result } = renderHook(() => useDataManager(), {
      wrapper: createWrapper(queryClient),
    });

    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

    result.current.pausePolling();
    expect(invalidateQueriesSpy).toHaveBeenCalled();

    result.current.resumePolling();
    expect(invalidateQueriesSpy).toHaveBeenCalled();
  });

  it('should track error count', () => {
    // Mock hook to return error state
    vi.doMock('@/hooks/useGeocaches', () => ({
      useGeocaches: () => ({
        data: undefined,
        isLoading: false,
        isSuccess: false,
        isError: true,
        error: new Error('Test error'),
        dataUpdatedAt: Date.now(),
      }),
    }));

    const { result } = renderHook(() => useDataManager(), {
      wrapper: createWrapper(queryClient),
    });

    expect(result.current.isError).toBe(true);
    expect(result.current.error).toBeInstanceOf(Error);
  });

  it('should handle offline state', () => {
    // Mock offline state
    vi.doMock('@/hooks/useConnectivity', () => ({
      useOnlineStatus: () => ({ isOnline: false, isConnected: false }),
    }));

    const { result } = renderHook(() => useDataManager(), {
      wrapper: createWrapper(queryClient),
    });

    expect(result.current.isActive).toBe(false);
  });

  it('should handle priority geocaches', () => {
    const priorityGeocaches = ['cache1', 'cache2'];

    const { result } = renderHook(
      () => useDataManager({ priorityGeocaches }),
      { wrapper: createWrapper(queryClient) }
    );

    const status = result.current.getStatus();
    expect(status.prefetchStatus.totalGeocaches).toBe(2);
  });

  it('should provide sub-managers', () => {
    const { result } = renderHook(() => useDataManager(), {
      wrapper: createWrapper(queryClient),
    });

    expect(result.current.prefetchManager).toBeDefined();
    expect(result.current.cacheInvalidation).toBeDefined();
    expect(typeof result.current.prefetchManager.triggerPrefetch).toBe('function');
  });
});