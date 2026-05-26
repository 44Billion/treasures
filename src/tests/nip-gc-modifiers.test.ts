/**
 * Tests for NIP-GC `n` tag type modifier parsing and emission.
 *
 * Verifies that `parseGeocacheEvent` and `buildGeocacheTags` round-trip
 * modifiers correctly, ignore unknown values, and enforce the
 * one-per-category rule from the NIP-GC Type Modifiers section.
 */

import { describe, it, expect } from 'vitest';
import type { NostrEvent } from '@nostrify/nostrify';
import {
  parseGeocacheEvent,
  buildGeocacheTags,
  parseNModifiers,
  parseFtfWinner,
  validateNModifier,
  NIP_GC_KINDS,
} from '@/utils/nip-gc';

// Minimal valid event scaffold; tests override `tags` to focus on modifiers.
function makeGeocacheEvent(extraTags: string[][]): NostrEvent {
  return {
    id: 'a'.repeat(64),
    pubkey: 'b'.repeat(64),
    created_at: 1700000000,
    kind: NIP_GC_KINDS.GEOCACHE,
    content: 'test treasure',
    sig: '0'.repeat(128),
    tags: [
      ['d', 'test-treasure'],
      ['name', 'Test Treasure'],
      ['g', 'u4xsu6ry'],
      ['D', '2'],
      ['T', '2'],
      ['S', 'small'],
      ...extraTags,
    ],
  };
}

describe('validateNModifier', () => {
  it('accepts known modifiers', () => {
    expect(validateNModifier('first-to-find')).toBe(true);
    expect(validateNModifier('art')).toBe(true);
  });

  it('rejects unknown values', () => {
    expect(validateNModifier('')).toBe(false);
    expect(validateNModifier('unknown')).toBe(false);
    expect(validateNModifier('FIRST-TO-FIND')).toBe(false); // case-sensitive
    expect(validateNModifier('ftf')).toBe(false);
  });
});

describe('parseNModifiers', () => {
  it('returns empty array when no n tags present', () => {
    expect(parseNModifiers([['t', 'traditional']])).toEqual([]);
  });

  it('extracts a single modifier', () => {
    expect(parseNModifiers([['n', 'first-to-find']])).toEqual(['first-to-find']);
  });

  it('extracts multiple modifiers from different categories', () => {
    const result = parseNModifiers([
      ['n', 'first-to-find'],
      ['n', 'art'],
    ]);
    expect(result).toEqual(['first-to-find', 'art']);
  });

  it('preserves event-order across categories', () => {
    const result = parseNModifiers([
      ['n', 'art'],
      ['n', 'first-to-find'],
    ]);
    expect(result).toEqual(['art', 'first-to-find']);
  });

  it('keeps only the first value per category, dropping duplicates', () => {
    // (Hypothetical: two values from the same category. Only `first-to-find`
    // is currently in the claim-semantics category, so this exercises the
    // generic dedup behavior rather than an actual conflict scenario.)
    const result = parseNModifiers([
      ['n', 'first-to-find'],
      ['n', 'first-to-find'],
    ]);
    expect(result).toEqual(['first-to-find']);
  });

  it('ignores unknown modifier values (forward compatibility)', () => {
    const result = parseNModifiers([
      ['n', 'first-to-find'],
      ['n', 'unknown-future-modifier'],
      ['n', 'art'],
    ]);
    expect(result).toEqual(['first-to-find', 'art']);
  });

  it('ignores empty and malformed n tag values', () => {
    const result = parseNModifiers([
      ['n', ''],
      ['n'], // truncated
      ['n', 'first-to-find'],
    ]);
    expect(result).toEqual(['first-to-find']);
  });

  it('ignores non-n tags', () => {
    const result = parseNModifiers([
      ['t', 'first-to-find'], // wrong tag name
      ['t', 'art'],
    ]);
    expect(result).toEqual([]);
  });
});

