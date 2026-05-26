/**
 * Treasure type-modifier utilities.
 *
 * Unifies the two kinds of modifier this app supports:
 *   1. NIP-GC `n` tag modifiers (`first-to-find`, `art`) — flag-only.
 *   2. NIP-GC `mission` tag — a behavior modifier (Key Quest) that carries its
 *      own text payload and predates the `n` tag namespace.
 *
 * Consumers should prefer `getActiveModifiers(cache)` over reaching into
 * individual fields, so badges and filters stay consistent across the UI.
 */

import type { Geocache, GeocacheLog, TreasureModifier } from '@/types/geocache';

/** Discriminated union of all surface-level modifiers a treasure can carry. */
export type ActiveModifier =
  | { kind: 'key-quest'; mission: string }
  | { kind: 'first-to-find' }
  | { kind: 'art' };

/** Kind string for an `ActiveModifier`. */
export type ActiveModifierKind = ActiveModifier['kind'];

/**
 * Return all active modifiers on a treasure, in a stable presentation order:
 *   first-to-find, art, key-quest.
 *
 * Ordering is chosen so that behavioral modifiers (which affect interactions)
 * appear before descriptive ones (which categorize the treasure). Key Quest is
 * last because it carries the most text and visually anchors the modifier row.
 */
export function getActiveModifiers(cache: Pick<Geocache, 'mission' | 'modifiers'>): ActiveModifier[] {
  const out: ActiveModifier[] = [];
  const ns = cache.modifiers ?? [];
  if (ns.includes('first-to-find')) out.push({ kind: 'first-to-find' });
  if (ns.includes('art')) out.push({ kind: 'art' });
  if (cache.mission && cache.mission.trim().length > 0) {
    out.push({ kind: 'key-quest', mission: cache.mission });
  }
  return out;
}

/** Return true if the cache carries the given modifier. */
export function hasModifier(
  cache: Pick<Geocache, 'mission' | 'modifiers'>,
  kind: ActiveModifierKind,
): boolean {
  switch (kind) {
    case 'first-to-find':
      return cache.modifiers?.includes('first-to-find') ?? false;
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
 */
export function getFtfWinner(logs: GeocacheLog[]): GeocacheLog | undefined {
  let winner: GeocacheLog | undefined;
  for (const log of logs) {
    if (log.type !== 'found' || !log.isVerified) continue;
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
 */
export type FtfStatus =
  | { kind: 'n/a' }
  | { kind: 'unclaimed' }
  | { kind: 'claimed'; winner: GeocacheLog };

export function getFtfStatus(
  cache: Pick<Geocache, 'mission' | 'modifiers'>,
  logs: GeocacheLog[],
): FtfStatus {
  if (!hasModifier(cache, 'first-to-find')) return { kind: 'n/a' };
  const winner = getFtfWinner(logs);
  return winner ? { kind: 'claimed', winner } : { kind: 'unclaimed' };
}

/** Returns true iff a verified found log is the FTF winner. */
export function isFtfWinningLog(
  log: GeocacheLog,
  cache: Pick<Geocache, 'mission' | 'modifiers'>,
  logs: GeocacheLog[],
): boolean {
  if (!hasModifier(cache, 'first-to-find')) return false;
  if (log.type !== 'found' || !log.isVerified) return false;
  const winner = getFtfWinner(logs);
  return winner?.id === log.id;
}

/** All modifier values that surface as `TreasureModifier` (i.e. n-tag values). */
export const ALL_TREASURE_MODIFIERS: TreasureModifier[] = ['first-to-find', 'art'];
