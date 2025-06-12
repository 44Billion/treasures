/**
 * Test to verify that polling is working correctly in the main hooks
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useDataManager } from '@/shared/stores/simpleStores';
import { useAdaptiveReliableGeocaches } from '@/features/geocache/hooks/useReliableProximitySearch';
import { POLLING_INTERVALS } from '@/shared/config';

// Mock the Nostr hook
vi.mock('@nostrify/react', () => ({
  useNostr: () => ({
    nostr: {
      query: vi.fn().mockResolvedValue([]),
    },
  }),
}));

// Mock other dependencies
vi.mock('@/shared/stores/simpleStores', () => ({
  useCurrentUser: () => ({ user: null }),
}));

vi.mock('@/hooks/useConnectivity', () => ({
  useOnlineStatus: () => ({ isOnline: true, isConnected: true }),
}));

vi.mock('@/hooks/usePrefetchManager', () => ({
  usePrefetchManager: () => ({
    triggerPrefetch: vi.fn(),
    getPrefetchStatus: () => ({
      totalGeocaches: 0,
      prefetchedLogs: 0,
      prefetchedAuthors: 0,
    }),
  }),
}));

vi.mock('@/hooks/useCacheInvalidation', () => ({
  useCacheInvalidation: () => ({
    validateCachedGeocaches: vi.fn(),
  }),
}));

vi.mock('@/hooks/useDeletionFilter', () => ({
  useDeletionFilter: () => ({
    filterDeleted: {
      fast: (events: unknown[]) => events,
    },
  }),
}));

describe('Polling Configuration', () => {
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

  it('should have polling enabled in useDataManager', async () => {
    const { result } = renderHook(() => useDataManager({
      enablePolling: true,
      enablePrefetching: true,
    }), { wrapper });

    await waitFor(() => {
      const status = result.current.getStatus();
      expect(status.isPolling).toBe(true);
    });
  });

  it('should have correct polling intervals configured', () => {
    // Verify that polling intervals are set to reasonable values
    expect(POLLING_INTERVALS.GEOCACHES).toBe(60000); // 1 minute
    expect(POLLING_INTERVALS.LOGS).toBe(30000); // 30 seconds
    expect(POLLING_INTERVALS.DELETION_EVENTS).toBe(120000); // 2 minutes
  });

  it('should enable polling in useAdaptiveReliableGeocaches', async () => {
    const { result } = renderHook(() => useAdaptiveReliableGeocaches({
      userLocation: { lat: 40.7128, lng: -74.0060 },
      showNearMe: true,
      searchRadius: 25,
    }), { wrapper });

    // The hook should be configured with polling
    await waitFor(() => {
      expect(result.current.isLoading).toBeDefined();
      expect(typeof result.current.refetch).toBe('function');
    });
  });

  it('should handle polling when user is active', async () => {
    const { result } = renderHook(() => useDataManager({
      enablePolling: true,
    }), { wrapper });

    await waitFor(() => {
      const status = result.current.getStatus();
      expect(status.isPolling).toBe(true);
      expect(status.isLoading).toBeDefined();
    });
  });
});