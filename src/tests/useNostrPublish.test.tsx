import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useNostrPublish } from '@/shared/hooks/useNostrPublish';
import { useCurrentUser } from '@/shared/stores/simpleStores';
import { useNostr } from '@nostrify/react';

// Mock dependencies
vi.mock('@/shared/stores/simpleStores');
vi.mock('@nostrify/react');
vi.mock('@/shared/utils/naddrnetworkUtils');

const mockUser = {
  pubkey: 'test-pubkey',
  signer: {
    signEvent: vi.fn().mockResolvedValue({
      id: 'test-event-id',
      pubkey: 'test-pubkey',
      created_at: 1234567890,
      kind: 1,
      tags: [['client', 'treasures']],
      content: 'test content',
      sig: 'test-sig'
    })
  }
};

const mockNostr = {
  event: vi.fn(),
  query: vi.fn()
};

describe('useNostrPublish', () => {
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

    // Mock getAdaptiveTimeout
    const { getAdaptiveTimeout } = require('@/shared/utils/naddrnetworkUtils');
    getAdaptiveTimeout.mockImplementation((timeout: number) => timeout);

    // Mock successful publishing and verification by default
    mockNostr.event.mockResolvedValue(undefined);
    mockNostr.query.mockResolvedValue([{ id: 'test-event-id' }]);
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );

  it('should successfully publish an event', async () => {
    const { result } = renderHook(() => useNostrPublish(), { wrapper });

    const eventTemplate = {
      kind: 1,
      content: 'Hello world',
      tags: [['t', 'test']]
    };

    result.current.mutate(eventTemplate);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockUser.signer.signEvent).toHaveBeenCalledWith({
      kind: 1,
      content: 'Hello world',
      tags: [['t', 'test'], ['client', 'treasures']],
      created_at: expect.any(Number)
    });

    expect(mockNostr.event).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'test-event-id',
        kind: 1,
        content: 'Hello world'
      }),
      expect.objectContaining({
        signal: expect.any(AbortSignal)
      })
    );
  });

  it('should add client tag if not present', async () => {
    const { result } = renderHook(() => useNostrPublish(), { wrapper });

    const eventTemplate = {
      kind: 1,
      content: 'Hello world'
    };

    result.current.mutate(eventTemplate);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockUser.signer.signEvent).toHaveBeenCalledWith({
      kind: 1,
      content: 'Hello world',
      tags: [['client', 'treasures']],
      created_at: expect.any(Number)
    });
  });

  it('should not duplicate client tag if already present', async () => {
    const { result } = renderHook(() => useNostrPublish(), { wrapper });

    const eventTemplate = {
      kind: 1,
      content: 'Hello world',
      tags: [['client', 'treasures'], ['t', 'test']]
    };

    result.current.mutate(eventTemplate);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockUser.signer.signEvent).toHaveBeenCalledWith({
      kind: 1,
      content: 'Hello world',
      tags: [['client', 'treasures'], ['t', 'test']],
      created_at: expect.any(Number)
    });
  });

  it('should handle user not logged in', async () => {
    (useCurrentUser as any).mockReturnValue({ user: null });

    const { result } = renderHook(() => useNostrPublish(), { wrapper });

    const eventTemplate = {
      kind: 1,
      content: 'Hello world'
    };

    result.current.mutate(eventTemplate);

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toEqual(new Error('User is not logged in'));
  });

  it('should handle missing signer', async () => {
    (useCurrentUser as any).mockReturnValue({ 
      user: { ...mockUser, signer: null } 
    });

    const { result } = renderHook(() => useNostrPublish(), { wrapper });

    const eventTemplate = {
      kind: 1,
      content: 'Hello world'
    };

    result.current.mutate(eventTemplate);

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toEqual(
      new Error('No signer available. Please check your Nostr extension.')
    );
  });

  it('should handle user cancellation', async () => {
    mockUser.signer.signEvent.mockRejectedValue(new Error('User rejected the request'));

    const { result } = renderHook(() => useNostrPublish(), { wrapper });

    const eventTemplate = {
      kind: 1,
      content: 'Hello world'
    };

    result.current.mutate(eventTemplate);

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toEqual(new Error('Event signing was cancelled.'));
  });

  it('should retry on publishing failure', async () => {
    mockNostr.event
      .mockRejectedValueOnce(new Error('timeout'))
      .mockRejectedValueOnce(new Error('relay error'))
      .mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useNostrPublish(), { wrapper });

    const eventTemplate = {
      kind: 1,
      content: 'Hello world'
    };

    result.current.mutate(eventTemplate);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockNostr.event).toHaveBeenCalledTimes(3);
  });

  it('should not retry on user cancellation', async () => {
    mockNostr.event.mockRejectedValue(new Error('User rejected the request'));

    const { result } = renderHook(() => useNostrPublish(), { wrapper });

    const eventTemplate = {
      kind: 1,
      content: 'Hello world'
    };

    result.current.mutate(eventTemplate);

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(mockNostr.event).toHaveBeenCalledTimes(1);
  });

  it('should fail after maximum retries', async () => {
    mockNostr.event.mockRejectedValue(new Error('persistent error'));

    const { result } = renderHook(() => useNostrPublish(), { wrapper });

    const eventTemplate = {
      kind: 1,
      content: 'Hello world'
    };

    result.current.mutate(eventTemplate);

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(mockNostr.event).toHaveBeenCalledTimes(2); // PUBLISH_MAX_RETRIES
    expect(result.current.error?.message).toContain('Failed to publish event after 2 attempts');
  });

  it('should handle timeout errors', async () => {
    mockNostr.event.mockRejectedValue(new Error('timeout'));

    const { result } = renderHook(() => useNostrPublish(), { wrapper });

    const eventTemplate = {
      kind: 1,
      content: 'Hello world'
    };

    result.current.mutate(eventTemplate);

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toContain('Connection timeout after multiple attempts');
  });

  it('should handle relay connection errors', async () => {
    mockNostr.event.mockRejectedValue(new Error('WebSocket connection failed'));

    const { result } = renderHook(() => useNostrPublish(), { wrapper });

    const eventTemplate = {
      kind: 1,
      content: 'Hello world'
    };

    result.current.mutate(eventTemplate);

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toContain('Relay connection failed after multiple attempts');
  });

  it('should handle no promise resolved error', async () => {
    mockNostr.event.mockRejectedValue(new Error('no promise in promise.any resolved'));

    const { result } = renderHook(() => useNostrPublish(), { wrapper });

    const eventTemplate = {
      kind: 1,
      content: 'Hello world'
    };

    result.current.mutate(eventTemplate);

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toContain('All relay connections failed after multiple attempts');
  });

  it('should verify event was published', async () => {
    const { result } = renderHook(() => useNostrPublish(), { wrapper });

    const eventTemplate = {
      kind: 1,
      content: 'Hello world'
    };

    result.current.mutate(eventTemplate);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockNostr.query).toHaveBeenCalledWith(
      [{ ids: ['test-event-id'] }],
      expect.objectContaining({
        signal: expect.any(AbortSignal)
      })
    );
  });

  it('should handle verification query failure gracefully', async () => {
    mockNostr.query.mockRejectedValue(new Error('Query failed'));

    const { result } = renderHook(() => useNostrPublish(), { wrapper });

    const eventTemplate = {
      kind: 1,
      content: 'Hello world'
    };

    result.current.mutate(eventTemplate);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Should still succeed even if verification fails
    expect(result.current.data).toBeDefined();
  });

  it('should warn if event not found in verification', async () => {
    mockNostr.query.mockResolvedValue([]); // Event not found

    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { result } = renderHook(() => useNostrPublish(), { wrapper });

    const eventTemplate = {
      kind: 1,
      content: 'Hello world'
    };

    result.current.mutate(eventTemplate);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(consoleSpy).toHaveBeenCalledWith(
      'Event not found in verification query, but publish succeeded'
    );

    consoleSpy.mockRestore();
  });

  it('should handle signing errors', async () => {
    mockUser.signer.signEvent.mockRejectedValue(new Error('signEvent failed'));

    const { result } = renderHook(() => useNostrPublish(), { wrapper });

    const eventTemplate = {
      kind: 1,
      content: 'Hello world'
    };

    result.current.mutate(eventTemplate);

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toEqual(
      new Error('Failed to sign event. Please check your Nostr extension.')
    );
  });

  it('should use adaptive timeout', async () => {
    const { getAdaptiveTimeout } = require('@/shared/utils/naddrnetworkUtils');
    getAdaptiveTimeout.mockReturnValue(15000);

    const { result } = renderHook(() => useNostrPublish(), { wrapper });

    const eventTemplate = {
      kind: 1,
      content: 'Hello world'
    };

    result.current.mutate(eventTemplate);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(getAdaptiveTimeout).toHaveBeenCalled();
  });

  it('should handle various user cancellation messages', async () => {
    const cancellationMessages = [
      'User rejected',
      'cancelled',
      'denied',
      'user denied',
      'user cancelled',
      'user rejected'
    ];

    for (const message of cancellationMessages) {
      vi.clearAllMocks();
      mockUser.signer.signEvent.mockRejectedValue(new Error(message));

      const { result } = renderHook(() => useNostrPublish(), { wrapper });

      const eventTemplate = {
        kind: 1,
        content: 'Hello world'
      };

      result.current.mutate(eventTemplate);

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toEqual(new Error('Event signing was cancelled.'));
    }
  });
});