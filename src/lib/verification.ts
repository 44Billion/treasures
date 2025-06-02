/**
 * Geocache verification utilities using Nostr key pairs
 */

import { generateSecretKey, getPublicKey, finalizeEvent, verifyEvent } from 'nostr-tools';
import { nip19 } from 'nostr-tools';
import QRCode from 'qrcode';

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
  
  // QR code generation for verification
  
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
    console.error('Failed to generate QR code:', error);
    throw new Error('Failed to generate QR code');
  }
}

/**
 * Parse verification key from URL hash
 */
export function parseVerificationFromHash(hash: string): string | null {
  if (!hash.startsWith('#verify=')) {
    return null;
  }
  
  const nsec = hash.substring(8); // Remove '#verify='
  
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
 */
export function createVerificationEvent(
  nsec: string,
  finderPubkey: string,
  geocachePubkey: string,
  geocacheDTag: string
): any {
  try {
    const decoded = nip19.decode(nsec);
    if (decoded.type !== 'nsec') {
      throw new Error('Invalid private key');
    }
    
    const privateKey = decoded.data;
    
    const event = {
      kind: 1985, // NIP-32 label event kind
      content: `Verified find by ${finderPubkey}`,
      tags: [
        ['L', 'geocache-verification'],
        ['l', 'verified-find', 'geocache-verification'],
        ['p', finderPubkey, '', 'finder'],
        ['a', `30001:${geocachePubkey}:${geocacheDTag}`, '', 'geocache']
      ],
      created_at: Math.floor(Date.now() / 1000),
      pubkey: getPublicKey(privateKey),
    };
    
    return finalizeEvent(event, privateKey);
  } catch (error) {
    console.error('Failed to create verification event:', error);
    throw new Error('Failed to create verification event');
  }
}

/**
 * Check if a log has embedded verification
 */
export function hasEmbeddedVerification(event: any): boolean {
  try {
    const embeddedVerification = getEmbeddedVerification(event);
    return embeddedVerification !== null;
  } catch (error) {
    console.log('Error checking embedded verification:', error);
    return false;
  }
}

/**
 * Check if a log has embedded verification event
 */
export function getEmbeddedVerification(event: any): any | null {
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
    console.log('Error parsing embedded verification:', error);
    return null;
  }
}

/**
 * Check if a log has embedded verification and return its ID
 */
export function hasVerificationReference(event: any): string | null {
  try {
    const embeddedVerification = getEmbeddedVerification(event);
    return embeddedVerification ? embeddedVerification.id : null;
  } catch (error) {
    console.log('Error checking verification reference:', error);
    return null;
  }
}

/**
 * Verify that an embedded verification event is valid for a specific log
 */
export function verifyEmbeddedVerification(
  logEvent: any, 
  expectedVerificationPubkey: string
): boolean {
  try {
    const embeddedVerification = getEmbeddedVerification(logEvent);
    if (!embeddedVerification) {
      console.log('No embedded verification found');
      return false;
    }
    
    console.log('verifyEmbeddedVerification called:', {
      embeddedVerificationPubkey: embeddedVerification.pubkey,
      logEventPubkey: logEvent.pubkey,
      expectedVerificationPubkey,
      embeddedVerificationKind: embeddedVerification.kind
    });
    
    return verifyVerificationEvent(embeddedVerification, logEvent, expectedVerificationPubkey);
  } catch (error) {
    console.log('Embedded verification error:', error);
    return false;
  }
}

/**
 * Verify that a verification event is valid for a specific log
 */
export function verifyVerificationEvent(
  verificationEvent: any, 
  logEvent: any, 
  expectedVerificationPubkey: string
): boolean {
  try {
    console.log('verifyVerificationEvent called:', {
      verificationEventPubkey: verificationEvent.pubkey,
      logEventPubkey: logEvent.pubkey,
      expectedVerificationPubkey,
      verificationEventKind: verificationEvent.kind
    });
    
    // Check if the verification event was signed by the expected verification key
    if (verificationEvent.pubkey !== expectedVerificationPubkey) {
      console.log('Verification event pubkey mismatch');
      return false;
    }
    
    // Check if it's the right kind of event (NIP-32 label)
    if (verificationEvent.kind !== 1985) {
      console.log('Wrong verification event kind');
      return false;
    }
    
    // Check if it has the right labels
    const hasCorrectLabel = verificationEvent.tags.some((tag: string[]) =>
      tag[0] === 'L' && tag[1] === 'geocache-verification'
    ) && verificationEvent.tags.some((tag: string[]) =>
      tag[0] === 'l' && tag[1] === 'verified-find'
    );
    
    if (!hasCorrectLabel) {
      console.log('Missing correct verification labels');
      return false;
    }
    
    // Check if it references the correct finder
    const finderTag = verificationEvent.tags.find((tag: string[]) =>
      tag[0] === 'p' && tag[3] === 'finder'
    );
    
    if (!finderTag || finderTag[1] !== logEvent.pubkey) {
      console.log('Verification event does not reference the correct finder');
      return false;
    }
    
    // Verify the event signature
    const signatureValid = verifyEvent(verificationEvent);
    console.log('Verification event signature valid:', signatureValid);
    return signatureValid;
  } catch (error) {
    console.log('Verification error:', error);
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