describe('parseGeocacheEvent — n tag modifiers', () => {
  it('returns modifiers: undefined when no n tags present', () => {
    const event = makeGeocacheEvent([]);
    const cache = parseGeocacheEvent(event);
    expect(cache).not.toBeNull();
    expect(cache?.modifiers).toBeUndefined();
  });

  it('parses a single modifier', () => {
    const event = makeGeocacheEvent([['n', 'first-to-find']]);
    const cache = parseGeocacheEvent(event);
    expect(cache?.modifiers).toEqual(['first-to-find']);
  });

  it('parses multiple modifiers from different categories', () => {
    const event = makeGeocacheEvent([
      ['n', 'first-to-find'],
      ['n', 'art'],
    ]);
    const cache = parseGeocacheEvent(event);
    expect(cache?.modifiers).toEqual(['first-to-find', 'art']);
  });

  it('ignores unknown values silently', () => {
    const event = makeGeocacheEvent([
      ['n', 'first-to-find'],
      ['n', 'future-modifier-xyz'],
    ]);
    const cache = parseGeocacheEvent(event);
    expect(cache?.modifiers).toEqual(['first-to-find']);
  });

  it('does not interfere with status/hidden t-tag parsing', () => {
    const event = makeGeocacheEvent([
      ['n', 'first-to-find'],
      ['t', 'archived'],
      ['t', 'hidden'],
    ]);
    const cache = parseGeocacheEvent(event);
    expect(cache?.modifiers).toEqual(['first-to-find']);
    expect(cache?.status).toBe('archived');
    expect(cache?.hidden).toBe(true);
  });
});

describe('buildGeocacheTags — n tag modifiers', () => {
  const baseData = {
    dTag: 'test-treasure',
    name: 'Test Treasure',
    location: { lat: 59.91, lng: 10.75 },
    difficulty: 2,
    terrain: 2,
    size: 'small' as const,
    type: 'traditional' as const,
  };

  it('emits no n tags when modifiers is empty/undefined', () => {
    const tags = buildGeocacheTags({ ...baseData });
    expect(tags.filter(t => t[0] === 'n')).toEqual([]);

    const tagsEmpty = buildGeocacheTags({ ...baseData, modifiers: [] });
    expect(tagsEmpty.filter(t => t[0] === 'n')).toEqual([]);
  });

  it('emits a single n tag', () => {
    const tags = buildGeocacheTags({
      ...baseData,
      modifiers: ['first-to-find'],
    });
    const nTags = tags.filter(t => t[0] === 'n');
    expect(nTags).toEqual([['n', 'first-to-find']]);
  });

  it('emits multiple n tags from different categories', () => {
    const tags = buildGeocacheTags({
      ...baseData,
      modifiers: ['first-to-find', 'art'],
    });
    const nTags = tags.filter(t => t[0] === 'n');
    expect(nTags).toEqual([
      ['n', 'first-to-find'],
      ['n', 'art'],
    ]);
  });

  it('deduplicates within a category, keeping first', () => {
    const tags = buildGeocacheTags({
      ...baseData,
      // Same-category duplicate (artificial; only first-to-find is in claim-semantics today)
      modifiers: ['first-to-find', 'first-to-find'],
    });
    const nTags = tags.filter(t => t[0] === 'n');
    expect(nTags).toEqual([['n', 'first-to-find']]);
  });

  it('round-trips through parseGeocacheEvent', () => {
    const tags = buildGeocacheTags({
      ...baseData,
      modifiers: ['first-to-find', 'art'],
    });
    const event: NostrEvent = {
      id: 'a'.repeat(64),
      pubkey: 'b'.repeat(64),
      created_at: 1700000000,
      kind: NIP_GC_KINDS.GEOCACHE,
      content: 'test',
      sig: '0'.repeat(128),
      tags,
    };
    const cache = parseGeocacheEvent(event);
    expect(cache?.modifiers).toEqual(['first-to-find', 'art']);
  });
});

describe('parseFtfWinner — F tag', () => {
  const PUBKEY = 'c'.repeat(64);

  it('returns undefined when no F tag present', () => {
    expect(parseFtfWinner([['t', 'archived']])).toBeUndefined();
  });

  it('parses a valid F tag', () => {
    expect(parseFtfWinner([['F', PUBKEY]])).toBe(PUBKEY);
  });

  it('rejects F tags with malformed pubkey values', () => {
    expect(parseFtfWinner([['F', 'not-hex']])).toBeUndefined();
    expect(parseFtfWinner([['F', PUBKEY.slice(0, 63)]])).toBeUndefined(); // too short
    expect(parseFtfWinner([['F', PUBKEY.toUpperCase()]])).toBeUndefined(); // uppercase
    expect(parseFtfWinner([['F', '']])).toBeUndefined();
    expect(parseFtfWinner([['F']])).toBeUndefined();
  });

  it('returns the first valid F tag when multiple are present', () => {
    const second = 'd'.repeat(64);
    expect(parseFtfWinner([
      ['F', PUBKEY],
      ['F', second],
    ])).toBe(PUBKEY);
  });

  it('skips malformed F tags and uses the first valid one', () => {
    const valid = 'd'.repeat(64);
    expect(parseFtfWinner([
      ['F', 'bad'],
      ['F', valid],
    ])).toBe(valid);
  });

  it('ignores non-F tags', () => {
    expect(parseFtfWinner([['f', PUBKEY]])).toBeUndefined(); // lowercase
    expect(parseFtfWinner([['p', PUBKEY]])).toBeUndefined();
  });
});

