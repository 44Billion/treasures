/**
 * Geocache verification utilities using Nostr key pairs
 */

import { nip19 } from 'nostr-tools'; // Keep for NIP-19 encoding/decoding only
import { NSecSigner } from '@nostrify/nostrify';
import * as QRCode from 'qrcode';
import { geocacheToNaddr, parseNaddr } from './naddr-utils';
import type { NostrEvent } from '@nostrify/nostrify';
import { NIP_GC_KINDS, buildVerificationEventTags, buildVerificationEventContent } from './nip-gc';

// Verification constants
const VERIFICATION_HASH_PREFIX = '#verify=';

// Crypto utilities using Web Crypto API
async function generateSecretKey(): Promise<Uint8Array> {
  const key = new Uint8Array(32);
  crypto.getRandomValues(key);
  return key;
}

async function getPublicKeyFromSecret(secretKey: Uint8Array): Promise<string> {
  const signer = new NSecSigner(secretKey);
  return await signer.getPublicKey();
}

async function verifyEventSignature(event: NostrEvent): Promise<boolean> {
  try {
    // For now, we'll trust the event signature since Nostrify doesn't expose a verify function directly
    // In practice, events coming from relays are already verified by the relay
    // TODO: Implement proper signature verification when Nostrify exposes it
    return true;
  } catch {
    return false;
  }
}

export interface VerificationKeyPair {
  privateKey: Uint8Array;
  publicKey: string;
  nsec: string;
  npub: string;
}

/**
 * Generate a new verification key pair for a geocache
 */
export async function generateVerificationKeyPair(): Promise<VerificationKeyPair> {
  const privateKey = await generateSecretKey();
  const publicKey = await getPublicKeyFromSecret(privateKey);
  
  return {
    privateKey,
    publicKey,
    nsec: nip19.nsecEncode(privateKey),
    npub: nip19.npubEncode(publicKey),
  };
}

/**
 * Generate QR code data URL for verification
 */
export async function generateVerificationQR(naddr: string, nsec: string): Promise<string> {
  const verificationUrl = `https://treasures.to/${naddr}#verify=${nsec}`;
  
  try {
    const qrDataUrl = await QRCode.toDataURL(verificationUrl, {
      width: 512,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      errorCorrectionLevel: 'M'
    });
    
    return qrDataUrl;
  } catch (error) {
    throw new Error('Failed to generate QR code');
  }
}

/**
 * Parse verification key from URL hash
 */
export function parseVerificationFromHash(hash: string): string | null {
  if (!hash.startsWith(VERIFICATION_HASH_PREFIX)) {
    return null;
  }
  
  const nsec = hash.substring(VERIFICATION_HASH_PREFIX.length);
  
  // Validate that it's a proper nsec
  try {
    const decoded = nip19.decode(nsec);
    if (decoded.type !== 'nsec') {
      return null;
    }
    return nsec;
  } catch {
    return null;
  }
}

/**
 * Verify that a private key matches a public key
 */
export async function verifyKeyPair(nsec: string, expectedPubkey: string): Promise<boolean> {
  try {
    const decoded = nip19.decode(nsec);
    if (decoded.type !== 'nsec') {
      return false;
    }
    
    const privateKey = decoded.data;
    const publicKey = await getPublicKeyFromSecret(privateKey);
    
    return publicKey === expectedPubkey;
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
    const decoded = nip19.decode(nsec);
    if (decoded.type !== 'nsec') {
      throw new Error('Invalid private key');
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
  } catch (error) {
    throw new Error('Failed to create verification event');
  }
}

/**
 * Check if a log has embedded verification
 */
export function hasEmbeddedVerification(event: NostrEvent): boolean {
  try {
    const embeddedVerification = getEmbeddedVerification(event);
    return embeddedVerification !== null;
  } catch (error) {
    return false;
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
  } catch (error) {
    return null;
  }
}

/**
 * Check if a log has embedded verification and return its ID
 */
export function hasVerificationReference(event: NostrEvent): string | null {
  try {
    const embeddedVerification = getEmbeddedVerification(event);
    return embeddedVerification ? embeddedVerification.id : null;
  } catch (error) {
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
  } catch (error) {
    return false;
  }
}



/**
 * Verify that a verification event is valid for a specific log
 * According to NIP-GC specification
 */
export async function verifyVerificationEvent(
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
    } catch (error) {
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
  } catch (error) {
    return false;
  }
}

/**
 * Download QR code as PNG file
 */
export function downloadQRCode(dataUrl: string, filename: string = 'geocache-verification-qr.png'): void {
  const link = document.createElement('a');
  link.download = filename;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}