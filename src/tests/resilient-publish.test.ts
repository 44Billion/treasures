/**
 * Tests for the shared resilient publish primitive (src/lib/resilientPublish.ts).
 *
 * This is the delivery path used by both `useNostrPublish` and the core
 * geocache store. The bug it fixes: creating a treasure used a one-shot
 * 8s publish with no retry and no offline queue, so a flaky connection
 * silently dropped the event into a "Not synced" draft. These tests pin the
 * offline / connectivity-failure queueing behavior for the store path.
 *
 * Uses fake-indexeddb (installed in test-setup.ts) as the queue backing store.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { NostrEvent } from '@nostrify/nostrify';
import { resilientPublish, type ResilientPublishTarget } from '@/lib/resilientPublish';
import {
  getQueuedEvents,
  getQueuedEventCount,
  removeQueuedEvent,
  _resetQueueForTests,
} from '@/lib/offlinePublishQueue';

let eventCounter = 0;

function makeEvent(overrides: Partial<NostrEvent> = {}): NostrEvent {
  eventCounter++;
  return {
    id: `event-${eventCounter}-${Date.now()}`,
    kind: 37516,
    pubkey: 'f'.repeat(64),
    content: 'A new treasure',
    tags: [['d', 'abc123']],
    created_at: Math.floor(Date.now() / 1000),
    sig: 'a'.repeat(128),
    ...overrides,
  };
}

function setOnline(value: boolean) {
  Object.defineProperty(navigator, 'onLine', {
    configurable: true,
    value,
  });
}

describe('resilientPublish', () => {
  beforeEach(async () => {
    _resetQueueForTests();
    const events = await getQueuedEvents();
    for (const event of events) {
      await removeQueuedEvent(event.id);
    }
    setOnline(true);
  });

  afterEach(() => {
    setOnline(true);
    vi.restoreAllMocks();
  });

  it('publishes when relays accept the event and does not queue', async () => {
    const event = makeEvent();
    const nostr: ResilientPublishTarget = { event: vi.fn().mockResolvedValue(undefined) };

    const result = await resilientPublish(nostr, event);

    expect(result.status).toBe('published');
    expect(nostr.event).toHaveBeenCalledTimes(1);
    expect(await getQueuedEventCount()).toBe(0);
  });

  it('queues the event without attempting delivery when offline', async () => {
    setOnline(false);
    const event = makeEvent();
    const nostr: ResilientPublishTarget = { event: vi.fn() };

    const result = await resilientPublish(nostr, event);

    expect(result.status).toBe('queued');
    // Must NOT try to hit relays while offline.
    expect(nostr.event).not.toHaveBeenCalled();
    const queued = await getQueuedEvents();
    expect(queued.map((e) => e.id)).toEqual([event.id]);
  });

  it('queues the event after all retries fail with a connectivity error', async () => {
    const event = makeEvent();
    const nostr: ResilientPublishTarget = {
      event: vi.fn().mockRejectedValue(new Error('relay connection timeout')),
    };

    const result = await resilientPublish(nostr, event);

    expect(result.status).toBe('queued');
    // Retried up to PUBLISH_MAX_RETRIES (2) before queueing.
    expect(nostr.event).toHaveBeenCalledTimes(2);
    const queued = await getQueuedEvents();
    expect(queued.map((e) => e.id)).toEqual([event.id]);
  });

  it('retries then succeeds on a transient failure without queueing', async () => {
    const event = makeEvent();
    const eventFn = vi
      .fn()
      .mockRejectedValueOnce(new Error('network blip'))
      .mockResolvedValueOnce(undefined);
    const nostr: ResilientPublishTarget = { event: eventFn };

    const result = await resilientPublish(nostr, event);

    expect(result.status).toBe('published');
    expect(eventFn).toHaveBeenCalledTimes(2);
    expect(await getQueuedEventCount()).toBe(0);
  });

  it('does not retry or queue a user-cancelled signer error', async () => {
    const event = makeEvent();
    const nostr: ResilientPublishTarget = {
      event: vi.fn().mockRejectedValue(new Error('User rejected the request')),
    };

    await expect(resilientPublish(nostr, event)).rejects.toThrow(/User rejected/);
    expect(nostr.event).toHaveBeenCalledTimes(1);
    expect(await getQueuedEventCount()).toBe(0);
  });

  it('throws (does not queue) on a non-connectivity relay rejection', async () => {
    const event = makeEvent();
    const nostr: ResilientPublishTarget = {
      event: vi.fn().mockRejectedValue(new Error('relay rejected: invalid event')),
    };

    await expect(resilientPublish(nostr, event)).rejects.toThrow();
    // Not a connectivity error, so it is surfaced rather than silently queued.
    expect(await getQueuedEventCount()).toBe(0);
  });
});
