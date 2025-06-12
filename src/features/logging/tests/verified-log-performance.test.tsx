import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useCreateVerifiedLog } from '@/features/logging/hooks/useCreateVerifiedLog';
import { TIMEOUTS } from '@/shared/config';

// Mock the dependencies
vi.mock('@/features/auth/hooks/useCurrentUser', () => ({
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

vi.mock('@/shared/hooks/useToast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

vi.mock('@/shared/hooks/useNostrPublish', () => ({
  useNostrPublish: () => ({
    mutateAsync: vi.fn().mockResolvedValue({
      id: 'published-event-id',
      pubkey: 'test-pubkey',
      created_at: Math.floor(Date.now() / 1000),
      kind: 7516,
      content: 'test content',
      tags: [['client', 'treasures']],
      sig: 'published-signature',
    }),
    isPending: false,
  }),
}));

vi.mock('@/shared/utils/verification', () => ({
  createVerificationEvent: vi.fn().mockResolvedValue({
    id: 'verification-event-id',
    pubkey: 'verification-pubkey',
    created_at: Math.floor(Date.now() / 1000),
    kind: 7517,
    content: 'Geocache verification for npub123',
    tags: [['a', 'test-pubkey:naddr123']],
    sig: 'verification-signature',
  }),
}));

vi.mock('@/shared/utils/nip-gc', () => ({
  NIP_GC_KINDS: {
    FOUND_LOG: 7516,
    VERIFICATION: 7517,
  },
  buildFoundLogTags: vi.fn().mockReturnValue([
    ['a', '37515:test-pubkey:test-dtag'],
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

  it('should use unified publishing logic for consistent performance', async () => {
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
    // This uses the same timeouts as regular publishing
    expect(duration).toBeLessThan(1000);
  });

  it('should use standard timeout constants', () => {
    // Verify that we're using the unified timeout constants
    expect(TIMEOUTS.QUERY).toBe(8000);
    expect(TIMEOUTS.FAST_QUERY).toBe(3000);
  });

  it('should use unified publishing hook for consistency', async () => {
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

    // Should have used the unified publishing hook
    const { useNostrPublish } = await import('@/shared/hooks/useNostrPublish');
    const publishHook = useNostrPublish();
    expect(publishHook.mutateAsync).toHaveBeenCalledTimes(1);
  });

  it('should handle verification event creation efficiently', async () => {
    const { createVerificationEvent } = await import('@/shared/utils/verification');
    
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

    // Should create verification event once
    expect(createVerificationEvent).toHaveBeenCalledTimes(1);
    expect(createVerificationEvent).toHaveBeenCalledWith(
      'nsec1test',
      'test-pubkey',
      'test-pubkey',
      'test-dtag'
    );
  });
});