import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useCreateVerifiedLog } from '@/features/logging/hooks/useCreateVerifiedLog';
import { useCurrentUser } from '@/shared/stores/simpleStores';
import { useToast } from '@/shared/hooks/useToast';
import { useNostrPublish } from '@/shared/hooks/useNostrPublish';

// Mock dependencies
vi.mock('@/shared/stores/simpleStores');
vi.mock('@/shared/hooks/useToast');
vi.mock('@/shared/hooks/useNostrPublish');
vi.mock('@/features/geocache/utils/verification');

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

const mockToast = vi.fn();
const mockPublishEvent = vi.fn();

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
    (useToast as any).mockReturnValue({ toast: mockToast });
    (useNostrPublish as any).mockReturnValue({ 
      mutateAsync: mockPublishEvent,
      isPending: false 
    });
    
    // Mock createVerificationEvent
    const { createVerificationEvent } = require('@/features/geocache/utils/verification');
    createVerificationEvent.mockResolvedValue({
      id: 'verification-event-id',
      pubkey: 'verification-pubkey',
      created_at: 1234567890,
      kind: 7517,
      tags: [['a', 'test-pubkey:naddr1test']],
      content: 'Geocache verification for npub1test',
      sig: 'verification-sig'
    });
    
    // Mock successful publishing by default
    mockPublishEvent.mockResolvedValue({
      id: 'test-event-id',
      pubkey: 'test-pubkey',
      created_at: 1234567890,
      kind: 7516,
      tags: [['a', '37515:test-cache-pubkey:test-dtag']],
      content: 'Found the cache!',
      sig: 'test-sig'
    });
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );

  it('should successfully create and publish verified log', async () => {
    const { result } = renderHook(() => useCreateVerifiedLog(), { wrapper });

    const testData = {
      geocacheId: 'test-cache-id',
      geocacheDTag: 'test-dtag',
      geocachePubkey: 'test-cache-pubkey',
      type: 'found' as const,
      text: 'Found the cache!',
      verificationKey: 'nsec1test'
    };

    result.current.mutate(testData);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Should have called createVerificationEvent
    const { createVerificationEvent } = require('@/features/geocache/utils/verification');
    expect(createVerificationEvent).toHaveBeenCalledWith(
      'nsec1test',
      'test-pubkey',
      'test-cache-pubkey',
      'test-dtag'
    );

    // Should have called publishEvent with correct template
    expect(mockPublishEvent).toHaveBeenCalledWith({
      kind: 7516,
      content: 'Found the cache!',
      tags: expect.arrayContaining([
        ['a', '37515:test-cache-pubkey:test-dtag'],
        ['verification', expect.any(String)]
      ])
    });
  });

  it('should handle verification event creation failure', async () => {
    const { createVerificationEvent } = require('@/features/geocache/utils/verification');
    createVerificationEvent.mockRejectedValue(new Error('Invalid verification key format'));

    const { result } = renderHook(() => useCreateVerifiedLog(), { wrapper });

    const testData = {
      geocacheId: 'test-cache-id',
      geocacheDTag: 'test-dtag',
      geocachePubkey: 'test-cache-pubkey',
      type: 'found' as const,
      text: 'Found the cache!',
      verificationKey: 'invalid-key'
    };

    result.current.mutate(testData);

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(mockToast).toHaveBeenCalledWith({
      title: 'Failed to post verified log',
      description: 'Invalid verification key format. Please check the QR code.',
      variant: 'destructive'
    });
  });

  it('should handle publishing failure', async () => {
    mockPublishEvent.mockRejectedValue(new Error('Failed to publish event after 2 attempts: timeout'));

    const { result } = renderHook(() => useCreateVerifiedLog(), { wrapper });

    const testData = {
      geocacheId: 'test-cache-id',
      geocacheDTag: 'test-dtag',
      geocachePubkey: 'test-cache-pubkey',
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
      description: 'Failed to publish verified log: Failed to publish event after 2 attempts: timeout',
      variant: 'destructive'
    });
  });

  it('should handle user cancellation', async () => {
    mockPublishEvent.mockRejectedValue(new Error('Event signing was cancelled.'));

    const { result } = renderHook(() => useCreateVerifiedLog(), { wrapper });

    const testData = {
      geocacheId: 'test-cache-id',
      geocacheDTag: 'test-dtag',
      geocachePubkey: 'test-cache-pubkey',
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
      description: 'Verified log signing was cancelled.',
      variant: 'destructive'
    });
  });

  it('should validate required fields', async () => {
    const { result } = renderHook(() => useCreateVerifiedLog(), { wrapper });

    const testData = {
      geocacheId: '',
      geocacheDTag: 'test-dtag',
      geocachePubkey: 'test-cache-pubkey',
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
      description: 'Geocache ID is required',
      variant: 'destructive'
    });
  });

  it('should require user to be logged in', async () => {
    (useCurrentUser as any).mockReturnValue({ user: null });

    const { result } = renderHook(() => useCreateVerifiedLog(), { wrapper });

    const testData = {
      geocacheId: 'test-cache-id',
      geocacheDTag: 'test-dtag',
      geocachePubkey: 'test-cache-pubkey',
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
      description: 'User must be logged in to create verified logs',
      variant: 'destructive'
    });
  });

  it('should only allow found logs to be verified', async () => {
    const { result } = renderHook(() => useCreateVerifiedLog(), { wrapper });

    const testData = {
      geocacheId: 'test-cache-id',
      geocacheDTag: 'test-dtag',
      geocachePubkey: 'test-cache-pubkey',
      type: 'dnf' as const,
      text: 'Did not find',
      verificationKey: 'nsec1test'
    };

    result.current.mutate(testData);

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(mockToast).toHaveBeenCalledWith({
      title: 'Failed to post verified log',
      description: 'Only found logs can be verified',
      variant: 'destructive'
    });
  });
});