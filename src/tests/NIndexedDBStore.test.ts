import { describe, expect, it } from 'vitest';
import type { NostrEvent } from '@nostrify/nostrify';
import { NIndexedDBStore } from '@/lib/NIndexedDBStore';

// `fake-indexeddb/auto` (installed in test-setup.ts) provides a real in-memory
// IndexedDB under jsdom. Each test uses a unique DB name for isolation.

// A valid 64-char lowercase hex id.
const hex = (n: number) => n.toString(16).padStart(64, '0');

function makeEvent(overrides: Partial<NostrEvent> = {}): NostrEvent {
  return {
    id: hex(1),
    pubkey: 'a'.repeat(64),
    created_at: 1000,
    kind: 1,
    tags: [],
    content: 'hello',
    sig: 'b'.repeat(128),
    ...overrides,
  };
}

async function openStore() {
  // Unique name per call so suites don't collide on the shared factory.
  return NIndexedDBStore.open({ name: `test-${Math.random().toString(36).slice(2)}` });
}

describe('NIndexedDBStore', () => {
  it('stores and reads an event back by id', async () => {
    const store = await openStore();
    const event = makeEvent({ id: hex(1) });

    await store.event(event);

    const result = await store.query([{ ids: [hex(1)] }]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(hex(1));
    expect(result[0].content).toBe('hello');
  });

  it('returns nothing for an unknown id', async () => {
    const store = await openStore();
    const result = await store.query([{ ids: [hex(99)] }]);
    expect(result).toEqual([]);
  });

  it('de-duplicates ids across filters', async () => {
    const store = await openStore();
    await store.event(makeEvent({ id: hex(1) }));

    const result = await store.query([{ ids: [hex(1)] }, { ids: [hex(1)] }]);
    expect(result).toHaveLength(1);
  });

  it('reads a replaceable event (kind 0) by addr coordinate', async () => {
    const store = await openStore();
    const profile = makeEvent({ id: hex(2), kind: 0, content: '{"name":"alice"}' });
    await store.event(profile);

    const result = await store.query([{ kinds: [0], authors: ['a'.repeat(64)] }]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(hex(2));
  });

  it('advances the addr pointer to the newest replaceable event', async () => {
    const store = await openStore();
    const author = 'a'.repeat(64);
    await store.event(makeEvent({ id: hex(3), kind: 0, created_at: 1000 }));
    await store.event(makeEvent({ id: hex(4), kind: 0, created_at: 2000 }));

    const result = await store.query([{ kinds: [0], authors: [author] }]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(hex(4));
  });

  it('does not move the addr pointer backwards for an older event', async () => {
    const store = await openStore();
    const author = 'a'.repeat(64);
    await store.event(makeEvent({ id: hex(5), kind: 0, created_at: 2000 }));
    await store.event(makeEvent({ id: hex(6), kind: 0, created_at: 1000 }));

    const result = await store.query([{ kinds: [0], authors: [author] }]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(hex(5));
  });

  it('resolves addressable events by kind + author + #d', async () => {
    const store = await openStore();
    const author = 'a'.repeat(64);
    const geocache = makeEvent({
      id: hex(7),
      kind: 37516,
      created_at: 1000,
      tags: [['d', 'my-cache']],
    });
    await store.event(geocache);

    const hit = await store.query([{ kinds: [37516], authors: [author], '#d': ['my-cache'] }]);
    expect(hit).toHaveLength(1);
    expect(hit[0].id).toBe(hex(7));

    // A different d-tag returns nothing.
    const miss = await store.query([{ kinds: [37516], authors: [author], '#d': ['other'] }]);
    expect(miss).toEqual([]);
  });

  it('keeps separate addr pointers per d-tag', async () => {
    const store = await openStore();
    const author = 'a'.repeat(64);
    await store.event(makeEvent({ id: hex(8), kind: 37516, tags: [['d', 'one']] }));
    await store.event(makeEvent({ id: hex(9), kind: 37516, tags: [['d', 'two']] }));

    const one = await store.query([{ kinds: [37516], authors: [author], '#d': ['one'] }]);
    const two = await store.query([{ kinds: [37516], authors: [author], '#d': ['two'] }]);
    expect(one[0].id).toBe(hex(8));
    expect(two[0].id).toBe(hex(9));
  });

  it('returns nothing for unsupported filter shapes', async () => {
    const store = await openStore();
    await store.event(makeEvent({ id: hex(10), kind: 1, tags: [['t', 'nostr']] }));

    // Tag-only filter — not supported, contributes nothing.
    expect(await store.query([{ '#t': ['nostr'] }])).toEqual([]);
    // Kind-only filter — not supported.
    expect(await store.query([{ kinds: [1] }])).toEqual([]);
    // Time-range constrained id filter — not supported.
    expect(await store.query([{ ids: [hex(10)], since: 1 }])).toEqual([]);
  });

  it('coalesces a burst of writes and reads them all back', async () => {
    const store = await openStore();
    const events = Array.from({ length: 10 }, (_, i) => makeEvent({ id: hex(100 + i) }));

    // Fire all writes without awaiting individually — they should batch.
    await Promise.all(events.map((e) => store.event(e)));

    const ids = events.map((e) => e.id);
    const result = await store.query([{ ids }]);
    expect(result).toHaveLength(10);
  });

  it('flushes pending writes before a read so reads never miss', async () => {
    const store = await openStore();
    // Do NOT await the write; query() must flush it first.
    const writePromise = store.event(makeEvent({ id: hex(200) }));

    const result = await store.query([{ ids: [hex(200)] }]);
    expect(result).toHaveLength(1);
    await writePromise;
  });

  it('counts matching events', async () => {
    const store = await openStore();
    await store.event(makeEvent({ id: hex(11) }));
    await store.event(makeEvent({ id: hex(12) }));

    const { count } = await store.count([{ ids: [hex(11), hex(12)] }]);
    expect(count).toBe(2);
  });

  it('removes events by id filter', async () => {
    const store = await openStore();
    await store.event(makeEvent({ id: hex(13) }));

    await store.remove([{ ids: [hex(13)] }]);
    const result = await store.query([{ ids: [hex(13)] }]);
    expect(result).toEqual([]);
  });

  it('ignores malformed (non-hex) ids without throwing', async () => {
    const store = await openStore();
    const result = await store.query([{ ids: ['not-a-valid-id'] }]);
    expect(result).toEqual([]);
  });

  it('degrades to a no-op when IndexedDB is unavailable', async () => {
    // Force open() to fail by removing indexedDB entirely.
    const original = global.indexedDB;
    // @ts-expect-error intentionally clobbering for the test
    global.indexedDB = undefined;
    try {
      const store = await NIndexedDBStore.open({ name: 'noop-db' });
      // event() resolves, query() returns [] — no throw.
      await expect(store.event(makeEvent())).resolves.toBeUndefined();
      await expect(store.query([{ ids: [hex(1)] }])).resolves.toEqual([]);
    } finally {
      global.indexedDB = original;
    }
  });
});
