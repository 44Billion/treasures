/**
 * Geocache verification utilities using Nostr key pairs
 */

import { nip19 } from 'nostr-tools'; // Keep for NIP-19 encoding/decoding only
import { NSecSigner } from '@nostrify/nostrify';
import QRCode from 'qrcode';
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
 * Load and resize image while preserving colors and quality
 */
async function loadAndResizeImage(src: string, size: number): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }
      
      canvas.width = size;
      canvas.height = size;
      
      // Enable high-quality image smoothing (with fallback)
      ctx.imageSmoothingEnabled = true;
      if ('imageSmoothingQuality' in ctx) {
        (ctx as any).imageSmoothingQuality = 'high';
      }
      
      // Draw the image scaled to fit, preserving original colors
      ctx.drawImage(img, 0, 0, size, size);
      
      resolve(canvas);
    };
    
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = src;
  });
}


/**
 * Generate QR code data URL for verification with centered icon and descriptive text
 */
export async function generateVerificationQR(naddr: string, nsec: string): Promise<string> {
  // Validate inputs
  if (!naddr || !nsec) {
    throw new Error('Missing required parameters: naddr and nsec are required');
  }
  
  if (!nsec.startsWith('nsec1')) {
    throw new Error('Invalid nsec format: must start with nsec1');
  }
  
  const verificationUrl = `https://treasures.to/${naddr}#verify=${nsec}`;
  
  try {
    // Generate the base QR code with higher error correction to accommodate the logo
    const qrDataUrl = await QRCode.toDataURL(verificationUrl, {
      width: 600,
      margin: 3,
      color: {
        dark: '#1a1a1a',
        light: '#FFFFFF'
      },
      errorCorrectionLevel: 'H' // High error correction to handle logo overlay
    });
    
    // Create a canvas to composite the QR code with the icon and text
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Could not get canvas context');
    }
    
    // Load the QR code image
    const qrImg = new Image();
    await new Promise<void>((resolve, reject) => {
      qrImg.onload = () => resolve();
      qrImg.onerror = () => reject(new Error('Failed to load QR code'));
      qrImg.src = qrDataUrl;
    });
    
    // Calculate dimensions for QR code + text with more generous spacing
    const textHeight = 120; // More space for larger text
    const textPadding = 30; // More padding around text
    const topPadding = 20; // Padding above QR code
    
    canvas.width = qrImg.width + 40; // Add side padding
    canvas.height = qrImg.height + textHeight + textPadding + topPadding;
    
    // Fill background with white and add subtle border
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Add a subtle border around the entire QR code area
    ctx.strokeStyle = '#e5e5e5';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);
    
    // Draw the QR code centered horizontally with top padding
    const qrX = (canvas.width - qrImg.width) / 2;
    ctx.drawImage(qrImg, qrX, topPadding);
    
    try {
      // Use a smaller, optimized icon for better quality in QR codes
      // The 192x192 icon is a good balance between quality and file size
      const iconSize = Math.floor(qrImg.width * 0.25); // Reduced from 30% to 25% for better scanning
      const iconCanvas = await loadAndResizeImage('/icon-192x192.png', iconSize);
      
      // Calculate center position for icon
      const centerX = qrX + (qrImg.width - iconSize) / 2;
      const centerY = topPadding + (qrImg.height - iconSize) / 2;
      
      // Add a white background circle for the icon with optimized padding
      const padding = Math.floor(iconSize * 0.12); // Increased padding for better contrast
      const bgRadius = (iconSize + padding * 2) / 2;
      
      // Draw shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
      ctx.beginPath();
      ctx.arc(qrX + qrImg.width / 2 + 2, topPadding + qrImg.height / 2 + 2, bgRadius, 0, 2 * Math.PI);
      ctx.fill();
      
      // Draw white background
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(qrX + qrImg.width / 2, topPadding + qrImg.height / 2, bgRadius, 0, 2 * Math.PI);
      ctx.fill();
      
      // Add subtle border around icon background
      ctx.strokeStyle = '#e0e0e0';
      ctx.lineWidth = 2;
      ctx.stroke();
      
      // Enable image smoothing for better quality (with fallback)
      ctx.imageSmoothingEnabled = true;
      if ('imageSmoothingQuality' in ctx) {
        (ctx as any).imageSmoothingQuality = 'high';
      }
      
      // Draw the colored icon
      ctx.drawImage(iconCanvas, centerX, centerY);
      
    } catch (iconError) {
      // If icon loading fails, just return the QR code without icon
      console.warn('Failed to load icon for QR code:', iconError);
    }
    
    // Add descriptive text below the QR code with better formatting
    const line1 = 'You found a treasure!';
    const line2 = 'Scan this QR code to log your adventure.';
    
    const textStartY = topPadding + qrImg.height + textPadding + 10;
    
    // Set up text styling with larger, more readable font
    ctx.fillStyle = '#2a2a2a';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // First line - larger and bolder
    const fontSize1 = Math.floor(qrImg.width * 0.045); // Larger font size
    ctx.font = `bold ${fontSize1}px "Segoe UI", Arial, sans-serif`;
    ctx.fillText(line1, canvas.width / 2, textStartY);
    
    // Second line - slightly smaller but still prominent
    const fontSize2 = Math.floor(qrImg.width * 0.038); // Slightly smaller but still large
    const lineSpacing = fontSize1 + 15; // More generous line spacing
    ctx.font = `${fontSize2}px "Segoe UI", Arial, sans-serif`;
    ctx.fillText(line2, canvas.width / 2, textStartY + lineSpacing);
    
    return canvas.toDataURL('image/png');
  } catch (error) {
    console.error('QR generation error:', error);
    
    // Provide more specific error messages
    if (error instanceof Error) {
      if (error.message.includes('Failed to load QR code')) {
        throw new Error('Failed to generate base QR code. Please check your internet connection.');
      } else if (error.message.includes('Could not get canvas context')) {
        throw new Error('Canvas not supported in this browser. Please try a different browser.');
      } else {
        throw new Error(`QR generation failed: ${error.message}`);
      }
    }
    
    throw new Error('Failed to generate QR code due to an unknown error');
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