import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useRegenerateVerificationKey } from '@/features/geocache/hooks/useRegenerateVerificationKey';
import { geocacheToNaddr } from '@/shared/utils/naddr';
import type { Geocache } from '@/types/geocache';

// Mock the dependencies
vi.mock('@/shared/hooks/useNostrPublish', () => ({
  useNostrPublish: () => ({
    mutateAsync: vi.fn().mockResolvedValue({
      id: 'new-event-id',
      pubkey: 'a'.repeat(64), // Valid 64-character hex pubkey
      created_at: Math.floor(Date.now() / 1000),
      kind: 37515,
      content: 'Test description',
      tags: [
        ['d', 'test-dtag'],
        ['name', 'Test Cache'],
        ['verification', 'c'.repeat(64)], // Valid 64-character hex verification pubkey
      ],
      sig: 'test-signature',
    }),
  }),
}));

vi.mock('@/shared/hooks/useToast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

vi.mock('@/features/geocache/utils/verification', () => ({
  generateVerificationKeyPair: vi.fn().mockResolvedValue({
    privateKey: new Uint8Array(32),
    publicKey: 'c'.repeat(64), // Valid 64-character hex verification pubkey
    nsec: 'nsec1test',
    npub: 'npub1test',
  }),
}));

vi.mock('@/features/geocache/utils/nip-gc', () => ({
  NIP_GC_KINDS: {
    GEOCACHE: 37515,
  },
  buildGeocacheTags: vi.fn().mockReturnValue([
    ['d', 'test-dtag'],
    ['name', 'Test Cache'],
    ['verification', 'c'.repeat(64)],
  ]),
  parseGeocacheEvent: vi.fn().mockReturnValue({
    id: 'new-event-id',
    pubkey: 'a'.repeat(64), // Valid 64-character hex pubkey
    created_at: Math.floor(Date.now() / 1000),
    dTag: 'test-dtag',
    name: 'Test Cache',
    description: 'Test description',
    location: { lat: 40.7128, lng: -74.0060 },
    difficulty: 3,
    terrain: 2,
    size: 'regular' as const,
    type: 'traditional' as const,
    verificationPubkey: 'c'.repeat(64), // Valid 64-character hex verification pubkey
  }),
}));

describe('QR Regeneration Cache Fix', () => {
  let queryClient: QueryClient;
  let mockGeocache: Geocache;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    mockGeocache = {
      id: 'test-id',
      pubkey: 'a'.repeat(64), // Valid 64-character hex pubkey
      created_at: Math.floor(Date.now() / 1000),
      dTag: 'test-dtag',
      name: 'Test Cache',
      description: 'Test description',
      location: { lat: 40.7128, lng: -74.0060 },
      difficulty: 3,
      terrain: 2,
      size: 'regular',
      type: 'traditional',
      verificationPubkey: 'b'.repeat(64), // Valid 64-character hex verification pubkey
      foundCount: 5,
      logCount: 10,
      relays: ['wss://relay1.com', 'wss://relay2.com'],
    };

    // Set up initial cache data
    const naddr = geocacheToNaddr(mockGeocache.pubkey, mockGeocache.dTag, mockGeocache.relays);
    queryClient.setQueryData(['geocache-by-naddr', naddr], mockGeocache);
    queryClient.setQueryData(['geocache', mockGeocache.id], mockGeocache);
    queryClient.setQueryData(['geocache-by-dtag', mockGeocache.dTag], mockGeocache);
  });

  it('should update all relevant cache keys when regenerating QR code', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useRegenerateVerificationKey(mockGeocache), {
      wrapper,
    });

    // Trigger the regeneration
    result.current.mutate();

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Check that all cache keys were updated with the new verification pubkey
    const naddr = geocacheToNaddr(mockGeocache.pubkey, mockGeocache.dTag, mockGeocache.relays);
    
    const naddrCacheData = queryClient.getQueryData(['geocache-by-naddr', naddr]) as Geocache;
    const idCacheData = queryClient.getQueryData(['geocache', mockGeocache.id]) as Geocache;
    const dtagCacheData = queryClient.getQueryData(['geocache-by-dtag', mockGeocache.dTag]) as Geocache;

    // All cache entries should have the new verification pubkey
    expect(naddrCacheData?.verificationPubkey).toBe('c'.repeat(64));
    expect(idCacheData?.verificationPubkey).toBe('c'.repeat(64));
    expect(dtagCacheData?.verificationPubkey).toBe('c'.repeat(64));

    // Verify that foundCount and logCount were preserved
    expect(naddrCacheData?.foundCount).toBe(5);
    expect(naddrCacheData?.logCount).toBe(10);
    expect(idCacheData?.foundCount).toBe(5);
    expect(idCacheData?.logCount).toBe(10);
    expect(dtagCacheData?.foundCount).toBe(5);
    expect(dtagCacheData?.logCount).toBe(10);
  });

  it('should handle the case when naddr cache key is the primary one used by CacheDetail', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    // Clear other cache keys to simulate CacheDetail.tsx scenario
    queryClient.removeQueries({ queryKey: ['geocache', mockGeocache.id] });
    queryClient.removeQueries({ queryKey: ['geocache-by-dtag', mockGeocache.dTag] });

    const { result } = renderHook(() => useRegenerateVerificationKey(mockGeocache), {
      wrapper,
    });

    // Trigger the regeneration
    result.current.mutate();

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // The naddr cache should still be updated correctly
    const naddr = geocacheToNaddr(mockGeocache.pubkey, mockGeocache.dTag, mockGeocache.relays);
    const naddrCacheData = queryClient.getQueryData(['geocache-by-naddr', naddr]) as Geocache;

    expect(naddrCacheData?.verificationPubkey).toBe('c'.repeat(64));
    expect(naddrCacheData?.foundCount).toBe(5);
    expect(naddrCacheData?.logCount).toBe(10);
  });
});