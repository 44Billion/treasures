/**
 * Offline publish queue.
 *
 * Signed events that cannot reach any relay (device offline, all relays
 * down) are persisted to IndexedDB and re-published automatically when
 * connectivity returns (see `useOfflinePublishFlush`).
 *
 * Only *signed* events are queued — signing requires user interaction and
 * must happen at the moment of the action, while delivery can be deferred.
 */

import { openDB, type IDBPDatabase } from 'idb';
import type { NostrEvent } from '@nostrify/nostrify';

const DB_NAME = 'treasures-publish-queue';
const DB_VERSION = 1;
const STORE_NAME = 'queued-events';

/** Drop queued events older than 7 days — stale finds/logs are confusing. */
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

interface QueuedEvent {
  /** The signed Nostr event, ready to broadcast. */
  event: NostrEvent;
  /** Wall-clock time the event was queued (ms). */
  queuedAt: number;
}

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'event.id' });
        }
      },
    });
  }
  return dbPromise;
}

/** Queue a signed event for later publication. */
export async function enqueueEvent(event: NostrEvent): Promise<void> {
  const db = await getDB();
  const entry: QueuedEvent = { event, queuedAt: Date.now() };
  await db.put(STORE_NAME, entry);
}

/** Number of events currently waiting for delivery. */
export async function getQueuedEventCount(): Promise<number> {
  const db = await getDB();
  return db.count(STORE_NAME);
}

/** All queued events, oldest first. */
export async function getQueuedEvents(): Promise<NostrEvent[]> {
  const db = await getDB();
  const entries = (await db.getAll(STORE_NAME)) as QueuedEvent[];
  return entries
    .sort((a, b) => a.queuedAt - b.queuedAt)
    .map((e) => e.event);
}

/** Remove a single event from the queue (after successful publish). */
export async function removeQueuedEvent(eventId: string): Promise<void> {
  const db = await getDB();
  await db.delete(STORE_NAME, eventId);
}

/** Remove entries that exceeded MAX_AGE_MS. Returns how many were dropped. */
export async function pruneStaleEvents(now: number = Date.now()): Promise<number> {
  const db = await getDB();
  const entries = (await db.getAll(STORE_NAME)) as QueuedEvent[];
  const stale = entries.filter((e) => now - e.queuedAt > MAX_AGE_MS);
  for (const entry of stale) {
    await db.delete(STORE_NAME, entry.event.id);
  }
  return stale.length;
}

/**
 * Attempt to publish every queued event through the given publisher.
 * Events that publish successfully are removed from the queue; failures
 * stay queued for the next flush. Returns counts for caller feedback.
 */
export async function flushQueuedEvents(
  publish: (event: NostrEvent) => Promise<void>,
): Promise<{ published: number; remaining: number }> {
  await pruneStaleEvents();
  const events = await getQueuedEvents();
  let published = 0;

  for (const event of events) {
    try {
      await publish(event);
      await removeQueuedEvent(event.id);
      published++;
    } catch {
      // Still unreachable — keep it queued and try the rest anyway
      // (different relays may be reachable for different events).
    }
  }

  const remaining = await getQueuedEventCount();
  return { published, remaining };
}

/** Test hook: reset the cached DB connection (used with fake-indexeddb). */
export function _resetQueueForTests(): void {
  dbPromise = null;
}
