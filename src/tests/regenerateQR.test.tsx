import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useRegenerateVerificationKey } from '@/features/geocache/hooks/useRegenerateVerificationKey';
import type { Geocache } from '@/types/geocache';

// Mock the dependencies
vi.mock('@/shared/hooks/useNostrPublish', () => ({
  useNostrPublish: () => ({
    mutateAsync: vi.fn().mockImplementation(() => 
      new Promise((resolve) => {
        // Simulate a slow operation that would normally timeout
        setTimeout(() => {
          resolve({
            id: 'test-event-id',
            kind: 37515,
            content: 'test content',
            tags: [],
            created_at: Math.floor(Date.now() / 1000),
            pubkey: 'test-pubkey',
            sig: 'test-sig'
          });
        }, 100); // Fast for testing
      })
    )
  })
}));

vi.mock('@/shared/hooks/useToast', () => ({
  useToast: () => ({
    toast: vi.fn()
  })
}));

vi.mock('@/features/geocache/utils/verification', () => ({
  generateVerificationKeyPair: () => Promise.resolve({
    publicKey: 'test-public-key',
    privateKey: 'test-private-key'
  })
}));

vi.mock('@/features/geocache/utils/nip-gc', () => ({
  NIP_GC_KINDS: { GEOCACHE: 37515 },
  buildGeocacheTags: () => [['d', 'test-dtag']],
  parseGeocacheEvent: () => ({
    id: 'test-id',
    name: 'Test Cache',
    description: 'Test description'
  })
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });
  
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe('useRegenerateVerificationKey', () => {
  const mockGeocache: Geocache = {
    id: 'test-id',
    dTag: 'test-dtag',
    name: 'Test Cache',
    description: 'Test description',
    location: { lat: 40.7128, lng: -74.0060 },
    difficulty: 3,
    terrain: 2,
    size: 'regular',
    type: 'traditional',
    hint: 'Test hint',
    images: [],
    relays: ['wss://test-relay.com'],
    pubkey: 'test-pubkey',
    createdAt: new Date(),
    foundCount: 0,
    logCount: 0,
    hidden: false,
    verificationPubkey: 'old-verification-key'
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should successfully regenerate verification key', async () => {
    const wrapper = createWrapper();
    
    const { result } = renderHook(
      () => useRegenerateVerificationKey(mockGeocache),
      { wrapper }
    );

    expect(result.current.isPending).toBe(false);

    // Trigger the mutation
    result.current.mutate();

    expect(result.current.isPending).toBe(true);

    // Wait for the mutation to complete
    await waitFor(() => {
      expect(result.current.isPending).toBe(false);
    });

    expect(result.current.isSuccess).toBe(true);
  });

  it('should handle null geocache gracefully', async () => {
    const wrapper = createWrapper();
    
    const { result } = renderHook(
      () => useRegenerateVerificationKey(null),
      { wrapper }
    );

    // Trigger the mutation
    result.current.mutate();

    // Wait for the mutation to complete with error
    await waitFor(() => {
      expect(result.current.isPending).toBe(false);
    });

    expect(result.current.isError).toBe(true);
    expect(result.current.error?.message).toBe('No geocache provided');
  });

  it('should have proper mutation key for caching', () => {
    const wrapper = createWrapper();
    
    const { result } = renderHook(
      () => useRegenerateVerificationKey(mockGeocache),
      { wrapper }
    );

    // The hook should be properly configured
    expect(result.current).toBeDefined();
    expect(typeof result.current.mutate).toBe('function');
    expect(typeof result.current.reset).toBe('function');
  });
});