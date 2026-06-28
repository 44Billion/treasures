/**
 * useOfflineQueue tests (src/hooks/useOfflineQueue.ts).
 *
 * The hook surfaces the device-local offline publish queue and lets the user
 * retry or discard a single pending treasure. Uses fake-indexeddb (installed
 * in test-setup.ts) as the backing store.
 */
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NostrEvent } from '@nostrify/nostrify';
import { useOfflineQueue } from '@/hooks/useOfflineQueue';
import {
  enqueueEvent,
  getQueuedEvents,
  removeQueuedEvent,
  _resetQueueForTests,
} from '@/lib/offlinePublishQueue';

const pubkey = 'f'.repeat(64);

let eventFn = vi.fn();

vi.mock('@nostrify/react', () => ({
  useNostr: () => ({ nostr: { event: (...args: unknown[]) => eventFn(...args) } }),
}));

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: { pubkey } }),
}));

let counter = 0;
function makeEvent(overrides: Partial<NostrEvent> = {}): NostrEvent {
  counter++;
  return {
    id: `evt-${counter}-${Date.now()}`,
    kind: 37516,
    pubkey,
    content: 'A treasure',
    tags: [['d', `dtag-${counter}`], ['name', `Treasure ${counter}`]],
    created_at: Math.floor(Date.now() / 1000),
    sig: 'a'.repeat(128),
    ...overrides,
  };
}

function setOnline(value: boolean) {
  Object.defineProperty(navigator, 'onLine', { configurable: true, value });
}

describe('useOfflineQueue', () => {
  let queryClient: QueryClient;

  beforeEach(async () => {
    _resetQueueForTests();
    for (const e of await getQueuedEvents()) await removeQueuedEvent(e.id);
    setOnline(true);
    eventFn = vi.fn().mockResolvedValue(undefined);
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it('lists queued events for the current user', async () => {
    await enqueueEvent(makeEvent());
    await enqueueEvent(makeEvent({ pubkey: 'other'.padEnd(64, '0') }));

    const { result } = renderHook(() => useOfflineQueue(), { wrapper });

    await waitFor(() => expect(result.current.queued.data).toHaveLength(1));
    expect(result.current.queued.data?.[0].pubkey).toBe(pubkey);
  });

  it('retry publishes and removes the event from the queue', async () => {
    const event = makeEvent();
    await enqueueEvent(event);

    const { result } = renderHook(() => useOfflineQueue(), { wrapper });
    await waitFor(() => expect(result.current.queued.data).toHaveLength(1));

    let status: string | undefined;
    await act(async () => {
      status = await result.current.retryOne.mutateAsync(event);
    });

    expect(status).toBe('published');
    expect(eventFn).toHaveBeenCalledTimes(1);
    expect(await getQueuedEvents()).toHaveLength(0);
  });

  it('retry while offline keeps the event queued', async () => {
    setOnline(false);
    const event = makeEvent();
    await enqueueEvent(event);

    const { result } = renderHook(() => useOfflineQueue(), { wrapper });
    await waitFor(() => expect(result.current.queued.data).toHaveLength(1));

    let status: string | undefined;
    await act(async () => {
      status = await result.current.retryOne.mutateAsync(event);
    });

    expect(status).toBe('queued');
    expect(eventFn).not.toHaveBeenCalled();
    expect(await getQueuedEvents()).toHaveLength(1);
  });

  it('discard removes the event without publishing', async () => {
    const event = makeEvent();
    await enqueueEvent(event);

    const { result } = renderHook(() => useOfflineQueue(), { wrapper });
    await waitFor(() => expect(result.current.queued.data).toHaveLength(1));

    await act(async () => {
      await result.current.discardOne.mutateAsync(event.id);
    });

    expect(eventFn).not.toHaveBeenCalled();
    expect(await getQueuedEvents()).toHaveLength(0);
  });
});
