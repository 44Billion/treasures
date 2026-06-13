/**
 * Heuristics for classifying Nostr publish / sign errors.
 *
 * Centralised so the create flow, log flow, etc. all branch on the same
 * matching rules. The strings come from various NIP-07 signer extensions,
 * NIP-46 bunker responses, and our own thrown errors.
 */

const CANCEL_PATTERNS = [
  'user rejected',
  'user denied',
  'user cancelled',
  'user canceled',
  'cancelled',
  'canceled',
  'denied',
  'rejected',
  // Some signers throw "signEvent: rejected" / "signEvent: denied" — the
  // bare token below is matched case-insensitively against the message.
  'signevent',
];

/**
 * Whether the given error looks like a user-cancelled signature prompt
 * (vs. a network/relay failure). We use this to avoid showing scary
 * "couldn't publish" copy for an intentional cancel, and to skip
 * auto-saving a fallback draft when the user is just backing out.
 */
export function isUserCancelledPublishError(err: unknown): boolean {
  if (!err) return false;
  const msg = (err as { message?: string })?.message ?? String(err);
  if (!msg) return false;
  const lower = msg.toLowerCase();
  return CANCEL_PATTERNS.some((p) => lower.includes(p));
}

/** Marker message used when the signer doesn't respond in time. */
export const SIGNER_TIMEOUT_MESSAGE = 'signer-timeout';

/**
 * Sign an event with a timeout so a hung/unreachable signer (commonly a
 * NIP-46 remote "bunker" on a flaky connection) surfaces as a distinct,
 * user-actionable error instead of masquerading as a relay failure.
 */
export async function signEventWithTimeout<T>(
  sign: () => Promise<T>,
  timeoutMs: number,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(SIGNER_TIMEOUT_MESSAGE)), timeoutMs);
  });
  try {
    return await Promise.race([sign(), timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Whether the error is a signer problem (didn't respond / unreachable) as
 * opposed to a user-initiated cancel or a relay/network failure. Drives the
 * "open your signer app and try again" copy.
 */
export function isSignerTimeoutError(err: unknown): boolean {
  if (!err) return false;
  const msg = (err as { message?: string })?.message ?? String(err);
  return msg.toLowerCase().includes(SIGNER_TIMEOUT_MESSAGE);
}

/**
 * Best-effort detection of network/relay/timeout failures. Used as a hint
 * for the toast copy — anything not matching either bucket falls through
 * to a generic "unknown error" path.
 */
export function isNetworkPublishError(err: unknown): boolean {
  if (!err) return false;
  const msg = (err as { message?: string })?.message ?? String(err);
  if (!msg) return false;
  const lower = msg.toLowerCase();
  return (
    lower.includes('timeout') ||
    lower.includes('timed out') ||
    lower.includes('network') ||
    lower.includes('failed to fetch') ||
    lower.includes('abort') ||
    lower.includes('connection') ||
    lower.includes('not found on relays') ||
    lower.includes('relay')
  );
}
