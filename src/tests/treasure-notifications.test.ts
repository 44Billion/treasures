/**
 * Tests for the filtering rules behind treasure notifications.
 *
 * Notifications surface activity on a user's own treasures: found logs (7516),
 * comment logs (1111: dnf/note/maintenance/archived), zaps (9735) and good
 * deeds (5777). The two correctness-critical concerns are:
 *
 *   1. Kind 1111 is a generic NIP-22 comment kind. Only genuine treasure
 *      comments (carrying the geocache a/A/k/K coordinate structure) must be
 *      treated as notifications — foreign 1111 events must be rejected. This is
 *      enforced by `parseLogEvent`, the same guard the hook applies.
 *   2. Read state is a single timestamp cursor; anything with
 *      `created_at > cursor` is unread (`isNew`).
 */

import { describe, it, expect } from 'vitest';
import type { NostrEvent } from '@nostrify/nostrify';
import {
  parseLogEvent,
  buildCommentLogTags,
  buildFoundLogTags,
  NIP_GC_KINDS,
} from '@/utils/nip-gc';

const OWNER = 'a'.repeat(64);
const FINDER = 'c'.repeat(64);
const D_TAG = 'my-treasure';

function makeEvent(
  kind: number,
  pubkey: string,
  tags: string[][],
  content = '',
  created_at = 1_700_000_000,
): NostrEvent {
  return {
    id: 'e'.repeat(64),
    pubkey,
    created_at,
    kind,
    content,
    sig: '0'.repeat(128),
    tags,
  };
}

describe('treasure notifications — 1111 filtering', () => {
  it('accepts a genuine treasure comment log (dnf)', () => {
    const event = makeEvent(
      NIP_GC_KINDS.COMMENT_LOG,
      FINDER,
      buildCommentLogTags({
        geocachePubkey: OWNER,
        geocacheDTag: D_TAG,
        logType: 'dnf',
      }),
      "Couldn't find it after an hour.",
    );

    const log = parseLogEvent(event);
    expect(log).not.toBeNull();
    expect(log?.type).toBe('dnf');
    expect(log?.text).toBe("Couldn't find it after an hour.");
  });

  it('accepts a maintenance comment log', () => {
    const event = makeEvent(
      NIP_GC_KINDS.COMMENT_LOG,
      FINDER,
      buildCommentLogTags({
        geocachePubkey: OWNER,
        geocacheDTag: D_TAG,
        logType: 'maintenance',
      }),
      'Container is cracked.',
    );

    expect(parseLogEvent(event)?.type).toBe('maintenance');
  });

  it('rejects a foreign 1111 comment with no geocache coordinate structure', () => {
    // A NIP-22 comment on something that is not a treasure (e.g. a kind-1 note).
    const event = makeEvent(NIP_GC_KINDS.COMMENT_LOG, FINDER, [
      ['A', '1:somepubkey:'],
      ['K', '1'],
      ['a', '1:somepubkey:'],
      ['k', '1'],
    ], 'Nice post!');

    expect(parseLogEvent(event)).toBeNull();
  });

  it('rejects a 1111 comment missing the required reference tags', () => {
    const event = makeEvent(NIP_GC_KINDS.COMMENT_LOG, FINDER, [
      ['e', 'f'.repeat(64)],
    ], 'orphan comment');

    expect(parseLogEvent(event)).toBeNull();
  });
});

describe('treasure notifications — found logs', () => {
  it('parses a found log referencing the treasure', () => {
    const event = makeEvent(
      NIP_GC_KINDS.FOUND_LOG,
      FINDER,
      buildFoundLogTags({ geocachePubkey: OWNER, geocacheDTag: D_TAG }),
      'Found it, great hide!',
    );

    const log = parseLogEvent(event);
    expect(log?.type).toBe('found');
    // parseLogEvent never trusts embedded verification; the hook validates it
    // separately against the treasure's verification pubkey.
    expect(log?.isVerified).toBe(false);
  });
});

describe('treasure notifications — unread cursor', () => {
  const cursor = 1_700_000_500;
  const isNew = (createdAt: number) => createdAt > cursor;

  it('marks events newer than the cursor as unread', () => {
    expect(isNew(cursor + 1)).toBe(true);
  });

  it('marks events at or before the cursor as read', () => {
    expect(isNew(cursor)).toBe(false);
    expect(isNew(cursor - 1)).toBe(false);
  });
});
