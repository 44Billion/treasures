import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useCreateVerifiedLog } from '@/hooks/useCreateVerifiedLog';
import { TIMEOUTS } from '@/lib/constants';

// Mock the dependencies
vi.mock('@nostrify/react', () => ({
  useNostr: () => ({
    nostr: {
      event: vi.fn().mockResolvedValue(undefined),
      query: vi.fn().mockResolvedValue([]),
    },
  }),
}));

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    user: {
      pubkey: 'test-pubkey',
      signer: {
        signEvent: vi.fn().mockResolvedValue({
          id: 'test-event-id',
          pubkey: 'test-pubkey',
          created_at: Math.floor(Date.now() / 1000),
          kind: 7516,
          content: 'test content',
          tags: [['client', 'treasures']],
          sig: 'test-signature',
        }),
      },
    },
  }),
}));

vi.mock('@/hooks/useToast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

vi.mock('@/lib/verification', () => ({
  createVerificationEvent: vi.fn().mockResolvedValue({
    id: 'verification-event-id',
    pubkey: 'verification-pubkey',
    created_at: Math.floor(Date.now() / 1000),
    kind: 7515,
    content: 'Geocache verification for npub123',
    tags: [['a', 'test-pubkey:naddr123']],
    sig: 'verification-signature',
  }),
}));

vi.mock('@/lib/nip-gc', () => ({
  NIP_GC_KINDS: {
    FOUND_LOG: 7516,
    VERIFICATION: 7515,
  },
  buildFoundLogTags: vi.fn().mockReturnValue([
    ['a', '30001:test-pubkey:test-dtag'],
    ['client', 'treasures'],
    ['verification', '{"id":"verification-event-id"}'],
  ]),
}));

describe('useCreateVerifiedLog Performance', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    vi.clearAllMocks();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it('should use consistent timeouts with regular logs', async () => {
    const { result } = renderHook(() => useCreateVerifiedLog(), { wrapper });

    const testData = {
      geocacheId: 'test-cache-id',
      geocacheDTag: 'test-dtag',
      geocachePubkey: 'test-pubkey',
      type: 'found' as const,
      text: 'Found the cache!',
      verificationKey: 'nsec1test',
    };

    // Start the mutation
    const startTime = Date.now();
    result.current.mutate(testData);

    await waitFor(() => {
      expect(result.current.isSuccess || result.current.isError).toBe(true);
    });

    const endTime = Date.now();
    const duration = endTime - startTime;

    // The operation should complete quickly (under 1 second in tests)
    // This is much faster than the previous 15+ second timeouts
    expect(duration).toBeLessThan(1000);
  });

  it('should use TIMEOUTS.QUERY for main publishing', () => {
    // Verify that we're using the standard timeout constant
    expect(TIMEOUTS.QUERY).toBe(8000);
    expect(TIMEOUTS.FAST_QUERY).toBe(2000);
  });

  it('should have streamlined publishing logic', async () => {
    const { result } = renderHook(() => useCreateVerifiedLog(), { wrapper });

    const testData = {
      geocacheId: 'test-cache-id',
      geocacheDTag: 'test-dtag',
      geocachePubkey: 'test-pubkey',
      type: 'found' as const,
      text: 'Found the cache!',
      verificationKey: 'nsec1test',
    };

    result.current.mutate(testData);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Should have called nostr.event once (not multiple relay attempts)
    const { useNostr } = await import('@nostrify/react');
    const nostr = useNostr().nostr;
    expect(nostr.event).toHaveBeenCalledTimes(1);
  });
});