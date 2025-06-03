/**
 * Geocache verification utilities using Nostr key pairs
 */

import { generateSecretKey, getPublicKey, finalizeEvent, verifyEvent } from 'nostr-tools';
import { nip19 } from 'nostr-tools';
import * as QRCode from 'qrcode';
import { geocacheToNaddr, parseNaddr } from './naddr-utils';
import type { NostrEvent } from '@nostrify/nostrify';
import { NIP_GC_KINDS, buildVerificationEventTags, buildVerificationEventContent } from './nip-gc';

// Verification constants
const VERIFICATION_HASH_PREFIX = '#verify=';

export interface VerificationKeyPair {
  privateKey: Uint8Array;
  publicKey: string;
  nsec: string;
  npub: string;
}

/**
 * Generate a new verification key pair for a geocache
 */
export function generateVerificationKeyPair(): VerificationKeyPair {
  const privateKey = generateSecretKey();
  const publicKey = getPublicKey(privateKey);
  
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
export function verifyKeyPair(nsec: string, expectedPubkey: string): boolean {
  try {
    const decoded = nip19.decode(nsec);
    if (decoded.type !== 'nsec') {
      return false;
    }
    
    const privateKey = decoded.data;
    const publicKey = getPublicKey(privateKey);
    
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
export function createVerificationEvent(
  nsec: string,
  finderPubkey: string,
  geocachePubkey: string,
  geocacheDTag: string
): NostrEvent {
  try {
    const decoded = nip19.decode(nsec);
    if (decoded.type !== 'nsec') {
      throw new Error('Invalid private key');
    }
    
    const privateKey = decoded.data;
    
    // Generate naddr for the geocache
    const geocacheNaddr = geocacheToNaddr(geocachePubkey, geocacheDTag);
    
    // Convert finder pubkey to npub for content
    const finderNpub = nip19.npubEncode(finderPubkey);
    
    const event = {
      kind: NIP_GC_KINDS.VERIFICATION,
      content: buildVerificationEventContent(finderNpub),
      tags: buildVerificationEventTags({
        finderPubkey,
        geocacheNaddr,
      }),
      created_at: Math.floor(Date.now() / 1000),
      pubkey: getPublicKey(privateKey),
    };
    
    return finalizeEvent(event, privateKey);
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

/**
 * Verify that an embedded verification event is valid for a specific log
 */
export function verifyEmbeddedVerification(
  logEvent: NostrEvent, 
  expectedVerificationPubkey: string
): boolean {
  try {
    const embeddedVerification = getEmbeddedVerification(logEvent);
    if (!embeddedVerification) {
      return false;
    }
    
    return verifyVerificationEvent(embeddedVerification, logEvent, expectedVerificationPubkey);
  } catch (error) {
    return false;
  }
}



/**
 * Verify that a verification event is valid for a specific log
 * According to NIP-GC specification
 */
export function verifyVerificationEvent(
  verificationEvent: NostrEvent, 
  logEvent: NostrEvent, 
  expectedVerificationPubkey: string
): boolean {
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
    const finderNpub = nip19.npubEncode(logEvent.pubkey);
    const expectedContent = buildVerificationEventContent(finderNpub);
    if (verificationEvent.content !== expectedContent) {
      return false;
    }
    
    // Check 'a' tag format: "<finder-pubkey-hex>:<geocache-naddr>"
    const aTag = verificationEvent.tags.find((tag: string[]) => tag[0] === 'a');
    if (!aTag || !aTag[1]) {
      return false;
    }
    
    const [finderPubkeyHex, geocacheNaddr] = aTag[1].split(':', 2);
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
    const signatureValid = verifyEvent(verificationEvent);
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