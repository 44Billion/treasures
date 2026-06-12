/**
 * Verification key management for geocaches.
 *
 * When regenerating a QR code, a new geocache event (kind 37516) is created
 * with a new verification key, invalidating all previous verification keys.
 * Only the most recent verification key from the latest geocache event is valid.
 */

import { nip19 } from 'nostr-tools';
import { NSecSigner } from '@nostrify/nostrify';
import { getAppOrigin } from '@/utils/appUrl';

// Verification constants
const VERIFICATION_HASH_PREFIX = '#verify=';

// Crypto utilities using Web Crypto API
async function generateSecretKey(): Promise<Uint8Array> {
  const key = new Uint8Array(32);
  crypto.getRandomValues(key);
  return key;
}

export async function getPublicKeyFromSecret(secretKey: Uint8Array): Promise<string> {
  const signer = new NSecSigner(secretKey);
  return await signer.getPublicKey();
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

  const nsec = nip19.nsecEncode(privateKey);
  const npub = nip19.npubEncode(publicKey);

  return {
    privateKey,
    publicKey,
    nsec,
    npub,
  };
}

/**
 * Build a standard verification URL from naddr and nsec
 * Standard format: treasures.to/{naddr}#verify={nsec}
 * Note: naddr encodes pubkey + kind + d-tag, so this format requires the naddr
 */
export function buildStandardVerificationUrl(naddr: string, nsec: string): string {
  if (!naddr || !nsec) {
    throw new Error('Missing required parameters: naddr and nsec are required');
  }
  if (!nsec.startsWith('nsec1')) {
    throw new Error('Invalid nsec format: must start with nsec1');
  }
  const origin = getAppOrigin();
  return `${origin}/${naddr}#verify=${nsec}`;
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
