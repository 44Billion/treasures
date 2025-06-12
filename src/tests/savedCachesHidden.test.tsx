import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useNostrSavedCaches } from '@/features/geocache/hooks/useNostrSavedCaches';
import { useCurrentUser } from '@/shared/stores/simpleStores';
import { useNostr } from '@nostrify/react';
import { NostrEvent } from '@nostrify/nostrify';

// Mock dependencies
vi.mock('@nostrify/react');
vi.mock('@/shared/stores/simpleStores');
vi.mock('@/shared/hooks/useNostrPublish', () => ({
  useNostrPublish: () => ({
    mutateAsync: vi.fn(),
  }),
}));

const mockNostr = {
  query: vi.fn(),
};

const mockUser = {
  pubkey: 'test-pubkey',
  signer: {},
};

describe('useNostrSavedCaches - Hidden Property', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    vi.clearAllMocks();
    
    (useNostr as any).mockReturnValue({ nostr: mockNostr });
    (useCurrentUser as any).mockReturnValue({ user: mockUser });
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it('should preserve hidden property in saved caches', async () => {
    // Mock bookmark events
    const bookmarkEvents: NostrEvent[] = [
      {
        id: 'bookmark-1',
        pubkey: mockUser.pubkey,
        created_at: 1000000000,
        kind: 1985,
        content: 'Saved cache: Hidden Test Cache',
        tags: [
          ['L', 'treasures/cache-bookmark'],
          ['l', 'treasures/cache-bookmark'],
          ['a', '37515:cache-owner-pubkey:hidden-cache-dtag'],
          ['name', 'Hidden Test Cache'],
          ['action', 'save'],
          ['client', 'treasures']
        ],
        sig: 'test-sig'
      }
    ];

    // Mock geocache event with hidden property
    const geocacheEvents: NostrEvent[] = [
      {
        id: 'cache-1',
        pubkey: 'cache-owner-pubkey',
        created_at: 1000000000,
        kind: 37515,
        content: 'A hidden test cache',
        tags: [
          ['d', 'hidden-cache-dtag'],
          ['name', 'Hidden Test Cache'],
          ['g', 'u4pruydqqvj'],
          ['difficulty', '3'],
          ['terrain', '2'],
          ['size', 'small'],
          ['t', 'traditional'],
          ['t', 'hidden'], // This makes the cache hidden
        ],
        sig: 'test-sig'
      }
    ];

    // Setup mock responses
    mockNostr.query
      .mockResolvedValueOnce(bookmarkEvents) // First call for bookmark events
      .mockResolvedValueOnce(geocacheEvents); // Second call for geocache events

    const { result } = renderHook(() => useNostrSavedCaches(), { wrapper });

    await waitFor(() => {
      expect(result.current.savedCaches).toHaveLength(1);
    });

    // Verify that the hidden property is preserved
    const savedCache = result.current.savedCaches[0];
    expect(savedCache).toBeDefined();
    expect(savedCache.hidden).toBe(true);
    expect(savedCache.name).toBe('Hidden Test Cache');
    expect(savedCache.type).toBe('traditional');
  });

  it('should handle non-hidden caches correctly', async () => {
    // Mock bookmark events
    const bookmarkEvents: NostrEvent[] = [
      {
        id: 'bookmark-2',
        pubkey: mockUser.pubkey,
        created_at: 1000000000,
        kind: 1985,
        content: 'Saved cache: Regular Test Cache',
        tags: [
          ['L', 'treasures/cache-bookmark'],
          ['l', 'treasures/cache-bookmark'],
          ['a', '37515:cache-owner-pubkey:regular-cache-dtag'],
          ['name', 'Regular Test Cache'],
          ['action', 'save'],
          ['client', 'treasures']
        ],
        sig: 'test-sig'
      }
    ];

    // Mock geocache event without hidden property
    const geocacheEvents: NostrEvent[] = [
      {
        id: 'cache-2',
        pubkey: 'cache-owner-pubkey',
        created_at: 1000000000,
        kind: 37515,
        content: 'A regular test cache',
        tags: [
          ['d', 'regular-cache-dtag'],
          ['name', 'Regular Test Cache'],
          ['g', 'u4pruydqqvj'],
          ['difficulty', '2'],
          ['terrain', '1'],
          ['size', 'regular'],
          ['t', 'traditional'],
          // No 't', 'hidden' tag
        ],
        sig: 'test-sig'
      }
    ];

    // Setup mock responses
    mockNostr.query
      .mockResolvedValueOnce(bookmarkEvents) // First call for bookmark events
      .mockResolvedValueOnce(geocacheEvents); // Second call for geocache events

    const { result } = renderHook(() => useNostrSavedCaches(), { wrapper });

    await waitFor(() => {
      expect(result.current.savedCaches).toHaveLength(1);
    });

    // Verify that the hidden property is false/undefined for non-hidden caches
    const savedCache = result.current.savedCaches[0];
    expect(savedCache).toBeDefined();
    expect(savedCache.hidden).toBeFalsy();
    expect(savedCache.name).toBe('Regular Test Cache');
    expect(savedCache.type).toBe('traditional');
  });
});