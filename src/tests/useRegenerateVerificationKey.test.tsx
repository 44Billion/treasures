import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useRegenerateVerificationKey } from '@/features/geocache/hooks/useRegenerateVerificationKey';
import type { Geocache } from '@/types/geocache';

// Mock the dependencies
vi.mock('@/shared/hooks/useNostrPublish', () => ({
  useNostrPublish: () => ({
    mutateAsync: vi.fn().mockResolvedValue({
      id: 'test-event-id',
      kind: 30001,
      content: 'Test cache description',
      tags: [['d', 'test-dtag']],
      created_at: Math.floor(Date.now() / 1000),
      pubkey: 'test-pubkey',
      sig: 'test-sig'
    })
  })
}));

vi.mock('@/shared/hooks/useToast', () => ({
  useToast: () => ({
    toast: vi.fn()
  })
}));

vi.mock('@/features/geocache/utils/verification', () => ({
  generateVerificationKeyPair: vi.fn().mockResolvedValue({
    privateKey: new Uint8Array(32),
    publicKey: 'new-verification-pubkey',
    nsec: 'nsec1test',
    npub: 'npub1test'
  })
}));

vi.mock('@/features/geocache/utils/nip-gc', () => ({
  NIP_GC_KINDS: {
    GEOCACHE: 30001
  },
  buildGeocacheTags: vi.fn().mockReturnValue([
    ['d', 'test-dtag'],
    ['name', 'Test Cache'],
    ['verification', 'new-verification-pubkey']
  ]),
  parseGeocacheEvent: vi.fn().mockReturnValue({
    id: 'test-event-id',
    name: 'Test Cache',
    verificationPubkey: 'new-verification-pubkey'
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
    pubkey: 'test-pubkey',
    created_at: Math.floor(Date.now() / 1000),
    location: { lat: 40.7128, lng: -74.0060 },
    difficulty: 3,
    terrain: 2,
    size: 'regular',
    type: 'traditional',
    hint: 'Test hint',
    images: [],
    relays: ['wss://relay.example.com'],
    verificationPubkey: 'old-verification-pubkey',
    hidden: false,
    foundCount: 0,
    logCount: 0
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should regenerate verification key successfully', async () => {
    const { result } = renderHook(
      () => useRegenerateVerificationKey(mockGeocache),
      { wrapper: createWrapper() }
    );

    expect(result.current.isPending).toBe(false);

    // Trigger the mutation
    result.current.mutate();

    expect(result.current.isPending).toBe(true);

    await waitFor(() => {
      expect(result.current.isPending).toBe(false);
    });

    expect(result.current.isSuccess).toBe(true);
  });

  it('should handle null geocache', async () => {
    const { result } = renderHook(
      () => useRegenerateVerificationKey(null),
      { wrapper: createWrapper() }
    );

    result.current.mutate();

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toBe('No geocache provided');
  });

  it('should return verification key pair on success', async () => {
    const { result } = renderHook(
      () => useRegenerateVerificationKey(mockGeocache),
      { wrapper: createWrapper() }
    );

    let verificationKeyPair: any;

    result.current.mutate(undefined, {
      onSuccess: (keyPair) => {
        verificationKeyPair = keyPair;
      }
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(verificationKeyPair).toBeDefined();
    expect(verificationKeyPair.publicKey).toBe('new-verification-pubkey');
    expect(verificationKeyPair.nsec).toBe('nsec1test');
  });

  it('should invalidate all geocache listing queries on success', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false }
      }
    });
    
    // Spy on invalidateQueries to verify it's called with correct keys
    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');
    
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );

    const { result } = renderHook(
      () => useRegenerateVerificationKey(mockGeocache),
      { wrapper }
    );

    result.current.mutate();

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Verify that all the correct query keys are invalidated
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['geocaches'] });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['geocaches-fast'] });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['proximity-geocaches'] });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: ['adaptive-geocaches'] });
  });
});
