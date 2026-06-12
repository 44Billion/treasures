/**
 * Regression test: editing a geocache must not drop the NIP-36
 * `content-warning` tag from the replacement event.
 *
 * Bug: `useEditGeocache` did not accept or forward `contentWarning`, so any
 * edit (or FTF lock-in) silently stripped the content warning from the
 * listing even though the edit form collected the value.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEditGeocache } from '@/hooks/useEditGeocache';
import { NIP_GC_KINDS } from '@/utils/nip-gc';
import type { Geocache } from '@/types/geocache';

const mockPublishEvent = vi.fn();

vi.mock('@/hooks/useNostrPublish', () => ({
  useNostrPublish: () => ({ mutateAsync: mockPublishEvent }),
}));

vi.mock('@/hooks/useToast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

const originalGeocache: Geocache = {
  id: 'cache-event-id',
  kind: NIP_GC_KINDS.GEOCACHE,
  name: 'Spooky Cache',
  pubkey: 'owner-pubkey',
  created_at: 1700000000,
  dTag: 'spooky-cache',
  difficulty: 2,
  terrain: 2,
  size: 'small',
  type: 'traditional',
  description: 'A cache with sensitive imagery',
  location: { lat: 40.7128, lng: -74.006 },
  images: ['https://example.com/spoiler.jpg'],
  hidden: false,
  contentWarning: 'Spoiler: container photo',
};

const baseEdit = {
  name: 'Spooky Cache',
  description: 'A cache with sensitive imagery',
  difficulty: 2,
  terrain: 2,
  size: 'small' as const,
  type: 'traditional' as const,
  images: ['https://example.com/spoiler.jpg'],
  location: { lat: 40.7128, lng: -74.006 },
};

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return wrapper;
}

function publishedTags(): string[][] {
  expect(mockPublishEvent).toHaveBeenCalledTimes(1);
  return mockPublishEvent.mock.calls[0][0].tags as string[][];
}

describe('useEditGeocache — content warning', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Resolve with a minimal event; onSuccess tolerates unparseable events.
    mockPublishEvent.mockResolvedValue({
      id: 'new-event-id',
      kind: NIP_GC_KINDS.GEOCACHE,
      pubkey: 'owner-pubkey',
      created_at: 1700000100,
      content: '',
      tags: [],
      sig: 'sig',
    });
  });

  it('includes the content-warning tag when the edit sets one', async () => {
    const { result } = renderHook(() => useEditGeocache(originalGeocache), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ ...baseEdit, contentWarning: 'New warning text' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(publishedTags()).toContainEqual(['content-warning', 'New warning text']);
  });

  it('preserves the original content warning when the edit omits the field', async () => {
    const { result } = renderHook(() => useEditGeocache(originalGeocache), {
      wrapper: createWrapper(),
    });

    // e.g. lockInFtfWinner-style republish that doesn't touch the warning
    result.current.mutate({ ...baseEdit, status: 'archived', ftfWinner: 'winner-pubkey' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(publishedTags()).toContainEqual([
      'content-warning',
      'Spoiler: container photo',
    ]);
  });

  it('clears the content warning when the edit sets an empty string', async () => {
    const { result } = renderHook(() => useEditGeocache(originalGeocache), {
      wrapper: createWrapper(),
    });

    result.current.mutate({ ...baseEdit, contentWarning: '' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const tags = publishedTags();
    expect(tags.find((t) => t[0] === 'content-warning')).toBeUndefined();
  });
});
