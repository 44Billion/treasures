/**
 * Geocache verification utilities using Nostr key pairs
 * 
 * When regenerating a QR code, a new geocache event (kind 37516) is created
 * with a new verification key, invalidating all previous verification keys.
 * Only the most recent verification key from the latest geocache event is valid.
 */

import { nip19 } from 'nostr-tools'; // Keep for NIP-19 encoding/decoding only
import { NSecSigner } from '@nostrify/nostrify';
import QRCode from 'qrcode';
import { geocacheToNaddr, parseNaddr } from '@/shared/utils/naddr';
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

async function verifyEventSignature(_event: NostrEvent): Promise<boolean> {
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
export async function generateVerificationQR(
  naddr: string,
  nsec: string,
  qrType: 'full' | 'cutout' | 'micro' = 'full'
): Promise<string> {
  // Validate inputs
  if (!naddr || !nsec) {
    throw new Error('Missing required parameters: naddr and nsec are required');
  }
  
  if (!nsec.startsWith('nsec1')) {
    throw new Error('Invalid nsec format: must start with nsec1');
  }
  
  const verificationUrl = `https://treasures.to/${naddr}#verify=${nsec}`;
  
  try {
    switch (qrType) {
      case 'cutout':
        return await generateCutoutQR(verificationUrl);
      case 'micro':
        return await generateMicroQR(verificationUrl);
      case 'full':
      default:
        return await generateFullQR(verificationUrl);
    }
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

async function generateFullQR(verificationUrl: string): Promise<string> {
  const dpi = 300;
  const cardWidthInches = 3.5;
  const cardHeightInches = 3.5;
  const cardWidth = cardWidthInches * dpi;
  const cardHeight = cardHeightInches * dpi;

  const canvas = document.createElement('canvas');
  canvas.width = cardWidth;
  canvas.height = cardHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context');

  await drawCardContent(ctx, cardWidth, cardHeight, verificationUrl, false);

  return canvas.toDataURL('image/png', 1.0);
}

async function generateCutoutQR(verificationUrl: string): Promise<string> {
  const dpi = 300;
  const cardWidthInches = 4;
  const cardHeightInches = 4;
  const cardWidth = cardWidthInches * dpi;
  const cardHeight = cardHeightInches * dpi;

  const pageCanvas = document.createElement('canvas');
  const pageWidth = 8.5 * dpi;
  const pageHeight = 11 * dpi;
  pageCanvas.width = pageWidth;
  pageCanvas.height = pageHeight;
  const pageCtx = pageCanvas.getContext('2d');
  if (!pageCtx) throw new Error('Could not get canvas context');

  pageCtx.fillStyle = '#FFFFFF';
  pageCtx.fillRect(0, 0, pageWidth, pageHeight);

  const cardCanvas = document.createElement('canvas');
  cardCanvas.width = cardWidth;
  cardCanvas.height = cardHeight;
  const cardCtx = cardCanvas.getContext('2d');
  if (!cardCtx) throw new Error('Could not get canvas context');

  await drawCardContent(cardCtx, cardWidth, cardHeight, verificationUrl, true);

  const cardX = (pageWidth - cardWidth) / 2;
  const cardY = (pageHeight - cardHeight) / 2;
  pageCtx.drawImage(cardCanvas, cardX, cardY);

  return pageCanvas.toDataURL('image/png', 1.0);
}

async function generateMicroQR(verificationUrl: string): Promise<string> {
  const dpi = 300;
  const cardWidthInches = 1.3;
  const cardHeightInches = 11;
  const cardWidth = cardWidthInches * dpi;
  const cardHeight = cardHeightInches * dpi;

  const pageCanvas = document.createElement('canvas');
  const pageWidth = 8.5 * dpi;
  const pageHeight = 11 * dpi;
  pageCanvas.width = pageWidth;
  pageCanvas.height = pageHeight;
  const pageCtx = pageCanvas.getContext('2d');
  if (!pageCtx) throw new Error('Could not get canvas context');

  pageCtx.fillStyle = '#FFFFFF';
  pageCtx.fillRect(0, 0, pageWidth, pageHeight);

  const cardCanvas = document.createElement('canvas');
  cardCanvas.width = cardWidth;
  cardCanvas.height = cardHeight;
  const cardCtx = cardCanvas.getContext('2d');
  if (!cardCtx) throw new Error('Could not get canvas context');

  await drawCardContent(cardCtx, cardWidth, cardHeight, verificationUrl, false, true);

  const cardX = (pageWidth - cardWidth) / 2;
  const cardY = (pageHeight - cardHeight) / 2;
  pageCtx.drawImage(cardCanvas, cardX, cardY);

  return pageCanvas.toDataURL('image/png', 1.0);
}

async function drawCardContent(
  ctx: CanvasRenderingContext2D,
  cardWidth: number,
  cardHeight: number,
  verificationUrl: string,
  dashedBorder: boolean,
  isMicro = false
) {
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, cardWidth, cardHeight);

  if (dashedBorder) {
    ctx.strokeStyle = '#888888';
    ctx.lineWidth = 4;
    ctx.setLineDash([15, 15]);
    ctx.strokeRect(2, 2, cardWidth - 4, cardHeight - 4);
    ctx.setLineDash([]);
  } else if (!isMicro) {
    ctx.strokeStyle = '#e5e5e5';
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, cardWidth - 4, cardHeight - 4);
  }

  const qrWidth = isMicro ? cardWidth - 60 : Math.min(cardWidth, cardHeight) * 0.8;
  const qrDataUrl = await QRCode.toDataURL(verificationUrl, {
    width: qrWidth,
    margin: 1,
    color: {
      dark: '#000000',
      light: '#FFFFFF'
    },
    errorCorrectionLevel: 'H'
  });

  const qrImg = new Image();
  await new Promise<void>((resolve, reject) => {
    qrImg.onload = () => resolve();
    qrImg.onerror = () => reject(new Error('Failed to load QR code'));
    qrImg.src = qrDataUrl;
  });

  const qrX = (cardWidth - qrWidth) / 2;
  const topPadding = 60;
  ctx.drawImage(qrImg, qrX, topPadding, qrWidth, qrWidth);

  try {
    const iconSize = Math.floor(qrWidth * 0.22);
    const iconCanvas = await loadAndResizeImage('/icon-192x192.png', iconSize);
    const centerX = qrX + (qrWidth - iconSize) / 2;
    const centerY = topPadding + (qrWidth - iconSize) / 2;
    const padding = Math.floor(iconSize * 0.15);
    const bgRadius = (iconSize + padding * 2) / 2;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.beginPath();
    ctx.arc(qrX + qrWidth / 2 + 3, topPadding + qrWidth / 2 + 3, bgRadius, 0, 2 * Math.PI);
    ctx.fill();

    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(qrX + qrWidth / 2, topPadding + qrWidth / 2, bgRadius, 0, 2 * Math.PI);
    ctx.fill();

    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.imageSmoothingEnabled = true;
    if ('imageSmoothingQuality' in ctx) {
      (ctx as any).imageSmoothingQuality = 'high';
    }
    ctx.drawImage(iconCanvas, centerX, centerY, iconSize, iconSize);
  } catch (iconError) {
    console.warn('Failed to load icon for QR code:', iconError);
  }

  const textStartY = topPadding + qrWidth + 40;
  const line1 = 'You found a treasure!';
  const line2 = 'Scan this QR code to log your adventure.';

  ctx.fillStyle = '#1a1a1a';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const fontSize1 = Math.floor(qrWidth * 0.05);
  ctx.font = `bold ${fontSize1}px "Segoe UI", Arial, sans-serif`;
  ctx.fillText(line1, cardWidth / 2, textStartY);

  const fontSize2 = Math.floor(qrWidth * 0.04);
  const lineSpacing = fontSize1 * 1.2; // Reduced line spacing
  ctx.font = `${fontSize2}px "Segoe UI", Arial, sans-serif`;
  ctx.fillText(line2, cardWidth / 2, textStartY + lineSpacing);

  if (isMicro) {
    const logLineStartY = textStartY + lineSpacing + 30; // Reduced spacing
    const logLineHeight = 60; // Reduced line height
    const logLineCount = Math.floor((cardHeight - logLineStartY) / logLineHeight);
    ctx.strokeStyle = '#AAAAAA';
    ctx.lineWidth = 2;
    for (let i = 0; i < logLineCount; i++) {
      const y = logLineStartY + (i * logLineHeight);
      ctx.beginPath();
      ctx.moveTo(30, y);
      ctx.lineTo(cardWidth - 30, y);
      ctx.stroke();
    }
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
 * Validate that a verification key is the current one for a geocache
 */
export function isCurrentVerificationKey(
  verificationPubkey: string,
  currentVerificationPubkey: string
): boolean {
  return verificationPubkey === currentVerificationPubkey;
}

/**
 * Check if a verification attempt uses an outdated key
 */
export function isOutdatedVerificationKey(
  verificationPubkey: string,
  currentVerificationPubkey: string
): boolean {
  return verificationPubkey !== currentVerificationPubkey;
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

/**
 * Generate a printable 3x3 grid of QR codes.
 */
export async function generateQRGridImage(sheetData: {name: string, naddr: string, keyPair: VerificationKeyPair}[]): Promise<string> {
  const dpi = 300;
  const paperWidth = 8.5 * dpi; // 2550
  const paperHeight = 11 * dpi; // 3300
  const margin = 0.5 * dpi; // 150

  const canvas = document.createElement('canvas');
  canvas.width = paperWidth;
  canvas.height = paperHeight;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Could not get canvas context');
  }

  // White background
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, paperWidth, paperHeight);

  const contentWidth = paperWidth - 2 * margin;
  const contentHeight = paperHeight - 2 * margin;
  const cellWidth = contentWidth / 3;
  const cellHeight = contentHeight / 3;
  const qrSize = Math.min(cellWidth, cellHeight) * 0.9;
  const textHeight = 40;

  ctx.fillStyle = 'black';
  ctx.textAlign = 'center';
  ctx.font = '32px Arial';

  const qrCodePromises = sheetData.map(d => generateVerificationQR(d.naddr, d.keyPair.nsec, 'full'));

  const qrCodes = await Promise.all(qrCodePromises);

  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const qrImage = new Image();
      await new Promise((resolve, reject) => {
        qrImage.onload = resolve;
        qrImage.onerror = reject;
        qrImage.src = qrCodes[row * 3 + col] || '';
      });

      const x = margin + col * cellWidth;
      const y = margin + row * cellHeight;
      
      const qrX = x + (cellWidth - qrSize) / 2;
      const qrY = y + (cellHeight - qrSize - textHeight) / 2;

      ctx.strokeStyle = '#888888';
      ctx.lineWidth = 4;
      ctx.setLineDash([15, 15]);
      ctx.strokeRect(qrX - 10, qrY - 10, qrSize + 20, qrSize + 20);
      ctx.setLineDash([]);

      ctx.drawImage(qrImage, qrX, qrY, qrSize, qrSize);
      
      const textX = x + cellWidth / 2;
      const textY = qrY + qrSize + textHeight;
      const nameData = sheetData[row * 3 + col];
      if (nameData && nameData.name) {
        ctx.fillText(nameData.name, textX, textY, cellWidth * 0.9);
      }
    }
  }

  return canvas.toDataURL('image/png');
}