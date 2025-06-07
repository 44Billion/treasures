import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useCreateVerifiedLog } from '@/hooks/useCreateVerifiedLog';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNostr } from '@nostrify/react';
import { useToast } from '@/hooks/useToast';

// Mock dependencies
vi.mock('@/hooks/useCurrentUser');
vi.mock('@nostrify/react');
vi.mock('@/hooks/useToast');
vi.mock('@/lib/verification');

const mockUser = {
  pubkey: 'test-pubkey',
  signer: {
    signEvent: vi.fn().mockResolvedValue({
      id: 'test-event-id',
      pubkey: 'test-pubkey',
      created_at: 1234567890,
      kind: 1,
      tags: [],
      content: 'test content',
      sig: 'test-sig'
    })
  }
};

const mockNostr = {
  event: vi.fn(),
  query: vi.fn()
};

const mockToast = vi.fn();

describe('useCreateVerifiedLog', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false }
      }
    });
    
    vi.clearAllMocks();
    
    (useCurrentUser as any).mockReturnValue({ user: mockUser });
    (useNostr as any).mockReturnValue({ nostr: mockNostr });
    (useToast as any).mockReturnValue({ toast: mockToast });
    
    // Mock createVerificationEvent
    const { createVerificationEvent } = require('@/lib/verification');
    createVerificationEvent.mockResolvedValue({
      id: 'verification-event-id',
      pubkey: 'verification-pubkey',
      created_at: 1234567890,
      kind: 37516,
      tags: [],
      content: 'verification content',
      sig: 'verification-sig'
    });
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );

  it('should retry publishing on failure', async () => {
    // Mock first two attempts to fail, third to succeed
    mockNostr.event
      .mockRejectedValueOnce(new Error('timeout'))
      .mockRejectedValueOnce(new Error('relay error'))
      .mockResolvedValueOnce(undefined);
    
    // Mock query for verification to succeed
    mockNostr.query.mockResolvedValue([{ id: 'test-event-id' }]);

    const { result } = renderHook(() => useCreateVerifiedLog(), { wrapper });

    const testData = {
      geocacheId: 'test-cache-id',
      geocacheDTag: 'test-dtag',
      geocachePubkey: 'test-cache-pubkey',
      relayUrl: 'wss://test-relay.com',
      preferredRelays: ['wss://test-relay.com'],
      type: 'found' as const,
      text: 'Found the cache!',
      verificationKey: 'nsec1test'
    };

    result.current.mutate(testData);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Should have tried 3 times
    expect(mockNostr.event).toHaveBeenCalledTimes(3);
  });

  it('should fail after maximum retries', async () => {
    // Mock all attempts to fail
    mockNostr.event.mockRejectedValue(new Error('persistent error'));

    const { result } = renderHook(() => useCreateVerifiedLog(), { wrapper });

    const testData = {
      geocacheId: 'test-cache-id',
      geocacheDTag: 'test-dtag',
      geocachePubkey: 'test-cache-pubkey',
      relayUrl: 'wss://test-relay.com',
      preferredRelays: ['wss://test-relay.com'],
      type: 'found' as const,
      text: 'Found the cache!',
      verificationKey: 'nsec1test'
    };

    result.current.mutate(testData);

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    // Should have tried maximum number of times
    expect(mockNostr.event).toHaveBeenCalledTimes(5); // VERIFIED_LOG_MAX_RETRIES
    
    // Should show error toast
    expect(mockToast).toHaveBeenCalledWith({
      title: 'Failed to post verified log',
      description: expect.stringContaining('multiple attempts'),
      variant: 'destructive'
    });
  });

  it('should verify event was published', async () => {
    // Mock publishing to succeed
    mockNostr.event.mockResolvedValue(undefined);
    
    // Mock verification query to find the event
    mockNostr.query.mockResolvedValue([{ id: 'test-event-id' }]);

    const { result } = renderHook(() => useCreateVerifiedLog(), { wrapper });

    const testData = {
      geocacheId: 'test-cache-id',
      geocacheDTag: 'test-dtag',
      geocachePubkey: 'test-cache-pubkey',
      relayUrl: 'wss://test-relay.com',
      preferredRelays: ['wss://test-relay.com'],
      type: 'found' as const,
      text: 'Found the cache!',
      verificationKey: 'nsec1test'
    };

    result.current.mutate(testData);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Should have queried to verify the event was published
    expect(mockNostr.query).toHaveBeenCalledWith(
      [{ ids: ['test-event-id'] }],
      expect.any(Object)
    );
  });

  it('should handle timeout errors gracefully', async () => {
    mockNostr.event.mockRejectedValue(new Error('timeout'));

    const { result } = renderHook(() => useCreateVerifiedLog(), { wrapper });

    const testData = {
      geocacheId: 'test-cache-id',
      geocacheDTag: 'test-dtag',
      geocachePubkey: 'test-cache-pubkey',
      relayUrl: 'wss://test-relay.com',
      preferredRelays: ['wss://test-relay.com'],
      type: 'found' as const,
      text: 'Found the cache!',
      verificationKey: 'nsec1test'
    };

    result.current.mutate(testData);

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(mockToast).toHaveBeenCalledWith({
      title: 'Failed to post verified log',
      description: expect.stringContaining('timeout after multiple attempts'),
      variant: 'destructive'
    });
  });
});