/**
 * Tests for lightning-enabled treasure detection.
 *
 * A treasure is lightning-enabled when its kind-37516 event carries an
 * `l` label tag with the value `payout-lnurl-w` (e.g. published by
 * Lightning Piggy as `["l", "payout-lnurl-w", "com.lightningpiggy.app"]`).
 * Detection keys on the label value only — the namespace is informational.
 *
 * The flag surfaces as a bolt badge on treasure cards / map popups (via
 * `getActiveModifiers`) and as a bolt corner badge on Leaflet map markers.
 */

import { describe, it, expect } from 'vitest';
import type { NostrEvent } from '@nostrify/nostrify';
import { parseGeocacheEvent, NIP_GC_KINDS } from '@/utils/nip-gc';
import { getActiveModifiers, hasModifier } from '@/utils/modifiers';

// Minimal valid event scaffold; tests override `tags` to focus on the l tag.
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

describe('parseGeocacheEvent — lightning payout l tag', () => {
  it('returns lightningEnabled: undefined when no l tags present', () => {
    const cache = parseGeocacheEvent(makeGeocacheEvent([]));
    expect(cache).not.toBeNull();
    expect(cache?.lightningEnabled).toBeUndefined();
  });

  it('detects the payout-lnurl-w label with the Lightning Piggy namespace', () => {
    const cache = parseGeocacheEvent(makeGeocacheEvent([
      ['L', 'com.lightningpiggy.app'],
      ['l', 'payout-lnurl-w', 'com.lightningpiggy.app'],
    ]));
    expect(cache?.lightningEnabled).toBe(true);
  });

  it('detects the label regardless of namespace', () => {
    const otherNamespace = parseGeocacheEvent(makeGeocacheEvent([
      ['l', 'payout-lnurl-w', 'com.example.other'],
    ]));
    expect(otherNamespace?.lightningEnabled).toBe(true);

    const noNamespace = parseGeocacheEvent(makeGeocacheEvent([
      ['l', 'payout-lnurl-w'],
    ]));
    expect(noNamespace?.lightningEnabled).toBe(true);
  });

  it('ignores l tags with other label values', () => {
    const cache = parseGeocacheEvent(makeGeocacheEvent([
      ['L', 'com.lightningpiggy.app'],
      ['l', 'something-else', 'com.lightningpiggy.app'],
    ]));
    expect(cache?.lightningEnabled).toBeUndefined();
  });

  it('ignores the value on non-l tags', () => {
    const cache = parseGeocacheEvent(makeGeocacheEvent([
      ['L', 'payout-lnurl-w'], // namespace tag, not a label
      ['t', 'payout-lnurl-w'], // wrong tag name
    ]));
    expect(cache?.lightningEnabled).toBeUndefined();
  });

  it('parses the real-world Lightning Piggy tag set alongside other tags', () => {
    const cache = parseGeocacheEvent(makeGeocacheEvent([
      ['t', 'traditional'],
      ['image', 'https://example.com/cache.jpg'],
      ['L', 'com.lightningpiggy.app'],
      ['l', 'payout-lnurl-w', 'com.lightningpiggy.app'],
      ['wait', '1200'],
      ['uses', '100'],
      ['expiration', '1811272946'],
    ]));
    expect(cache?.lightningEnabled).toBe(true);
    expect(cache?.type).toBe('traditional');
    expect(cache?.images).toEqual(['https://example.com/cache.jpg']);
  });
});

describe('getActiveModifiers / hasModifier — lightning', () => {
  it('includes the lightning modifier when lightningEnabled is true', () => {
    const active = getActiveModifiers({ lightningEnabled: true });
    expect(active).toEqual([{ kind: 'lightning' }]);
    expect(hasModifier({ lightningEnabled: true }, 'lightning')).toBe(true);
  });

  it('omits the lightning modifier when unset', () => {
    expect(getActiveModifiers({})).toEqual([]);
    expect(hasModifier({}, 'lightning')).toBe(false);
  });

  it('orders lightning after first-to-find and before art / key-quest', () => {
    const active = getActiveModifiers({
      modifiers: ['first-to-find', 'art'],
      mission: 'Bring a pen',
      lightningEnabled: true,
    });
    expect(active.map(m => m.kind)).toEqual([
      'first-to-find',
      'lightning',
      'art',
      'key-quest',
    ]);
  });
});
