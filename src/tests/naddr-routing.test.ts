import { describe, it, expect } from 'vitest';
import { nip19 } from 'nostr-tools';
import { decodeNaddr, parseNaddr } from '@/utils/naddr';
import { NIP_GC_KINDS } from '@/utils/nip-gc';
import { BLOG_POST_KIND } from '@/config/blog';

const PUBKEY = '86184109eae937d8d6f980b4a0b46da4ef0d983eade403ee1b4c0b6bde238b47';

function makeNaddr(kind: number, identifier = 'my-d-tag'): string {
  return nip19.naddrEncode({ kind, pubkey: PUBKEY, identifier, relays: [] });
}

describe('decodeNaddr', () => {
  it('decodes a geocache naddr into coordinates', () => {
    const naddr = makeNaddr(NIP_GC_KINDS.GEOCACHE, 'treasure-1');
    const decoded = decodeNaddr(naddr);
    expect(decoded).toEqual({
      pubkey: PUBKEY,
      dTag: 'treasure-1',
      relays: [],
      kind: NIP_GC_KINDS.GEOCACHE,
    });
  });

  it('decodes a blog post naddr (unlike parseNaddr, which rejects it)', () => {
    const naddr = makeNaddr(BLOG_POST_KIND, 'hello-world');
    const decoded = decodeNaddr(naddr);
    expect(decoded?.kind).toBe(BLOG_POST_KIND);
    expect(decoded?.pubkey).toBe(PUBKEY);
    expect(decoded?.dTag).toBe('hello-world');

    // parseNaddr only accepts geocache kinds.
    expect(parseNaddr(naddr)).toBeNull();
  });

  it('decodes an arbitrary unsupported kind', () => {
    const naddr = makeNaddr(31990, 'app-handler');
    const decoded = decodeNaddr(naddr);
    expect(decoded?.kind).toBe(31990);
  });

  it('returns null for non-naddr identifiers', () => {
    const npub = nip19.npubEncode(PUBKEY);
    expect(decodeNaddr(npub)).toBeNull();
  });

  it('returns null for garbage input', () => {
    expect(decodeNaddr('not-a-real-naddr')).toBeNull();
    expect(decodeNaddr('')).toBeNull();
  });

  it('returns null for a corrupt naddr1-prefixed string (treated as 404)', () => {
    // Starts with the bech32 prefix but the body is not valid — CacheDetail
    // relies on this returning null to render NotFound instead of churning
    // through relay-fetch error states.
    expect(decodeNaddr('naddr1corrupttruncated')).toBeNull();
    expect(decodeNaddr('naddr1' + 'z'.repeat(40))).toBeNull();
  });
});
