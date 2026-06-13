/**
 * Resilient relay publishing.
 *
 * Shared delivery primitive for already-signed events. Provides:
 *  - an offline short-circuit (queue immediately when the device is offline),
 *  - a retry loop with per-attempt timeout growth and adaptive (mobile/slow
 *    network) scaling,
 *  - connectivity-error classification that queues the event for later
 *    delivery instead of failing hard.
 *
 * This is the single source of truth used by both `useNostrPublish` and the
 * core context stores (`useGeocacheStore`) so that every publish path gets the
 * same offline-queue + retry behavior. Signing happens at the call site — this
 * function only handles *delivery* of a signed event.
 */

import type { NostrEvent, NPool } from '@nostrify/nostrify';
import { TIMEOUTS, RETRY_CONFIG } from '@/config';
import { getAdaptiveTimeout } from '@/utils/network';
import { enqueueEvent } from '@/lib/offlinePublishQueue';

/** Minimal surface we need from the Nostr pool — keeps this testable. */
export interface ResilientPublishTarget {
  event: (event: NostrEvent, opts?: { signal?: AbortSignal }) => Promise<void>;
}

export interface ResilientPublishResult {
  /** The event that was published or queued (unchanged). */
  event: NostrEvent;
  /**
   * `'published'` — at least one relay accepted it.
   * `'queued'` — device offline or all relays unreachable; saved to the
   * offline queue and will be re-broadcast when connectivity returns.
   */
  status: 'published' | 'queued';
}

/** Errors that indicate the network (not the user/signer) is the problem. */
export function isConnectivityError(message: string): boolean {
  return (
    message.includes('no promise in promise.any resolved') ||
    message.includes('timeout') ||
    message.includes('WebSocket') ||
    message.includes('network') ||
    message.includes('Failed to fetch')
  );
}

/** Errors that mean the user/signer aborted — never retry or queue these. */
export function isUserAbortError(message: string): boolean {
  return (
    message.includes('User rejected') ||
    message.includes('cancelled') ||
    message.includes('denied') ||
    message.includes('user denied') ||
    message.includes('user cancelled') ||
    message.includes('user rejected') ||
    message.includes('signEvent')
  );
}

/**
 * Deliver a signed event to relays with retry + offline queueing.
 *
 * Resolves with `status: 'queued'` (rather than throwing) when the device is
 * offline or every relay is unreachable, so callers can report success and
 * rely on the offline flush to deliver later. Throws only for non-connectivity
 * failures (e.g. a user-aborted signer surfaced as a publish error).
 */
export async function resilientPublish(
  nostr: ResilientPublishTarget | NPool,
  event: NostrEvent,
): Promise<ResilientPublishResult> {
  // Device is offline: skip the doomed relay attempts, queue the signed
  // event for delivery when connectivity returns.
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    await enqueueEvent(event);
    return { event, status: 'queued' };
  }

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= RETRY_CONFIG.PUBLISH_MAX_RETRIES; attempt++) {
    try {
      // Grow the timeout slightly each attempt, then scale for slow/mobile.
      const baseTimeout = TIMEOUTS.PUBLISH + (attempt - 1) * 3000;
      const timeout = getAdaptiveTimeout(baseTimeout);
      await nostr.event(event, { signal: AbortSignal.timeout(timeout) });
      return { event, status: 'published' };
    } catch (error) {
      const errorMessage = (error as { message?: string }).message || 'Unknown error';
      lastError = new Error(errorMessage);

      // Never retry a user-aborted signer error.
      if (isUserAbortError(errorMessage)) {
        throw error;
      }

      // Wait before retrying (except on the last attempt).
      if (attempt < RETRY_CONFIG.PUBLISH_MAX_RETRIES) {
        await new Promise((resolve) =>
          setTimeout(resolve, RETRY_CONFIG.PUBLISH_BASE_DELAY * attempt),
        );
      }
    }
  }

  // All retries exhausted.
  const errorMessage = lastError?.message ?? 'Unknown error';

  // Connectivity failure: queue the signed event so it isn't lost; the offline
  // flush will deliver it when the network returns.
  if (isConnectivityError(errorMessage)) {
    await enqueueEvent(event);
    return { event, status: 'queued' };
  }

  if (errorMessage.includes('relay')) {
    throw new Error(
      'Relay error occurred after multiple attempts. Your event may have been published successfully.',
    );
  }
  throw new Error(
    `Failed to publish event after ${RETRY_CONFIG.PUBLISH_MAX_RETRIES} attempts: ${errorMessage}`,
  );
}
