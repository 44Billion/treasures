/**
 * Tests for "unknown location" treasures — caches published with no `g`
 * (geohash) tag. Verifies that `parseGeocacheEvent` accepts such events with an
 * undefined `location`, that other required fields are still enforced, and that
 * `buildGeocacheTags` omits the geohash when no location is supplied while still
 * emitting it for located treasures.
 */

import { describe, it, expect } from 'vitest';
import type { NostrEvent } from '@nostrify/nostrify';
import {
  parseGeocacheEvent,
  buildGeocacheTags,
  NIP_GC_KINDS,
} from '@/utils/nip-gc';

/** Build a geocache event from an explicit tag list (no defaults added). */
function makeEvent(tags: string[][]): NostrEvent {
  return {
    id: 'a'.repeat(64),
    pubkey: 'b'.repeat(64),
    created_at: 1700000000,
    kind: NIP_GC_KINDS.GEOCACHE,
    content: 'A mysterious treasure',
    sig: '0'.repeat(128),
    tags,
  };
}

const REQUIRED_TAGS_NO_G: string[][] = [
  ['d', 'mystery-treasure'],
  ['name', 'Mystery Treasure'],
  ['D', '3'],
  ['T', '2'],
  ['S', 'small'],
];

describe('parseGeocacheEvent — unknown location', () => {
  it('parses an event with no g tag and leaves location undefined', () => {
    const parsed = parseGeocacheEvent(makeEvent(REQUIRED_TAGS_NO_G));
    expect(parsed).not.toBeNull();
    expect(parsed?.location).toBeUndefined();
    expect(parsed?.name).toBe('Mystery Treasure');
    expect(parsed?.difficulty).toBe(3);
  });

  it('still parses location when a g tag is present', () => {
    const parsed = parseGeocacheEvent(
      makeEvent([...REQUIRED_TAGS_NO_G, ['g', 'u4xsu6ry']]),
    );
    expect(parsed?.location).toBeDefined();
    expect(typeof parsed?.location?.lat).toBe('number');
    expect(typeof parsed?.location?.lng).toBe('number');
  });

  it('still enforces other required fields (missing name → null)', () => {
    const parsed = parseGeocacheEvent(
      makeEvent([
        ['d', 'mystery-treasure'],
        ['D', '3'],
        ['T', '2'],
        ['S', 'small'],
      ]),
    );
    expect(parsed).toBeNull();
  });
});

describe('buildGeocacheTags — unknown location', () => {
  const base = {
    dTag: 'mystery-treasure',
    name: 'Mystery Treasure',
    difficulty: 3,
    terrain: 2,
    size: 'small' as const,
    type: 'mystery' as const,
  };

  it('omits all g tags when no location is supplied', () => {
    const tags = buildGeocacheTags(base);
    expect(tags.some((tag) => tag[0] === 'g')).toBe(false);
  });

  it('emits g tags when a location is supplied', () => {
    const tags = buildGeocacheTags({
      ...base,
      location: { lat: 40.7128, lng: -74.006 },
    });
    expect(tags.some((tag) => tag[0] === 'g')).toBe(true);
  });

  it('round-trips: build without location → parse → location undefined', () => {
    const tags = buildGeocacheTags(base);
    const parsed = parseGeocacheEvent(makeEvent(tags));
    expect(parsed).not.toBeNull();
    expect(parsed?.location).toBeUndefined();
  });
});
