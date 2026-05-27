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
