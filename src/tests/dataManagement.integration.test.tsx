/**
 * Integration tests for the complete data management system
 * Tests how all the hooks work together
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

import { useDataManager } from '@/shared/stores/simpleStores';
import type { Geocache } from '@/types/geocache';

// Mock data
const mockGeocaches: Geocache[] = [
  {
    id: 'cache1',
    name: 'Mountain Cache',
    pubkey: 'pubkey1',
    created_at: Math.floor(new Date('2024-01-01').getTime() / 1000),
    dTag: 'mountain-cache',
    difficulty: 2,
    terrain: 3,
    size: 'regular',
    type: 'traditional',
    description: 'Hidden near the summit',
    location: { lat: 40.7128, lng: -74.0060 },
    images: [],
    hidden: false,
  },
  {
    id: 'cache2',
    name: 'Urban Cache',
    pubkey: 'pubkey2',
    created_at: Math.floor(new Date('2024-01-02').getTime() / 1000),
    dTag: 'urban-cache',
    difficulty: 1,
    terrain: 1,
    size: 'small',
    type: 'multi',
    description: 'City exploration',
    location: { lat: 40.7589, lng: -73.9851 },
    images: [],
    hidden: false,
  },
];

const mockLogs = [
  {
    id: 'log1',
    type: 'found',
    content: 'Great find!',
    author: 'finder1',
    timestamp: new Date('2024-01-03'),
  },
  {
    id: 'log2',
    type: 'comment',
    content: 'Thanks for the cache',
    author: 'finder2',
    timestamp: new Date('2024-01-04'),
  },
];

// Mock the Nostr client
const mockNostr = {
  query: vi.fn(),
};

vi.mock('@nostrify/react', () => ({
  useNostr: () => ({ nostr: mockNostr }),
}));

vi.mock('@/shared/stores/simpleStores', () => ({
  useCurrentUser: () => ({ 
    user: { 
      pubkey: 'test-user-pubkey',
      name: 'Test User' 
    } 
  }),
}));

vi.mock('@/hooks/useConnectivity', () => ({
  useOnlineStatus: () => ({ isOnline: true, isConnected: true }),
}));

vi.mock('@/features/offline/utils/offlineStorage', () => ({
  offlineStorage: {
    getStoredGeocaches: vi.fn().mockResolvedValue(mockGeocaches),
    removeGeocache: vi.fn().mockResolvedValue(undefined),
    removeLog: vi.fn().mockResolvedValue(undefined),
    storeGeocaches: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/shared/config', () => ({
  TIMEOUTS: {
    QUERY: 8000,
    FAST_QUERY: 3000,
  },
  POLLING_INTERVALS: {
    GEOCACHES: 60000,
    LOGS: 30000,
    DELETION_EVENTS: 120000,
    BACKGROUND_SYNC: 300000,
    FAST_UPDATES: 15000,
    SLOW_UPDATES: 600000,
  },
  QUERY_LIMITS: {
    GEOCACHES: 100,
    LOGS: 200,
    DELETION_EVENTS: 100,
  },
}));

vi.mock('@/features/geocache/utils/nip-gc', () => ({
  NIP_GC_KINDS: {
    GEOCACHE: 37515,
    FOUND_LOG: 3753515,
    COMMENT_LOG: 3753516,
  },
  createGeocacheCoordinate: vi.fn((pubkey, dTag) => `37515:${pubkey}:${dTag}`),
  parseGeocacheEvent: vi.fn((event) => {
    const content = JSON.parse(event.content || '{}');
    return {
      id: event.id,
      name: content.name || 'Test Cache',
      pubkey: event.pubkey,
      created_at: event.created_at,
      dTag: event.tags.find((t: string[]) => t[0] === 'd')?.[1],
      difficulty: content.difficulty || 1,
      terrain: content.terrain || 1,
      size: 'regular',
      type: content.type || 'traditional',
      description: 'Test cache',
      location: { lat: 0, lng: 0 },
      images: [],
      hidden: false,
    };
  }),
  parseLogEvent: vi.fn((event) => ({
    id: event.id,
    type: event.kind === 3753515 ? 'found' : 'note',
    text: event.content,
    pubkey: event.pubkey,
    created_at: event.created_at,
    geocacheId: 'test-cache',
  })),
}));

describe('Data Management System Integration', () => {
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
    vi.useFakeTimers();

    // Default mock responses
    mockNostr.query.mockImplementation((filters) => {
      const filter = filters[0];
      
      // Geocache queries
      if (filter.kinds?.includes(37515)) {
        return Promise.resolve([
          {
            id: 'cache1',
            kind: 37515,
            pubkey: 'pubkey1',
            content: JSON.stringify({ name: 'Mountain Cache' }),
            tags: [['d', 'mountain-cache']],
            created_at: Math.floor(Date.now() / 1000),
            sig: 'signature1',
          },
          {
            id: 'cache2',
            kind: 37515,
            pubkey: 'pubkey2',
            content: JSON.stringify({ name: 'Urban Cache' }),
            tags: [['d', 'urban-cache']],
            created_at: Math.floor(Date.now() / 1000),
            sig: 'signature2',
          },
        ]);
      }

      // Log queries
      if (filter.kinds?.includes(3753515) || filter.kinds?.includes(3753516)) {
        return Promise.resolve([
          {
            id: 'log1',
            kind: 3753515,
            pubkey: 'finder1',
            content: 'Great find!',
            tags: [['a', '37515:pubkey1:mountain-cache']],
            created_at: Math.floor(Date.now() / 1000),
            sig: 'signature3',
          },
        ]);
      }

      // Deletion events
      if (filter.kinds?.includes(5)) {
        return Promise.resolve([]);
      }

      // Author metadata
      if (filter.kinds?.includes(0)) {
        return Promise.resolve([
          {
            id: 'profile1',
            kind: 0,
            pubkey: filter.authors?.[0] || 'pubkey1',
            content: JSON.stringify({ name: 'Test Author', picture: 'avatar.jpg' }),
            tags: [],
            created_at: Math.floor(Date.now() / 1000),
            sig: 'sig',
          },
        ]);
      }

      return Promise.resolve([]);
    });
  });

  afterEach(() => {
    queryClient.clear();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('should coordinate data fetching, prefetching, and caching', async () => {
    const { result } = renderHook(
      () => useDataManager({
        enablePolling: true,
        enablePrefetching: true,
        priorityGeocaches: ['cache1'],
      }),
      { wrapper: createWrapper(queryClient) }
    );

    // Wait for initial data load
    await waitFor(() => {
      expect(result.current.geocaches).toHaveLength(2);
    });

    // Verify initial state
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isActive).toBe(true);
    expect(result.current.errorCount).toBe(0);

    // Check status
    const status = result.current.getStatus();
    expect(status.isPolling).toBe(true);
    expect(status.isPrefetching).toBe(true);
  });

  it('should handle refresh all functionality', async () => {
    const { result } = renderHook(
      () => useDataManager({ enablePolling: true }),
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(() => {
      expect(result.current.geocaches).toHaveLength(2);
    });

    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await act(async () => {
      await result.current.refreshAll();
    });

    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['geocaches'] });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['geocache-logs'] });
  });

  it('should handle specific geocache refresh', async () => {
    const { result } = renderHook(
      () => useDataManager({ enablePolling: true }),
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(() => {
      expect(result.current.geocaches).toHaveLength(2);
    });

    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await act(async () => {
      await result.current.refreshGeocache('cache1');
    });

    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ 
      queryKey: ['geocache', 'cache1'] 
    });
  });

  it('should automatically prefetch priority geocaches', async () => {
    const priority = ['cache1'];
    
    const { result } = renderHook(
      () => useDataManager({
        enablePrefetching: true,
        priorityGeocaches: priority,
      }),
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(() => {
      expect(result.current.geocaches).toHaveLength(2);
    });

    // Should trigger prefetch for priority geocaches
    const prefetchStatus = result.current.getStatus().prefetchStatus;
    expect(prefetchStatus.totalGeocaches).toBeGreaterThan(0);
  });

  it('should handle background polling intervals', async () => {
    const { result } = renderHook(
      () => useDataManager({ enablePolling: true }),
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(() => {
      expect(result.current.isActive).toBe(true);
    });

    // Fast-forward time to trigger background updates
    act(() => {
      vi.advanceTimersByTime(60000); // 1 minute
    });

    // Background updates should be triggered
    expect(mockNostr.query).toHaveBeenCalled();
  });

  it('should pause and resume polling', async () => {
    const { result } = renderHook(
      () => useDataManager({ enablePolling: true }),
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(() => {
      expect(result.current.isActive).toBe(true);
    });

    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');

    act(() => {
      result.current.pausePolling();
    });

    expect(invalidateQueriesSpy).toHaveBeenCalled();

    act(() => {
      result.current.resumePolling();
    });

    expect(invalidateQueriesSpy).toHaveBeenCalledTimes(2);
  });

  it('should handle offline state gracefully', async () => {
    // Mock offline state
    vi.doMock('@/hooks/useConnectivity', () => ({
      useOnlineStatus: () => ({ isOnline: false, isConnected: false }),
    }));

    const { result } = renderHook(
      () => useDataManager({ enablePolling: true }),
      { wrapper: createWrapper(queryClient) }
    );

    expect(result.current.isActive).toBe(false);
  });

  it('should handle errors gracefully', async () => {
    // Mock network error
    mockNostr.query.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(
      () => useDataManager({ enablePolling: true }),
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeInstanceOf(Error);
  });

  it('should coordinate cache invalidation with data updates', async () => {
    // Mock deletion event
    mockNostr.query.mockImplementation((filters) => {
      const filter = filters[0];
      
      if (filter.kinds?.includes(5)) {
        return Promise.resolve([
          {
            id: 'deletion1',
            kind: 5,
            tags: [['e', 'cache1']],
            content: '',
            pubkey: 'pubkey1',
            created_at: Math.floor(Date.now() / 1000),
            sig: 'sig',
          },
        ]);
      }

      return Promise.resolve([]);
    });

    const { result } = renderHook(
      () => useDataManager({ enablePolling: true }),
      { wrapper: createWrapper(queryClient) }
    );

    const { offlineStorage } = await import('@/features/offline/utils/offlineStorage');

    // Wait for deletion event processing
    await waitFor(() => {
      expect(offlineStorage.removeGeocache).toHaveBeenCalled();
    });
  });

  it('should provide comprehensive status information', async () => {
    const { result } = renderHook(
      () => useDataManager({
        enablePolling: true,
        enablePrefetching: true,
        priorityGeocaches: ['cache1'],
      }),
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(() => {
      expect(result.current.geocaches).toHaveLength(2);
    });

    const status = result.current.getStatus();

    expect(status).toEqual({
      isLoading: expect.any(Boolean),
      isPolling: true,
      isPrefetching: true,
      lastUpdate: expect.any(Date),
      errorCount: 0,
      prefetchStatus: expect.objectContaining({
        totalGeocaches: expect.any(Number),
        prefetchedLogs: expect.any(Number),
        prefetchedAuthors: expect.any(Number),
        isPolling: true,
        isPrefetching: true,
      }),
    });
  });

  it('should handle user activity events', async () => {
    const { result } = renderHook(
      () => useDataManager({ enablePolling: true }),
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(() => {
      expect(result.current.isActive).toBe(true);
    });

    // Simulate user returning to tab
    act(() => {
      Object.defineProperty(document, 'visibilityState', {
        value: 'visible',
        writable: true,
      });
      
      const event = new Event('visibilitychange');
      document.dispatchEvent(event);
    });

    // Should trigger refresh
    expect(mockNostr.query).toHaveBeenCalled();
  });

  it('should optimize performance with smart caching', async () => {
    const { result } = renderHook(
      () => useDataManager({ enablePrefetching: true }),
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(() => {
      expect(result.current.geocaches).toHaveLength(2);
    });

    // Check that prefetching doesn't interfere with main queries
    expect(result.current.isLoading).toBe(false);
    expect(result.current.geocaches[0]?.name).toBe('Mountain Cache');
  });
});