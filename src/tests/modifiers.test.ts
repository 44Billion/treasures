/**
 * Tests for the unified treasure-modifier utility module.
 *
 * Covers:
 *  - `getActiveModifiers` ordering and inclusion of mission as a modifier
 *  - `hasModifier` for all three modifier kinds
 *  - `getFtfWinner` ordering, ties, and edge cases
 *  - `getFtfStatus` n/a / unclaimed / claimed transitions
 *  - `isFtfWinningLog`
 */

import { describe, it, expect } from 'vitest';
import type { Geocache, GeocacheLog } from '@/types/geocache';
import {
  getActiveModifiers,
  hasModifier,
  getFtfWinner,
  getFtfStatus,
  isFtfWinningLog,
} from '@/utils/modifiers';

const baseCache: Pick<Geocache, 'mission' | 'modifiers'> = {};

function log(partial: Partial<GeocacheLog>): GeocacheLog {
  return {
    id: partial.id ?? 'log-0',
    pubkey: partial.pubkey ?? 'pk-0',
    created_at: partial.created_at ?? 1700000000,
    geocacheId: partial.geocacheId ?? 'gc-0',
    type: partial.type ?? 'found',
    text: partial.text ?? '',
    isVerified: partial.isVerified ?? false,
    ...partial,
  };
}

describe('getActiveModifiers', () => {
  it('returns empty array when no modifiers or mission set', () => {
    expect(getActiveModifiers(baseCache)).toEqual([]);
  });

  it('includes first-to-find when present', () => {
    const result = getActiveModifiers({ modifiers: ['first-to-find'] });
    expect(result).toEqual([{ kind: 'first-to-find' }]);
  });

  it('includes art when present', () => {
    const result = getActiveModifiers({ modifiers: ['art'] });
    expect(result).toEqual([{ kind: 'art' }]);
  });

  it('includes key-quest when mission is set', () => {
    const result = getActiveModifiers({ mission: 'Bring an acorn' });
    expect(result).toEqual([{ kind: 'key-quest', mission: 'Bring an acorn' }]);
  });

  it('treats empty/whitespace-only mission as absent', () => {
    expect(getActiveModifiers({ mission: '' })).toEqual([]);
    expect(getActiveModifiers({ mission: '   ' })).toEqual([]);
  });

  it('orders modifiers as first-to-find, art, key-quest', () => {
    const result = getActiveModifiers({
      modifiers: ['art', 'first-to-find'], // input order reversed
      mission: 'Solve the riddle',
    });
    expect(result.map(m => m.kind)).toEqual([
      'first-to-find',
      'art',
      'key-quest',
    ]);
  });
});

describe('hasModifier', () => {
  it('checks first-to-find', () => {
    expect(hasModifier({ modifiers: ['first-to-find'] }, 'first-to-find')).toBe(true);
    expect(hasModifier({ modifiers: ['art'] }, 'first-to-find')).toBe(false);
    expect(hasModifier({}, 'first-to-find')).toBe(false);
  });

  it('checks art', () => {
    expect(hasModifier({ modifiers: ['art'] }, 'art')).toBe(true);
    expect(hasModifier({ modifiers: ['first-to-find'] }, 'art')).toBe(false);
  });

  it('checks key-quest via mission text', () => {
    expect(hasModifier({ mission: 'Bring a token' }, 'key-quest')).toBe(true);
    expect(hasModifier({ mission: '' }, 'key-quest')).toBe(false);
    expect(hasModifier({ mission: '   ' }, 'key-quest')).toBe(false);
    expect(hasModifier({}, 'key-quest')).toBe(false);
  });
});

