import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useRegenerateVerificationKey } from '@/features/geocache/hooks/useRegenerateVerificationKey';
import type { Geocache } from '@/types/geocache';
import { NIP_GC_KINDS } from '@/features/geocache/utils/nip-gc';

// Create a mock function that we can track
const mockPublishEvent = vi.fn().mockImplementation(async (eventTemplate) => {
  // Simulate creating a new event with a new ID and timestamp
  return {
    id: `new-event-id-${Date.now()}`,
    pubkey: 'test-pubkey',
    created_at: Math.floor(Date.now() / 1000),
    kind: eventTemplate.kind,
    content: eventTemplate.content,
    tags: eventTemplate.tags,
    sig: 'mock-signature',
  };
});

const mockToast = vi.fn();

// Mock the dependencies
vi.mock('@/shared/hooks/useNostrPublish', () => ({
  useNostrPublish: () => ({
    mutateAsync: mockPublishEvent,
  }),
}));

vi.mock('@/shared/hooks/useToast', () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}));

vi.mock('@/features/geocache/utils/verification', () => ({
  generateVerificationKeyPair: vi.fn().mockResolvedValue({
    privateKey: new Uint8Array(32),
    publicKey: 'new-verification-pubkey',
    nsec: 'nsec1new-verification-key',
    npub: 'npub1new-verification-key',
  }),
  isCurrentVerificationKey: vi.fn().mockImplementation((verificationPubkey: string, currentVerificationPubkey: string) => {
    return verificationPubkey === currentVerificationPubkey;
  }),
  isOutdatedVerificationKey: vi.fn().mockImplementation((verificationPubkey: string, currentVerificationPubkey: string) => {
    return verificationPubkey !== currentVerificationPubkey;
  }),
}));

// Mock the naddr utils
vi.mock('@/shared/utils/naddr-utils', () => ({
  geocacheToNaddr: vi.fn().mockReturnValue('naddr1test-naddr'),
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

const mockGeocache: Geocache = {
  id: 'original-event-id',
  pubkey: 'test-pubkey',
  created_at: 1234567890,
  dTag: 'test-cache',
  name: 'Test Cache',
  description: 'A test geocache',
  location: { lat: 40.7128, lng: -74.0060 },
  difficulty: 2,
  terrain: 3,
  size: 'regular',
  type: 'traditional',
  images: [],
  relays: [],
  verificationPubkey: 'old-verification-pubkey',
  hidden: false,
};

describe('QR Code Regeneration - New Event Creation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPublishEvent.mockClear();
    mockToast.mockClear();
  });

  it('should create a new geocache event when regenerating QR code', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(
      () => useRegenerateVerificationKey(mockGeocache),
      { wrapper }
    );

    // Trigger the regeneration
    result.current.mutate();

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    }, { timeout: 5000 });

    // Verify that a new event was created
    expect(mockPublishEvent).toHaveBeenCalledWith({
      kind: NIP_GC_KINDS.GEOCACHE,
      content: mockGeocache.description,
      tags: expect.arrayContaining([
        ['d', mockGeocache.dTag],
        ['name', mockGeocache.name],
        ['verification', 'new-verification-pubkey'], // New verification key
      ]),
    });
  });

  it('should generate a new verification key pair', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(
      () => useRegenerateVerificationKey(mockGeocache),
      { wrapper }
    );

    result.current.mutate();

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    }, { timeout: 5000 });

    const { generateVerificationKeyPair } = await import('@/features/geocache/utils/verification');
    expect(generateVerificationKeyPair).toHaveBeenCalled();
  });

  it('should return both the new event and verification key pair', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(
      () => useRegenerateVerificationKey(mockGeocache),
      { wrapper }
    );

    result.current.mutate();

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    }, { timeout: 5000 });

    expect(result.current.data).toEqual({
      event: expect.objectContaining({
        id: expect.stringMatching(/^new-event-id-/),
        kind: NIP_GC_KINDS.GEOCACHE,
        content: mockGeocache.description,
      }),
      verificationKeyPair: expect.objectContaining({
        publicKey: 'new-verification-pubkey',
        nsec: 'nsec1new-verification-key',
      }),
    });
  });

  it('should create event with different ID than original', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(
      () => useRegenerateVerificationKey(mockGeocache),
      { wrapper }
    );

    result.current.mutate();

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    }, { timeout: 5000 });

    const newEvent = result.current.data?.event;
    expect(newEvent?.id).not.toBe(mockGeocache.id);
    expect(newEvent?.id).toMatch(/^new-event-id-/);
  });

  it('should preserve all geocache properties except verification key', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(
      () => useRegenerateVerificationKey(mockGeocache),
      { wrapper }
    );

    result.current.mutate();

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    }, { timeout: 5000 });

    const publishedEvent = mockPublishEvent.mock.calls[0][0];

    // Check that all original properties are preserved
    expect(publishedEvent.content).toBe(mockGeocache.description);
    expect(publishedEvent.kind).toBe(NIP_GC_KINDS.GEOCACHE);
    
    // Check that tags include all original data
    const tags = publishedEvent.tags;
    expect(tags).toContainEqual(['d', mockGeocache.dTag]);
    expect(tags).toContainEqual(['name', mockGeocache.name]);
    expect(tags).toContainEqual(['difficulty', mockGeocache.difficulty.toString()]);
    expect(tags).toContainEqual(['terrain', mockGeocache.terrain.toString()]);
    expect(tags).toContainEqual(['size', mockGeocache.size]);
    
    // But verification key should be different
    expect(tags).toContainEqual(['verification', 'new-verification-pubkey']);
    expect(tags).not.toContainEqual(['verification', 'old-verification-pubkey']);
  });

  it('should handle error when no geocache is provided', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(
      () => useRegenerateVerificationKey(null),
      { wrapper }
    );

    result.current.mutate();

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    }, { timeout: 5000 });

    expect(result.current.error).toEqual(new Error('No geocache provided'));
  });

  it('should invalidate old verification keys', async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(
      () => useRegenerateVerificationKey(mockGeocache),
      { wrapper }
    );

    // Store the old verification key
    const oldVerificationKey = mockGeocache.verificationPubkey;

    result.current.mutate();

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    }, { timeout: 5000 });

    // Use the mock directly instead of importing the hook
    const publishedEvent = mockPublishEvent.mock.calls[0][0];

    // Verify the new verification key is different
    const newVerificationTag = publishedEvent.tags.find((tag: string[]) => tag[0] === 'verification');
    expect(newVerificationTag).toBeDefined();
    expect(newVerificationTag[1]).toBe('new-verification-pubkey');
    expect(newVerificationTag[1]).not.toBe(oldVerificationKey);

    // Verify old key is not referenced in the new event
    const allTags = publishedEvent.tags.flat();
    expect(allTags).not.toContain(oldVerificationKey);
  });

  it('should validate verification keys correctly', async () => {
    // Import verification utilities
    const { isCurrentVerificationKey, isOutdatedVerificationKey } = await import('@/features/geocache/utils/verification');

    const currentKey = 'new-verification-pubkey';
    const oldKey = 'old-verification-pubkey';

    // Test current key validation
    expect(isCurrentVerificationKey(currentKey, currentKey)).toBe(true);
    expect(isCurrentVerificationKey(oldKey, currentKey)).toBe(false);

    // Test outdated key detection
    expect(isOutdatedVerificationKey(oldKey, currentKey)).toBe(true);
    expect(isOutdatedVerificationKey(currentKey, currentKey)).toBe(false);
  });
});