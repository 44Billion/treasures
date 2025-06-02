/**
 * Geocache verification utilities using Nostr key pairs
 */

import { generateSecretKey, getPublicKey, finalizeEvent, verifyEvent, getEventHash } from 'nostr-tools';
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
 * Create an attestation signature for a verified find
 * Signs the string 'finderNpub:naddr' with the verification private key
 */
export function createAttestation(
  nsec: string,
  finderNpub: string,
  naddr: string
): { signature: string; message: string } {
  try {
    const decoded = nip19.decode(nsec);
    if (decoded.type !== 'nsec') {
      throw new Error('Invalid private key');
    }
    
    const privateKey = decoded.data;
    
    // Create the attestation message
    const attestationMessage = `${finderNpub}:${naddr}`;
    
    // Create a minimal event to sign the attestation message
    const event = finalizeEvent({
      kind: 1,
      content: attestationMessage,
      tags: [],
      created_at: 0, // Use 0 timestamp for deterministic signatures
    }, privateKey);
    
    return {
      signature: event.sig,
      message: attestationMessage
    };
  } catch (error) {
    console.error('Failed to create attestation:', error);
    throw new Error('Failed to create attestation');
  }
}

/**
 * Verify an attestation signature 
 * Verifies that the signature was created by signing 'finderNpub:naddr' with the verification key
 */
export function verifyAttestation(
  signature: string,
  finderNpub: string,  
  naddr: string,
  expectedVerificationPubkey: string
): boolean {
  try {
    // Recreate the attestation message
    const attestationMessage = `${finderNpub}:${naddr}`;
    
    // Recreate the exact event structure that was signed
    const event = {
      kind: 1,
      content: attestationMessage,
      tags: [],
      created_at: 0, // Same deterministic timestamp
      pubkey: expectedVerificationPubkey,
      id: '', // Will be set by getEventHash
      sig: signature
    };
    
    // Calculate the event hash and set it
    event.id = getEventHash(event);
    
    // Verify the complete event
    return verifyEvent(event);
  } catch (error) {
    console.error('Failed to verify attestation:', error);
    return false;
  }
}

/**
 * Get attestation signature from a log event
 */
export function getAttestationSignature(event: any): string | null {
  try {
    // Look for attestation tag with just the signature
    const attestationTag = event.tags.find((tag: string[]) => 
      tag[0] === 'attestation' && tag[1]
    );
    
    return attestationTag?.[1] || null;
  } catch (error) {
    console.log('Error getting attestation signature:', error);
    return null;
  }
}

/**
 * Check if a log has an attestation signature
 */
export function hasAttestation(event: any): boolean {
  return getAttestationSignature(event) !== null;
}

/**
 * Verify that a log event has a valid attestation
 */
export function verifyLogAttestation(
  logEvent: any,
  naddr: string,
  expectedVerificationPubkey: string
): boolean {
  try {
    const signature = getAttestationSignature(logEvent);
    if (!signature) {
      console.log('No attestation signature found');
      return false;
    }
    
    // Convert finder pubkey to npub format
    const finderNpub = nip19.npubEncode(logEvent.pubkey);
    
    // Verify the attestation
    return verifyAttestation(
      signature,
      finderNpub,
      naddr,
      expectedVerificationPubkey
    );
  } catch (error) {
    console.log('Log attestation verification error:', error);
    return false;
  }
}

// ===== DEPRECATED VERIFICATION FUNCTIONS =====
// The following functions are kept for backward compatibility
// New code should use the attestation-based functions above

/**
 * @deprecated Use hasAttestation instead
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