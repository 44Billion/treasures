import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useGeocacheStats } from '@/hooks/useGeocacheStats';
import { NostrProvider } from '@nostrify/react';
import { NIP_GC_KINDS } from '@/lib/nip-gc';

// Mock the nostr hook
const mockQuery = vi.fn();
vi.mock('@nostrify/react', () => ({
  useNostr: () => ({
    nostr: {
      query: mockQuery,
    },
  }),
  NostrProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// Mock the deletion filter hook
vi.mock('@/hooks/useDeletionFilter', () => ({
  useDeletionFilter: () => ({
    filterDeleted: {
      fast: (events: any[]) => events, // Return events unchanged for testing
    },
  }),
}));

describe('useGeocacheStats', () => {
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
      <NostrProvider relays={['wss://test.relay']}>
        {children}
      </NostrProvider>
    </QueryClientProvider>
  );

  it('should return zero stats when no geocache data provided', async () => {
    const { result } = renderHook(() => useGeocacheStats(), { wrapper });

    expect(result.current.foundCount).toBe(0);
    expect(result.current.logCount).toBe(0);
  });

  it('should calculate correct stats from log events', async () => {
    const mockFoundLogs = [
      { id: '1', pubkey: 'user1', tags: [['a', '37515:pubkey:dtag']] },
      { id: '2', pubkey: 'user2', tags: [['a', '37515:pubkey:dtag']] },
      { id: '3', pubkey: 'user1', tags: [['a', '37515:pubkey:dtag']] }, // Duplicate user
    ];

    const mockCommentLogs = [
      { id: '4', pubkey: 'user3', tags: [['a', '37515:pubkey:dtag']] },
      { id: '5', pubkey: 'user4', tags: [['A', '37515:pubkey:dtag']] },
    ];

    mockQuery
      .mockResolvedValueOnce(mockFoundLogs) // First call for found logs
      .mockResolvedValueOnce(mockCommentLogs); // Second call for comment logs

    const { result } = renderHook(() => useGeocacheStats('dtag', 'pubkey'), { wrapper });

    await waitFor(() => {
      expect(result.current.foundCount).toBe(2); // Unique users who found it
      expect(result.current.logCount).toBe(5); // Total logs (found + comment)
    });

    expect(mockQuery).toHaveBeenCalledTimes(2);
    expect(mockQuery).toHaveBeenCalledWith(
      [{ kinds: [NIP_GC_KINDS.FOUND_LOG], '#a': ['37515:pubkey:dtag'], limit: 100 }],
      expect.any(Object)
    );
    expect(mockQuery).toHaveBeenCalledWith(
      [{ kinds: [NIP_GC_KINDS.COMMENT_LOG], '#a': ['37515:pubkey:dtag'], '#A': ['37515:pubkey:dtag'], limit: 100 }],
      expect.any(Object)
    );
  });

  it('should handle query errors gracefully', async () => {
    mockQuery.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useGeocacheStats('dtag', 'pubkey'), { wrapper });

    await waitFor(() => {
      expect(result.current.foundCount).toBe(0);
      expect(result.current.logCount).toBe(0);
    });
  });

  it('should not query when geocache data is missing', () => {
    renderHook(() => useGeocacheStats(undefined, 'pubkey'), { wrapper });
    renderHook(() => useGeocacheStats('dtag', undefined), { wrapper });

    expect(mockQuery).not.toHaveBeenCalled();
  });
});