describe('getFtfWinner', () => {
  it('returns undefined when no logs', () => {
    expect(getFtfWinner([])).toBeUndefined();
  });

  it('returns undefined when no found logs', () => {
    const logs = [
      log({ id: 'l1', type: 'dnf', isVerified: true }),
      log({ id: 'l2', type: 'note', isVerified: true }),
    ];
    expect(getFtfWinner(logs)).toBeUndefined();
  });

  it('returns undefined when found logs are not verified', () => {
    const logs = [
      log({ id: 'l1', type: 'found', isVerified: false, created_at: 100 }),
      log({ id: 'l2', type: 'found', isVerified: false, created_at: 200 }),
    ];
    expect(getFtfWinner(logs)).toBeUndefined();
  });

  it('picks the earliest verified found log', () => {
    const logs = [
      log({ id: 'l1', type: 'found', isVerified: true, created_at: 300 }),
      log({ id: 'l2', type: 'found', isVerified: true, created_at: 100 }),
      log({ id: 'l3', type: 'found', isVerified: true, created_at: 200 }),
    ];
    expect(getFtfWinner(logs)?.id).toBe('l2');
  });

  it('ignores unverified logs when picking winner', () => {
    const logs = [
      // earliest by time, but not verified -> ignored
      log({ id: 'l1', type: 'found', isVerified: false, created_at: 50 }),
      log({ id: 'l2', type: 'found', isVerified: true, created_at: 100 }),
      log({ id: 'l3', type: 'found', isVerified: true, created_at: 200 }),
    ];
    expect(getFtfWinner(logs)?.id).toBe('l2');
  });

  it('breaks created_at ties by ascending event id', () => {
    const logs = [
      log({ id: 'zzzz', type: 'found', isVerified: true, created_at: 100 }),
      log({ id: 'aaaa', type: 'found', isVerified: true, created_at: 100 }),
      log({ id: 'mmmm', type: 'found', isVerified: true, created_at: 100 }),
    ];
    expect(getFtfWinner(logs)?.id).toBe('aaaa');
  });

  it('is independent of input order', () => {
    const a = log({ id: 'a', type: 'found', isVerified: true, created_at: 100 });
    const b = log({ id: 'b', type: 'found', isVerified: true, created_at: 200 });
    const c = log({ id: 'c', type: 'found', isVerified: true, created_at: 300 });
    expect(getFtfWinner([a, b, c])?.id).toBe('a');
    expect(getFtfWinner([c, b, a])?.id).toBe('a');
    expect(getFtfWinner([b, a, c])?.id).toBe('a');
  });

  it('handles a backdated log that displaces a previous winner', () => {
    // Scenario: we initially saw `bob` claim; later, alice publishes a log
    // with an earlier `created_at`. The selector must surface alice as winner.
    const bob = log({ id: 'bob', type: 'found', isVerified: true, created_at: 200 });
    const alice = log({ id: 'alice', type: 'found', isVerified: true, created_at: 100 });
    expect(getFtfWinner([bob, alice])?.id).toBe('alice');
  });

  it('restricts winner selection to the locked-in pubkey when provided', () => {
    // Bob's verified log is earlier but Alice is the locked winner.
    const bob = log({
      id: 'bob-log',
      pubkey: 'bob',
      type: 'found',
      isVerified: true,
      created_at: 50,
    });
    const alice = log({
      id: 'alice-log',
      pubkey: 'alice',
      type: 'found',
      isVerified: true,
      created_at: 100,
    });
    expect(getFtfWinner([bob, alice], 'alice')?.id).toBe('alice-log');
  });

  it('returns undefined when the locked-in pubkey has no verified log present', () => {
    const bob = log({
      id: 'bob-log',
      pubkey: 'bob',
      type: 'found',
      isVerified: true,
    });
    expect(getFtfWinner([bob], 'alice')).toBeUndefined();
  });
});

