/**
 * Treasure type-modifier utilities.
 *
 * Unifies the kinds of modifier this app supports:
 *   1. NIP-GC `n` tag modifiers (`first-to-find`, `art`) — flag-only.
 *   2. NIP-GC `mission` tag — a behavior modifier (Key Quest) that carries its
 *      own text payload and predates the `n` tag namespace.
 *   3. The lightning payout label (`["l", "payout-lnurl-w", …]`) set by
 *      lightning-enabled clients — surfaced as a bolt indicator.
 *
 * Consumers should prefer `getActiveModifiers(cache)` over reaching into
 * individual fields, so badges and filters stay consistent across the UI.
 */

import type { Geocache, GeocacheLog, TreasureModifier } from '@/types/geocache';

/** Discriminated union of all surface-level modifiers a treasure can carry. */
export type ActiveModifier =
  | { kind: 'key-quest'; mission: string }
  | { kind: 'first-to-find' }
  | { kind: 'lightning' }
  | { kind: 'art' };

/** Kind string for an `ActiveModifier`. */
export type ActiveModifierKind = ActiveModifier['kind'];

/**
 * Return all active modifiers on a treasure, in a stable presentation order:
 *   first-to-find, lightning, art, key-quest.
 *
 * Ordering is chosen so that behavioral modifiers (which affect interactions)
 * appear before descriptive ones (which categorize the treasure). Key Quest is
 * last because it carries the most text and visually anchors the modifier row.
 */
export function getActiveModifiers(
  cache: Pick<Geocache, 'mission' | 'modifiers' | 'lightningEnabled'>,
): ActiveModifier[] {
  const out: ActiveModifier[] = [];
  const ns = cache.modifiers ?? [];
  if (ns.includes('first-to-find')) out.push({ kind: 'first-to-find' });
  if (cache.lightningEnabled) out.push({ kind: 'lightning' });
  if (ns.includes('art')) out.push({ kind: 'art' });
  if (cache.mission && cache.mission.trim().length > 0) {
    out.push({ kind: 'key-quest', mission: cache.mission });
  }
  return out;
}

/** Return true if the cache carries the given modifier. */
export function hasModifier(
  cache: Pick<Geocache, 'mission' | 'modifiers' | 'lightningEnabled'>,
  kind: ActiveModifierKind,
): boolean {
  switch (kind) {
    case 'first-to-find':
      return cache.modifiers?.includes('first-to-find') ?? false;
    case 'lightning':
      return cache.lightningEnabled ?? false;
    case 'art':
      return cache.modifiers?.includes('art') ?? false;
    case 'key-quest':
      return Boolean(cache.mission && cache.mission.trim().length > 0);
  }
}

/**
 * Determine the winning log for a first-to-find treasure.
 *
 * Per NIP-GC: the winning log is the verified found log with the earliest
 * `created_at`; ties are broken by ascending lexicographic comparison of the
 * event `id`. Because `created_at` is author-supplied and forgeable, callers
 * SHOULD still display all verified logs as valid records of physical
 * presence — only the exclusive *claim* is attributed to the earliest one.
 *
 * Returns `undefined` if there are no valid verified found logs.
 *
 * Note: this function assumes `isVerified` has already been populated by the
 * verification flow (`useGeocacheLogs` / `verifyEmbeddedVerification`). It does
 * NOT perform signature validation itself.
 *
 * @param logs   Logs known for the treasure.
 * @param lockedWinner Optional locked-in winner pubkey from the treasure's
 *                     `F` tag. When provided, the winning log is the earliest
 *                     found log authored by that pubkey — this protects
 *                     against later-published logs with forged earlier
 *                     `created_at` values displacing a locked claim.
 *
 *                     When a winner is locked in, verification is NOT required
 *                     for that author's logs: the owner has explicitly attested
 *                     the winner via the `F` tag (e.g. confirming a finder "by
 *                     other means" who never used the verified-find flow). For
 *                     unlocked (provisional) claims, only verified found logs
 *                     are eligible.
 */
export function getFtfWinner(
  logs: GeocacheLog[],
  lockedWinner?: string,
): GeocacheLog | undefined {
  let winner: GeocacheLog | undefined;
  for (const log of logs) {
    if (log.type !== 'found') continue;
    if (lockedWinner) {
      // Owner-attested winner: any found log by the locked-in author counts,
      // verified or not.
      if (log.pubkey !== lockedWinner) continue;
    } else if (!log.isVerified) {
      // Provisional claim: only verified finds are eligible.
      continue;
    }
    if (!winner) {
      winner = log;
      continue;
    }
    if (log.created_at < winner.created_at) {
      winner = log;
    } else if (log.created_at === winner.created_at && log.id < winner.id) {
      winner = log;
    }
  }
  return winner;
}

/**
 * Composite "claim status" for a first-to-find treasure.
 *
 * For caches that do not carry `first-to-find`, callers SHOULD NOT consult
 * this; `getFtfStatus` returns `{ kind: 'n/a' }` in that case.
 *
 * `claimed` is reported in two situations:
 *  1. A verified found log exists (provisional claim, computed by
 *     `getFtfWinner`).
 *  2. The treasure carries a locked-in `F` tag — even if the matching
 *     verified found log isn't currently in `logs`, the claim is canonical
 *     and we report `kind: 'locked'` with the winner pubkey so callers can
 *     still display attribution.
 */
export type FtfStatus =
  | { kind: 'n/a' }
  | { kind: 'unclaimed' }
  | { kind: 'claimed'; winner: GeocacheLog; locked: boolean }
  | { kind: 'locked'; winnerPubkey: string };

export function getFtfStatus(
  cache: Pick<Geocache, 'mission' | 'modifiers' | 'ftfWinner'>,
  logs: GeocacheLog[],
): FtfStatus {
  if (!hasModifier(cache, 'first-to-find')) return { kind: 'n/a' };
  const lockedWinner = cache.ftfWinner;
  const winner = getFtfWinner(logs, lockedWinner);
  if (winner) {
    return { kind: 'claimed', winner, locked: !!lockedWinner };
  }
  // The `F` tag is present but we can't (yet) see the matching verified
  // found log locally. Surface the locked attribution anyway so the UI
  // doesn't flap between "claimed" and "unclaimed" while logs are loading.
  if (lockedWinner) {
    return { kind: 'locked', winnerPubkey: lockedWinner };
  }
  return { kind: 'unclaimed' };
}

/** Returns true iff a verified found log is the FTF winner. */
export function isFtfWinningLog(
  log: GeocacheLog,
  cache: Pick<Geocache, 'mission' | 'modifiers' | 'ftfWinner'>,
  logs: GeocacheLog[],
): boolean {
  if (!hasModifier(cache, 'first-to-find')) return false;
  if (log.type !== 'found' || !log.isVerified) return false;
  const winner = getFtfWinner(logs, cache.ftfWinner);
  return winner?.id === log.id;
}

/** All modifier values that surface as `TreasureModifier` (i.e. n-tag values). */
export const ALL_TREASURE_MODIFIERS: TreasureModifier[] = ['first-to-find', 'art'];