describe('parseGeocacheEvent — F tag', () => {
  const WINNER = 'c'.repeat(64);

  it('returns ftfWinner: undefined when no F tag present', () => {
    const event = makeGeocacheEvent([['n', 'first-to-find']]);
    const cache = parseGeocacheEvent(event);
    expect(cache?.ftfWinner).toBeUndefined();
  });

  it('parses ftfWinner from a valid F tag', () => {
    const event = makeGeocacheEvent([
      ['n', 'first-to-find'],
      ['F', WINNER],
    ]);
    const cache = parseGeocacheEvent(event);
    expect(cache?.ftfWinner).toBe(WINNER);
  });

  it('parses F tag independently of the n modifier (consumers gate use)', () => {
    // Parser doesn't require the modifier — semantic gating is the consumer's
    // job. This keeps parsing decoupled from validation policy.
    const event = makeGeocacheEvent([['F', WINNER]]);
    const cache = parseGeocacheEvent(event);
    expect(cache?.ftfWinner).toBe(WINNER);
  });
});

describe('buildGeocacheTags — F tag', () => {
  const baseData = {
    dTag: 'test-treasure',
    name: 'Test Treasure',
    location: { lat: 59.91, lng: 10.75 },
    difficulty: 2,
    terrain: 2,
    size: 'small' as const,
    type: 'traditional' as const,
  };
  const WINNER = 'c'.repeat(64);

  it('emits no F tag when ftfWinner is unset', () => {
    const tags = buildGeocacheTags({
      ...baseData,
      modifiers: ['first-to-find'],
    });
    expect(tags.filter(t => t[0] === 'F')).toEqual([]);
  });

  it('emits an F tag when both modifier and winner are set', () => {
    const tags = buildGeocacheTags({
      ...baseData,
      modifiers: ['first-to-find'],
      ftfWinner: WINNER,
    });
    const fTags = tags.filter(t => t[0] === 'F');
    expect(fTags).toEqual([['F', WINNER]]);
  });

  it('does NOT emit an F tag when the first-to-find modifier is missing', () => {
    // Guard: prevents publishing a misleading lock on a non-FTF treasure.
    const tags = buildGeocacheTags({
      ...baseData,
      modifiers: ['art'],
      ftfWinner: WINNER,
    });
    expect(tags.filter(t => t[0] === 'F')).toEqual([]);
  });

  it('drops malformed winner pubkeys silently', () => {
    const tags = buildGeocacheTags({
      ...baseData,
      modifiers: ['first-to-find'],
      ftfWinner: 'not-hex',
    });
    expect(tags.filter(t => t[0] === 'F')).toEqual([]);
  });

  it('normalises winner pubkey to lowercase', () => {
    const tags = buildGeocacheTags({
      ...baseData,
      modifiers: ['first-to-find'],
      ftfWinner: WINNER.toUpperCase(),
    });
    expect(tags.filter(t => t[0] === 'F')).toEqual([['F', WINNER]]);
  });

  it('round-trips through parseGeocacheEvent', () => {
    const tags = buildGeocacheTags({
      ...baseData,
      modifiers: ['first-to-find'],
      ftfWinner: WINNER,
    });
    const event: NostrEvent = {
      id: 'a'.repeat(64),
      pubkey: 'b'.repeat(64),
      created_at: 1700000000,
      kind: NIP_GC_KINDS.GEOCACHE,
      content: 'test',
      sig: '0'.repeat(128),
      tags,
    };
    const cache = parseGeocacheEvent(event);
    expect(cache?.ftfWinner).toBe(WINNER);
    expect(cache?.modifiers).toEqual(['first-to-find']);
  });
});