describe('getFtfStatus', () => {
  it('returns n/a when cache is not first-to-find', () => {
    expect(getFtfStatus({}, [])).toEqual({ kind: 'n/a' });
    expect(getFtfStatus({ modifiers: ['art'] }, [])).toEqual({ kind: 'n/a' });
  });

  it('returns unclaimed when first-to-find but no winner', () => {
    expect(getFtfStatus({ modifiers: ['first-to-find'] }, [])).toEqual({
      kind: 'unclaimed',
    });
  });

  it('returns claimed with the winner log', () => {
    const winner = log({
      id: 'winner',
      type: 'found',
      isVerified: true,
      created_at: 100,
    });
    const status = getFtfStatus({ modifiers: ['first-to-find'] }, [winner]);
    expect(status.kind).toBe('claimed');
    if (status.kind === 'claimed') {
      expect(status.winner.id).toBe('winner');
      expect(status.locked).toBe(false);
    }
  });

  it('reports locked=true when the cache has an F tag and the winning log is loaded', () => {
    const winner = log({
      id: 'winner',
      pubkey: 'alice',
      type: 'found',
      isVerified: true,
      created_at: 100,
    });
    const status = getFtfStatus(
      { modifiers: ['first-to-find'], ftfWinner: 'alice' },
      [winner],
    );
    expect(status.kind).toBe('claimed');
    if (status.kind === 'claimed') {
      expect(status.locked).toBe(true);
      expect(status.winner.pubkey).toBe('alice');
    }
  });

  it('locks attribution to the F-tag winner even when a forged earlier log exists', () => {
    // Bob publishes a verified log with a forged earlier `created_at` AFTER
    // the owner has locked in Alice via the F tag. Alice must remain the
    // canonical winner.
    const aliceWin = log({
      id: 'awin',
      pubkey: 'alice',
      type: 'found',
      isVerified: true,
      created_at: 100,
    });
    const bobForged = log({
      id: 'bforge',
      pubkey: 'bob',
      type: 'found',
      isVerified: true,
      created_at: 50, // earlier than alice, but published later & not the locked winner
    });
    const status = getFtfStatus(
      { modifiers: ['first-to-find'], ftfWinner: 'alice' },
      [bobForged, aliceWin],
    );
    expect(status.kind).toBe('claimed');
    if (status.kind === 'claimed') {
      expect(status.winner.pubkey).toBe('alice');
      expect(status.locked).toBe(true);
    }
  });

  it('returns kind=locked when F tag is set but no matching verified log is loaded', () => {
    const status = getFtfStatus(
      { modifiers: ['first-to-find'], ftfWinner: 'alice' },
      [],
    );
    expect(status).toEqual({ kind: 'locked', winnerPubkey: 'alice' });
  });
});

describe('isFtfWinningLog', () => {
  it('returns false when cache is not first-to-find', () => {
    const l = log({ id: 'l1', type: 'found', isVerified: true });
    expect(isFtfWinningLog(l, {}, [l])).toBe(false);
  });

  it('returns false for non-verified found logs', () => {
    const cache: Pick<Geocache, 'mission' | 'modifiers'> = { modifiers: ['first-to-find'] };
    const winner = log({ id: 'win', type: 'found', isVerified: true, created_at: 100 });
    const unverified = log({ id: 'u', type: 'found', isVerified: false, created_at: 50 });
    expect(isFtfWinningLog(unverified, cache, [winner, unverified])).toBe(false);
  });

  it('returns false for non-found logs', () => {
    const cache: Pick<Geocache, 'mission' | 'modifiers'> = { modifiers: ['first-to-find'] };
    const winner = log({ id: 'win', type: 'found', isVerified: true, created_at: 100 });
    const note = log({ id: 'n', type: 'note', isVerified: true, created_at: 50 });
    expect(isFtfWinningLog(note, cache, [winner, note])).toBe(false);
  });

  it('returns true for the winning log', () => {
    const cache: Pick<Geocache, 'mission' | 'modifiers'> = { modifiers: ['first-to-find'] };
    const winner = log({ id: 'win', type: 'found', isVerified: true, created_at: 100 });
    const later = log({ id: 'late', type: 'found', isVerified: true, created_at: 200 });
    expect(isFtfWinningLog(winner, cache, [winner, later])).toBe(true);
    expect(isFtfWinningLog(later, cache, [winner, later])).toBe(false);
  });
});
