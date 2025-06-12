import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useGeocacheByNaddr } from '@/features/geocache/hooks/useGeocacheByNaddr';
import { geocacheToNaddr } from '@/shared/utils/naddr';
import type { Geocache } from '@/types/geocache';

// Mock the dependencies
vi.mock('@nostrify/react', () => ({
  useNostr: () => ({
    nostr: {
      query: vi.fn().mockResolvedValue([]),
    },
  }),
}));

vi.mock('@/features/offline/hooks/useOfflineStorage', () => ({
  useOfflineMode: () => ({
    isOnline: true,
    isConnected: true,
    connectionQuality: 'good',
  }),
}));

vi.mock('@/features/offline/utils/offlineStorage', () => ({
  offlineStorage: {
    init: vi.fn().mockResolvedValue(undefined),
    getAllGeocaches: vi.fn().mockResolvedValue([]),
    storeGeocache: vi.fn().mockResolvedValue(undefined),
  },
}));

const createWrapper = (queryClient: QueryClient) => {
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('useGeocacheByNaddr cache optimization', () => {
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

  it('should use cached geocache data from main query when available', async () => {
    // Create a mock geocache
    const mockGeocache: Geocache = {
      id: 'test-id',
      dTag: 'test-dtag',
      pubkey: 'test-pubkey',
      name: 'Test Cache',
      description: 'Test description',
      location: { lat: 40.7128, lng: -74.0060 },
      difficulty: 2,
      terrain: 3,
      size: 'regular',
      type: 'traditional',
      created_at: Date.now() / 1000,
      relays: ['wss://ditto.pub/relay'],
      foundCount: 5,
      logCount: 10,
    };

    // Pre-populate the main geocaches cache
    queryClient.setQueryData(['geocaches'], [mockGeocache]);

    // Generate naddr for the test geocache
    const naddr = geocacheToNaddr(mockGeocache.pubkey, mockGeocache.dTag, mockGeocache.relays);

    const { result } = renderHook(
      () => useGeocacheByNaddr(naddr),
      {
        wrapper: createWrapper(queryClient),
      }
    );

    // Should immediately return the cached data
    await waitFor(() => {
      expect(result.current.data).toEqual(mockGeocache);
    });

    // Should not be loading since we have cached data
    expect(result.current.isLoading).toBe(false);
  });

  it('should use cached geocache data from fast query when main query is empty', async () => {
    const mockGeocache: Geocache = {
      id: 'test-id-2',
      dTag: 'test-dtag-2',
      pubkey: 'test-pubkey-2',
      name: 'Test Cache 2',
      description: 'Test description 2',
      location: { lat: 40.7128, lng: -74.0060 },
      difficulty: 3,
      terrain: 2,
      size: 'small',
      type: 'mystery',
      created_at: Date.now() / 1000,
      relays: ['wss://ditto.pub/relay'],
      foundCount: 2,
      logCount: 5,
    };

    // Pre-populate the fast geocaches cache (but not main cache)
    queryClient.setQueryData(['geocaches-fast'], [mockGeocache]);

    const naddr = geocacheToNaddr(mockGeocache.pubkey, mockGeocache.dTag, mockGeocache.relays);

    const { result } = renderHook(
      () => useGeocacheByNaddr(naddr),
      {
        wrapper: createWrapper(queryClient),
      }
    );

    await waitFor(() => {
      expect(result.current.data).toEqual(mockGeocache);
    });

    expect(result.current.isLoading).toBe(false);
  });

  it('should use cached geocache data from proximity query when other caches are empty', async () => {
    const mockGeocache: Geocache = {
      id: 'test-id-3',
      dTag: 'test-dtag-3',
      pubkey: 'test-pubkey-3',
      name: 'Test Cache 3',
      description: 'Test description 3',
      location: { lat: 40.7128, lng: -74.0060 },
      difficulty: 1,
      terrain: 1,
      size: 'large',
      type: 'multi',
      created_at: Date.now() / 1000,
      relays: ['wss://ditto.pub/relay'],
      foundCount: 8,
      logCount: 15,
    };

    // Pre-populate the proximity geocaches cache
    queryClient.setQueryData(['proximity-geocaches'], [mockGeocache]);

    const naddr = geocacheToNaddr(mockGeocache.pubkey, mockGeocache.dTag, mockGeocache.relays);

    const { result } = renderHook(
      () => useGeocacheByNaddr(naddr),
      {
        wrapper: createWrapper(queryClient),
      }
    );

    await waitFor(() => {
      expect(result.current.data).toEqual(mockGeocache);
    });

    expect(result.current.isLoading).toBe(false);
  });

  it('should fall back to network request when no cached data is available', async () => {
    // Don't pre-populate any cache
    const naddr = geocacheToNaddr('unknown-pubkey', 'unknown-dtag', ['wss://ditto.pub/relay']);

    const { result } = renderHook(
      () => useGeocacheByNaddr(naddr),
      {
        wrapper: createWrapper(queryClient),
      }
    );

    // Should start loading since no cached data is available
    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();
  });
});