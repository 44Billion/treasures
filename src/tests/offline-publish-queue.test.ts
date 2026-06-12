/**
 * Offline publish queue tests (src/lib/offlinePublishQueue.ts).
 *
 * Uses fake-indexeddb (installed in test-setup.ts) as the backing store.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { NostrEvent } from '@nostrify/nostrify';
import {
  enqueueEvent,
  getQueuedEventCount,
  getQueuedEvents,
  removeQueuedEvent,
  pruneStaleEvents,
  flushQueuedEvents,
  _resetQueueForTests,
} from '@/lib/offlinePublishQueue';

let eventCounter = 0;

function makeEvent(overrides: Partial<NostrEvent> = {}): NostrEvent {
  eventCounter++;
  return {
    id: `event-${eventCounter}-${Date.now()}`,
    kind: 7516,
    pubkey: 'f'.repeat(64),
    content: 'Found it!',
    tags: [['a', '37516:owner:dtag']],
    created_at: Math.floor(Date.now() / 1000),
    sig: 'a'.repeat(128),
    ...overrides,
  };
}

describe('offlinePublishQueue', () => {
  beforeEach(async () => {
    // Reset the cached connection and clear leftover entries.
    _resetQueueForTests();
    const events = await getQueuedEvents();
    for (const event of events) {
      await removeQueuedEvent(event.id);
    }
  });

  it('enqueues and counts events', async () => {
    expect(await getQueuedEventCount()).toBe(0);
    await enqueueEvent(makeEvent());
    await enqueueEvent(makeEvent());
    expect(await getQueuedEventCount()).toBe(2);
  });

  it('is idempotent for the same event id', async () => {
    const event = makeEvent();
    await enqueueEvent(event);
    await enqueueEvent(event);
    expect(await getQueuedEventCount()).toBe(1);
  });

  it('returns events oldest-first', async () => {
    const first = makeEvent();
    const second = makeEvent();
    const nowSpy = vi.spyOn(Date, 'now');
    try {
      nowSpy.mockReturnValue(1_000_000);
      await enqueueEvent(second);
      nowSpy.mockReturnValue(500_000);
      await enqueueEvent(first);
    } finally {
      nowSpy.mockRestore();
    }

    const events = await getQueuedEvents();
    expect(events.map((e) => e.id)).toEqual([first.id, second.id]);
  });

  it('flushes successfully published events and keeps failures queued', async () => {
    const ok = makeEvent();
    const bad = makeEvent();
    await enqueueEvent(ok);
    await enqueueEvent(bad);

    const publish = vi.fn().mockImplementation(async (event: NostrEvent) => {
      if (event.id === bad.id) throw new Error('relay unreachable');
    });

    const result = await flushQueuedEvents(publish);
    expect(result.published).toBe(1);
    expect(result.remaining).toBe(1);

    const remaining = await getQueuedEvents();
    expect(remaining.map((e) => e.id)).toEqual([bad.id]);
  });

  it('prunes events older than 7 days', async () => {
    const now = Date.now();
    const stale = makeEvent();
    const fresh = makeEvent();

    const nowSpy = vi.spyOn(Date, 'now');
    try {
      nowSpy.mockReturnValue(now - 8 * 24 * 60 * 60 * 1000);
      await enqueueEvent(stale);
      nowSpy.mockReturnValue(now);
      await enqueueEvent(fresh);
    } finally {
      nowSpy.mockRestore();
    }

    const dropped = await pruneStaleEvents(now);
    expect(dropped).toBe(1);

    const events = await getQueuedEvents();
    expect(events.map((e) => e.id)).toEqual([fresh.id]);
  });

  it('flush is a no-op on an empty queue', async () => {
    const publish = vi.fn();
    const result = await flushQueuedEvents(publish);
    expect(result).toEqual({ published: 0, remaining: 0 });
    expect(publish).not.toHaveBeenCalled();
  });
});
