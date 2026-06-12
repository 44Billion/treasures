/**
 * Verification flow tests (NIP-GC kind 7517).
 *
 * Covers the cryptographic verified-found path end to end:
 * key generation → verification event creation → embedded verification
 * checking, including the Schnorr signature check that rejects forged events.
 */
import { describe, it, expect } from 'vitest';
import { generateSecretKey, getPublicKey, nip19 } from 'nostr-tools';
import type { NostrEvent } from '@nostrify/nostrify';
import {
  generateVerificationKeyPair,
  createVerificationEvent,
  getEmbeddedVerification,
  verifyEmbeddedVerification,
  buildStandardVerificationUrl,
} from '@/utils/verification';
import { NIP_GC_KINDS } from '@/utils/nip-gc';
import { geocacheToNaddr, parseNaddr } from '@/utils/naddr';

/** Build a found-log event (kind 7516) carrying an embedded verification event. */
function buildLogEvent(
  finderPubkey: string,
  verificationEvent: NostrEvent | null,
  id = `log-${Math.random().toString(36).slice(2)}`,
): NostrEvent {
  const tags: string[][] = [['a', '37516:owner-pubkey:dtag']];
  if (verificationEvent) {
    tags.push(['verification', JSON.stringify(verificationEvent)]);
  }
  return {
    id,
    kind: NIP_GC_KINDS.FOUND_LOG,
    pubkey: finderPubkey,
    content: 'Found it!',
    tags,
    created_at: Math.floor(Date.now() / 1000),
    sig: 'unchecked-log-sig',
  };
}

describe('verification key pairs', () => {
  it('generates a usable nsec/npub pair', async () => {
    const pair = await generateVerificationKeyPair();
    expect(pair.nsec).toMatch(/^nsec1/);
    expect(pair.npub).toMatch(/^npub1/);
    expect(pair.publicKey).toMatch(/^[0-9a-f]{64}$/);
    // npub must encode the same pubkey
    const decoded = nip19.decode(pair.npub);
    expect(decoded.data).toBe(pair.publicKey);
  });
});

describe('createVerificationEvent', () => {
  it('creates a correctly shaped, signed kind 7517 event', async () => {
    const cacheOwner = getPublicKey(generateSecretKey());
    const finderPubkey = getPublicKey(generateSecretKey());
    const pair = await generateVerificationKeyPair();

    const event = await createVerificationEvent(pair.nsec, finderPubkey, cacheOwner, 'abc123');

    expect(event.kind).toBe(NIP_GC_KINDS.VERIFICATION);
    expect(event.pubkey).toBe(pair.publicKey);
    expect(event.content).toBe(`Geocache verification for ${nip19.npubEncode(finderPubkey)}`);
    const aTag = event.tags.find((t) => t[0] === 'a');
    expect(aTag?.[1].startsWith(`${finderPubkey}:naddr1`)).toBe(true);
    expect(event.sig).toMatch(/^[0-9a-f]{128}$/);
  });

  it('rejects an invalid nsec', async () => {
    await expect(
      createVerificationEvent('npub1notansec', 'f'.repeat(64), 'a'.repeat(64), 'dtag'),
    ).rejects.toThrow();
  });
});

