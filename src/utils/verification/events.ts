/**
 * Verification event creation and validation (NIP-GC kind 7517).
 *
 * A verification event is signed by the cache's verification key and attests
 * that a specific finder found the cache. Found logs embed the verification
 * event in a `verification` tag; validation checks the embedded event's
 * structure, its binding to the log author, and its Schnorr signature.
 */

import { nip19, verifyEvent } from 'nostr-tools';
import { NSecSigner } from '@nostrify/nostrify';
import type { NostrEvent } from '@nostrify/nostrify';
import { geocacheToNaddr, parseNaddr } from '@/utils/naddr';
import { NIP_GC_KINDS, buildVerificationEventTags, buildVerificationEventContent } from '@/utils/nip-gc';

async function verifyEventSignature(event: NostrEvent): Promise<boolean> {
  try {
    // Cryptographically verify the event id and Schnorr signature
    return verifyEvent(event);
  } catch {
    return false;
  }
}

/**
 * Create a verification event signed by the cache's verification key
 * This event attests that the specified user found the cache
 * According to NIP-GC specification
 */
export async function createVerificationEvent(
  nsec: string,
  finderPubkey: string,
  geocachePubkey: string,
  geocacheDTag: string
): Promise<NostrEvent> {
  try {
    // Validate inputs
    if (!nsec || !finderPubkey || !geocachePubkey || !geocacheDTag) {
      throw new Error('Missing required parameters for verification event');
    }

    const decoded = nip19.decode(nsec);
    if (decoded.type !== 'nsec') {
      throw new Error('Invalid private key format - must be nsec');
    }

    const privateKey = decoded.data;
    const signer = new NSecSigner(privateKey);

    // Generate naddr for the geocache
    const geocacheNaddr = geocacheToNaddr(geocachePubkey, geocacheDTag);

    // Convert finder pubkey to npub for content
    const finderNpub = nip19.npubEncode(finderPubkey);

    const eventTemplate = {
      kind: NIP_GC_KINDS.VERIFICATION,
      content: buildVerificationEventContent(finderNpub),
      tags: buildVerificationEventTags({
        finderPubkey,
        geocacheNaddr,
      }),
      created_at: Math.floor(Date.now() / 1000),
    };

    return await signer.signEvent(eventTemplate);
  } catch (error: unknown) {
    const errorObj = error as { message?: string };

    // Provide more specific error messages
    if (errorObj.message?.includes('Invalid private key format')) {
      throw new Error('Invalid verification key format. Please check the QR code.');
    } else if (errorObj.message?.includes('Missing required parameters')) {
      throw new Error('Missing required data for verification. Please try again.');
    } else if (errorObj.message?.includes('decode')) {
      throw new Error('Could not decode verification key. Please check the QR code.');
    } else {
      throw new Error(`Failed to create verification event: ${errorObj.message || 'Unknown error'}`);
    }
  }
}

/**
 * Check if a log has embedded verification event
 */
export function getEmbeddedVerification(event: NostrEvent): NostrEvent | null {
  try {
    // Look for embedded verification event
    const verificationTag = event.tags.find((tag: string[]) =>
      tag[0] === 'verification'
    );

    if (!verificationTag || !verificationTag[1]) {
      return null;
    }

    // Parse the embedded verification event
    return JSON.parse(verificationTag[1]);
  } catch {
    return null;
  }
}

// Cache for verification results to avoid re-verifying the same events
const verificationCache = new Map<string, boolean>();

// Clean up cache periodically to prevent memory leaks
setInterval(() => {
  if (verificationCache.size > 1000) {
    verificationCache.clear();
  }
}, 300000); // Clean every 5 minutes

/**
 * Verify that an embedded verification event is valid for a specific log
 */
export async function verifyEmbeddedVerification(
  logEvent: NostrEvent,
  expectedVerificationPubkey: string
): Promise<boolean> {
  try {
    // Create a cache key based on log event ID and verification pubkey
    const cacheKey = `${logEvent.id}:${expectedVerificationPubkey}`;

    // Check cache first
    if (verificationCache.has(cacheKey)) {
      return verificationCache.get(cacheKey)!;
    }

    const embeddedVerification = getEmbeddedVerification(logEvent);
    if (!embeddedVerification) {
      verificationCache.set(cacheKey, false);
      return false;
    }

    const result = await verifyVerificationEvent(embeddedVerification, logEvent, expectedVerificationPubkey);

    // Cache the result
    verificationCache.set(cacheKey, result);

    return result;
  } catch {
    return false;
  }
}

/**
 * Verify that a verification event is valid for a specific log
 * According to NIP-GC specification
 */
async function verifyVerificationEvent(
  verificationEvent: NostrEvent,
  logEvent: NostrEvent,
  expectedVerificationPubkey: string
): Promise<boolean> {
  try {
    // Check if the verification event was signed by the expected verification key
    if (verificationEvent.pubkey !== expectedVerificationPubkey) {
      return false;
    }

    // Check if it's the right kind of event (NIP-GC verification)
    if (verificationEvent.kind !== NIP_GC_KINDS.VERIFICATION) {
      return false;
    }

    // Check content format: "Geocache verification for <finder-npub>"
    let finderNpub: string;
    let expectedContent: string;

    try {
      finderNpub = nip19.npubEncode(logEvent.pubkey);
      expectedContent = buildVerificationEventContent(finderNpub);
    } catch {
      // Invalid pubkey format
      return false;
    }

    if (verificationEvent.content !== expectedContent) {
      return false;
    }

    // Check 'a' tag format: "<finder-pubkey-hex>:<geocache-naddr>"
    const aTag = verificationEvent.tags.find((tag: string[]) => tag[0] === 'a');
    if (!aTag || !aTag[1]) {
      return false;
    }

    // Split at first colon only since geocache naddr contains colons
    const colonIndex = aTag[1].indexOf(':');
    if (colonIndex === -1) {
      return false;
    }

    const finderPubkeyHex = aTag[1].substring(0, colonIndex);
    const geocacheNaddr = aTag[1].substring(colonIndex + 1);

    if (!finderPubkeyHex || !geocacheNaddr) {
      return false;
    }

    // Verify that the finder pubkey matches the log submitter
    if (finderPubkeyHex !== logEvent.pubkey) {
      return false;
    }

    // Verify the geocache naddr is valid
    const parsedNaddr = parseNaddr(geocacheNaddr);
    if (!parsedNaddr) {
      return false;
    }

    // Verify the event signature
    const signatureValid = await verifyEventSignature(verificationEvent);
    return signatureValid;
  } catch {
    return false;
  }
}