describe('verifyEmbeddedVerification', () => {
  it('accepts a valid verification event', async () => {
    const cacheOwner = getPublicKey(generateSecretKey());
    const finderPubkey = getPublicKey(generateSecretKey());
    const pair = await generateVerificationKeyPair();

    const verification = await createVerificationEvent(pair.nsec, finderPubkey, cacheOwner, 'abc123');
    const log = buildLogEvent(finderPubkey, verification);

    await expect(verifyEmbeddedVerification(log, pair.publicKey)).resolves.toBe(true);
  });

  it('rejects a log without an embedded verification', async () => {
    const finderPubkey = getPublicKey(generateSecretKey());
    const log = buildLogEvent(finderPubkey, null);
    await expect(verifyEmbeddedVerification(log, 'a'.repeat(64))).resolves.toBe(false);
  });

  it('rejects a verification signed by the wrong key', async () => {
    const cacheOwner = getPublicKey(generateSecretKey());
    const finderPubkey = getPublicKey(generateSecretKey());
    const realPair = await generateVerificationKeyPair();
    const otherPair = await generateVerificationKeyPair();

    // Verification event signed by a different (attacker) key
    const verification = await createVerificationEvent(otherPair.nsec, finderPubkey, cacheOwner, 'abc123');
    const log = buildLogEvent(finderPubkey, verification);

    await expect(verifyEmbeddedVerification(log, realPair.publicKey)).resolves.toBe(false);
  });

  it('rejects a forged event that claims the verification pubkey but has an invalid signature', async () => {
    const cacheOwner = getPublicKey(generateSecretKey());
    const finderPubkey = getPublicKey(generateSecretKey());
    const realPair = await generateVerificationKeyPair();
    const attackerPair = await generateVerificationKeyPair();

    // Attacker signs with their own key, then rewrites the pubkey field to
    // impersonate the real verification key. Only a signature check catches this.
    const forged = await createVerificationEvent(attackerPair.nsec, finderPubkey, cacheOwner, 'abc123');
    forged.pubkey = realPair.publicKey;

    const log = buildLogEvent(finderPubkey, forged);
    await expect(verifyEmbeddedVerification(log, realPair.publicKey)).resolves.toBe(false);
  });

  it('rejects a verification whose content was tampered with', async () => {
    const cacheOwner = getPublicKey(generateSecretKey());
    const finderPubkey = getPublicKey(generateSecretKey());
    const otherFinder = getPublicKey(generateSecretKey());
    const pair = await generateVerificationKeyPair();

    // Verification was issued for a different finder
    const verification = await createVerificationEvent(pair.nsec, otherFinder, cacheOwner, 'abc123');
    const log = buildLogEvent(finderPubkey, verification);

    await expect(verifyEmbeddedVerification(log, pair.publicKey)).resolves.toBe(false);
  });
});

describe('getEmbeddedVerification', () => {
  it('extracts the embedded verification event', async () => {
    const cacheOwner = getPublicKey(generateSecretKey());
    const finderPubkey = getPublicKey(generateSecretKey());
    const pair = await generateVerificationKeyPair();
    const verification = await createVerificationEvent(pair.nsec, finderPubkey, cacheOwner, 'abc123');

    const log = buildLogEvent(finderPubkey, verification);
    // JSON round-trip strips non-serializable markers (e.g. Symbol(verified))
    expect(getEmbeddedVerification(log)).toEqual(JSON.parse(JSON.stringify(verification)));
  });

  it('returns null for malformed verification tags', () => {
    const log = buildLogEvent('f'.repeat(64), null);
    log.tags.push(['verification', 'not-json{']);
    expect(getEmbeddedVerification(log)).toBeNull();
  });
});

describe('buildStandardVerificationUrl', () => {
  it('builds the treasures.to verification URL format', () => {
    const url = buildStandardVerificationUrl('naddr1test', 'nsec1test');
    expect(url).toMatch(/\/naddr1test#verify=nsec1test$/);
  });

  it('rejects invalid nsec format', () => {
    expect(() => buildStandardVerificationUrl('naddr1test', 'npub1bad')).toThrow();
  });
});

describe('naddr round-trip (consolidated @/utils/naddr)', () => {
  it('round-trips pubkey/dTag/kind through geocacheToNaddr and parseNaddr', () => {
    const pubkey = getPublicKey(generateSecretKey());
    const naddr = geocacheToNaddr(pubkey, 'my-dtag', ['wss://relay.example.com/'], NIP_GC_KINDS.GEOCACHE);
    const parsed = parseNaddr(naddr);
    expect(parsed).not.toBeNull();
    expect(parsed?.pubkey).toBe(pubkey);
    expect(parsed?.dTag).toBe('my-dtag');
    expect(parsed?.kind).toBe(NIP_GC_KINDS.GEOCACHE);
    expect(parsed?.relays).toEqual(['wss://relay.example.com/']);
  });

  it('returns null for non-geocache naddrs', () => {
    const pubkey = getPublicKey(generateSecretKey());
    const naddr = nip19.naddrEncode({ pubkey, kind: 30023, identifier: 'blog-post' });
    expect(parseNaddr(naddr)).toBeNull();
  });

  it('returns null for garbage input', () => {
    expect(parseNaddr('not-an-naddr')).toBeNull();
  });
});
