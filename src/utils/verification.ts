/**
 * Geocache verification utilities using Nostr key pairs
 *
 * When regenerating a QR code, a new geocache event (kind 37516) is created
 * with a new verification key, invalidating all previous verification keys.
 * Only the most recent verification key from the latest geocache event is valid.
 */

import { nip19 } from 'nostr-tools'; // Keep for NIP-19 encoding/decoding only
import { NSecSigner } from '@nostrify/nostrify';
import { geocacheToNaddr, parseNaddr } from '@/utils/naddr';
import type { NostrEvent } from '@nostrify/nostrify';
import { NIP_GC_KINDS, buildVerificationEventTags, buildVerificationEventContent } from './nip-gc';
import { drawStyledQR, roundRect } from './qr-renderer';
import { getAppOrigin } from '@/utils/appUrl';

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
        (ctx as unknown as Record<string, unknown>).imageSmoothingQuality = 'high';
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
 * Generate QR code data URL for verification with centered icon and descriptive text
 *
 * @param verificationUrl - Full URL to encode in QR code. Can be either:
 *   - Standard format: `{origin}/{naddr}#verify={nsec}` (uses naddr which encodes pubkey+kind+d-tag)
 *   - Compact format: `{origin}/c/{base64-payload}` (encodes pubkey+d-tag+nsec directly, no naddr needed)
 */
export async function generateVerificationQR(
  verificationUrl: string,
  qrType: 'full' | 'cutout' | 'micro' = 'full',
  textStrings: {
    line1: string;
    line2: string;
  }
): Promise<string> {
  // Validate input
  if (!verificationUrl) {
    throw new Error('Missing required parameter: verificationUrl is required');
  }

  if (!verificationUrl.startsWith('http://') && !verificationUrl.startsWith('https://')) {
    throw new Error('Invalid verificationUrl: must be a full URL starting with http:// or https://');
  }

  try {
    switch (qrType) {
      case 'cutout':
        return await generateCutoutQR(verificationUrl, textStrings);
      case 'micro':
        return await generateMicroQR(verificationUrl, textStrings);
      case 'full':
      default:
        return await generateFullQR(verificationUrl, textStrings);
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

async function generateFullQR(
  verificationUrl: string,
  textStrings: { line1: string; line2: string }
): Promise<string> {
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

  await drawCardContent(ctx, cardWidth, cardHeight, verificationUrl, false, false, textStrings);

  return canvas.toDataURL('image/png', 1.0);
}

async function generateCutoutQR(
  verificationUrl: string,
  textStrings: { line1: string; line2: string }
): Promise<string> {
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

  await drawCardContent(cardCtx, cardWidth, cardHeight, verificationUrl, true, false, textStrings);

  const cardX = (pageWidth - cardWidth) / 2;
  const cardY = (pageHeight - cardHeight) / 2;
  pageCtx.drawImage(cardCanvas, cardX, cardY);

  return pageCanvas.toDataURL('image/png', 1.0);
}

async function generateMicroQR(
  verificationUrl: string,
  textStrings: { line1: string; line2: string }
): Promise<string> {
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

  await drawCardContent(cardCtx, cardWidth, cardHeight, verificationUrl, false, true, textStrings);

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
  isMicro: boolean,
  textStrings: { line1: string; line2: string }
) {
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, cardWidth, cardHeight);

  if (dashedBorder) {
    ctx.strokeStyle = '#888888';
    ctx.lineWidth = 4;
    ctx.setLineDash([15, 15]);
    ctx.strokeRect(2, 2, cardWidth - 4, cardHeight - 4);
    ctx.setLineDash([]);
  }
  // No border for full or micro styles

  const qrWidth = isMicro ? cardWidth - 60 : Math.min(cardWidth, cardHeight) * 0.86;

  const qrX = (cardWidth - qrWidth) / 2;
  const topPadding = isMicro ? 60 : 20;

  // Draw styled QR code with rounded dots and branded finder patterns
  drawStyledQR(ctx, qrX, topPadding, {
    text: verificationUrl,
    size: qrWidth,
    margin: 1,
    errorCorrectionLevel: 'H',
  });

  try {
    const iconSize = Math.floor(qrWidth * 0.32);
    const iconCanvas = await loadAndResizeImage('/icon-192x192.png', iconSize);
    const centerX = qrX + (qrWidth - iconSize) / 2;
    const centerY = topPadding + (qrWidth - iconSize) / 2;
    const padding = Math.floor(iconSize * 0.06);
    const bgSize = iconSize + padding * 2;
    const bgX = centerX - padding;
    const bgY = centerY - padding;
    const bgCornerRadius = bgSize * 0.2;

    ctx.fillStyle = '#FFFFFF';
    roundRect(ctx, bgX, bgY, bgSize, bgSize, bgCornerRadius);
    ctx.fill();

    ctx.imageSmoothingEnabled = true;
    if ('imageSmoothingQuality' in ctx) {
      (ctx as unknown as Record<string, unknown>).imageSmoothingQuality = 'high';
    }
    ctx.drawImage(iconCanvas, centerX, centerY, iconSize, iconSize);
  } catch (iconError) {
    console.warn('Failed to load icon for QR code:', iconError);
  }

  const textStartY = topPadding + qrWidth + 20;
  const line1 = textStrings.line1;
  const line2 = textStrings.line2;

  ctx.fillStyle = '#1a1a1a';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const fontSize1 = Math.floor(qrWidth * 0.045);
  ctx.font = `bold ${fontSize1}px "Segoe UI", Arial, sans-serif`;
  ctx.fillText(line1, cardWidth / 2, textStartY);

  const fontSize2 = Math.floor(qrWidth * 0.035);
  const lineSpacing = fontSize1 * 1.15;
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
 * Download QR code as PNG file.
 *
 * On Android we call the native QRPlugin.saveImage which writes to
 * MediaStore (Pictures/Treasures) — visible in the Gallery app.
 *
 * On the web we use the classic Blob-URL + anchor-click approach.
 */
export async function downloadQRCode(dataUrl: string, filename: string = 'geocache-verification-qr.png'): Promise<void> {
  const { Capacitor, registerPlugin } = await import('@capacitor/core');

  if (Capacitor.isNativePlatform()) {
    const base64 = dataUrl.split(',')[1];
    const QRPlugin = registerPlugin<{ saveImage(opts: { base64: string; filename: string }): Promise<void> }>('QRPlugin');
    await QRPlugin.saveImage({ base64, filename });
    return;
  }

  // Web: Convert data URL to Blob URL so the `download` attribute is honoured
  // in browsers that block downloads on raw data: URLs.
  const byteString = atob(dataUrl.split(',')[1]);
  const mimeType = dataUrl.split(',')[0].split(':')[1].split(';')[0];
  const byteArray = new Uint8Array(byteString.length);
  for (let i = 0; i < byteString.length; i++) {
    byteArray[i] = byteString.charCodeAt(i);
  }
  const blob = new Blob([byteArray], { type: mimeType });
  const blobUrl = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.download = filename;
  link.href = blobUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Revoke shortly after to free memory
  setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
}

/**
 * Print a QR code image on Android using the native PrintManager.
 * On web, opens the image in a new window and triggers the browser's
 * print dialog. Falls back to a same-window print on mobile browsers
 * that block popups, since iframe-based printing is unreliable on
 * mobile (Chrome/Safari often print the parent document instead).
 */
export async function printQRCode(dataUrl: string): Promise<void> {
  const { Capacitor, registerPlugin } = await import('@capacitor/core');

  if (Capacitor.isNativePlatform()) {
    const base64 = dataUrl.split(',')[1];
    const QRPlugin = registerPlugin<{ printImage(opts: { base64: string }): Promise<void> }>('QRPlugin');
    await QRPlugin.printImage({ base64 });
    return;
  }

  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const printHtml = `<!DOCTYPE html><html><head><title>Treasures QR Code</title><style>
    @page { size: auto; margin: 0; }
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; background: #fff; }
    body { display: flex; align-items: center; justify-content: center; }
    img { max-width: 100%; max-height: 100vh; width: auto; height: auto; object-fit: contain; display: block; }
    @media print {
      body { display: block; }
      img { max-width: 100%; max-height: 100%; width: 100%; height: auto; page-break-inside: avoid; }
    }
  </style></head><body>
    <img id="qr" alt="QR code" src="${dataUrl}"/>
    <script>
      (function () {
        var img = document.getElementById('qr');
        function doPrint() {
          // Give the browser a tick to lay out the image before printing.
          setTimeout(function () {
            try { window.focus(); } catch (e) {}
            window.print();
          }, 100);
        }
        if (img.complete) { doPrint(); }
        else { img.addEventListener('load', doPrint); img.addEventListener('error', doPrint); }
        // Auto-close after printing on desktop. Mobile browsers ignore
        // this when the user keeps the share sheet open, which is fine.
        window.addEventListener('afterprint', function () {
          setTimeout(function () { try { window.close(); } catch (e) {} }, 200);
        });
      })();
    <\u002fscript>
  </body></html>`;

  // Desktop / popup-friendly path: open in a new window. This isolates
  // the print job from the SPA so window.print() can't accidentally
  // capture the application UI.
  if (!isMobile) {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.open();
      printWindow.document.write(printHtml);
      printWindow.document.close();
      return;
    }
  }

  // Mobile (or popup-blocked) path: build a blob URL and open it in a
  // new tab. The user can then use the browser's native share / print
  // menu — this is the most reliable cross-mobile approach because
  // mobile browsers do not consistently honor `window.print()` from
  // an iframe (they print the parent page instead).
  const blob = new Blob([printHtml], { type: 'text/html' });
  const blobUrl = URL.createObjectURL(blob);
  const opened = window.open(blobUrl, '_blank');
  if (!opened) {
    // Popup blocked — navigate the current tab as a last resort.
    // Stash the document so we can restore it after the user returns.
    window.location.href = blobUrl;
  }
  // Revoke after a delay so the new tab has time to load.
  setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
}


/**
 * Allocate a print-page canvas at the highest DPI the device can
 * actually back with memory, falling back gracefully when allocation
 * fails. Mobile WebViews on lower-end Android can't allocate a full
 * 8.5×11" @ 300dpi canvas (~34 MB RGBA) without OOM, so we step down
 * through a tier list and report the DPI we actually got back to the
 * caller. Every downstream measurement (margins, fonts, line widths)
 * is computed from that DPI so the layout stays consistent regardless
 * of which tier wins.
 */
function allocatePrintCanvas(
  widthInches: number,
  heightInches: number,
  dpiTiers: number[],
): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; dpi: number } {
  for (const dpi of dpiTiers) {
    const width = Math.round(widthInches * dpi);
    const height = Math.round(heightInches * dpi);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) continue;
      // Force the backing store to actually allocate by writing one
      // pixel — some browsers defer allocation until first draw, which
      // means OOM only shows up when we try to use the canvas later.
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, 1, 1);
      return { canvas, ctx, dpi };
    } catch {
      // Try the next-lower DPI.
    }
  }
  throw new Error('Could not allocate print canvas at any DPI tier');
}

/**
 * Generate a printable grid of compact QR codes (stamp).
 * Creates a 5x6 = 30 sticker layout sized to be cut into ~1.6"
 * stickers. Renders at print resolution (with a memory-safe fallback
 * for low-end mobile) so both the QR modules and the labels stay crisp
 * when sent through the print pipeline.
 *
 * The grid used to be 6×7 (42 codes), but each cell was only ~1.4"
 * wide which forced ~4px-tall fonts even at 300dpi. 5×6 gives ~33%
 * more area per stamp without dramatically reducing the total count.
 */
export async function generateQRStampImage(
  stampData: {name: string, naddr: string, keyPair: VerificationKeyPair}[],
  textStrings: { line1: string; line2: string }
): Promise<string> {
  // We previously generated mobile output at 120 DPI to dodge Android's
  // print bitmap limits, but that produced tiny ~4px-tall fonts and
  // ~4px-per-module QR codes that printers couldn't recover detail
  // from. Now that the native print plugin wraps the bitmap into a
  // PDF, we can safely target much higher source DPIs and step down
  // only if allocation fails.
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const dpiTiers = isMobile ? [300, 240, 200, 160] : [300];

  const { canvas, ctx, dpi } = allocatePrintCanvas(8.5, 11, dpiTiers);

  const paperWidth = canvas.width;
  const paperHeight = canvas.height;
  const margin = 0.3 * dpi;

  // White background
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, paperWidth, paperHeight);

  const contentWidth = paperWidth - 2 * margin;
  const contentHeight = paperHeight - 2 * margin;

  // 5 columns x 6 rows = 30 QR codes. Each cell is ≈1.6×1.7" on
  // Letter, which leaves real room for legible labels under each QR.
  const cols = 5;
  const rows = 6;
  const cellWidth = contentWidth / cols;
  const cellHeight = contentHeight / rows;

  // Two-line label fits below each QR. Fonts are sized off cellWidth
  // (≈1.6" of paper), not qrSize, so they stay readable when the QR
  // code shrinks to leave room for the labels.
  const line1FontSize = Math.floor(cellWidth * 0.085);
  const line2FontSize = Math.floor(cellWidth * 0.068);
  const lineGap = Math.floor(dpi * 0.025);
  const textBlockHeight = line1FontSize + lineGap + line2FontSize + lineGap;

  // Give the QR as much room as we can after reserving the label band.
  const qrSize = Math.min(cellWidth * 0.92, cellHeight - textBlockHeight) * 0.95;

  // Pre-load the icon overlay once and reuse it for every cell.
  const iconTargetSize = Math.floor(qrSize * 0.32);
  let iconCanvas: HTMLCanvasElement | null = null;
  try {
    iconCanvas = await loadAndResizeImage('/icon-192x192.png', iconTargetSize);
  } catch (iconError) {
    console.warn('Failed to load icon for QR stamp:', iconError);
  }

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const index = row * cols + col;
      const entry = stampData[index];
      if (!entry) break;

      const x = margin + col * cellWidth;
      const y = margin + row * cellHeight;

      // Center horizontally, sit QR + text block as a unit vertically.
      const blockHeight = qrSize + lineGap + textBlockHeight;
      const qrX = x + (cellWidth - qrSize) / 2;
      const qrY = y + (cellHeight - blockHeight) / 2;

      // Draw the QR directly onto the page canvas at full DPI.
      const verificationUrl = buildStandardVerificationUrl(entry.naddr, entry.keyPair.nsec);
      drawStyledQR(ctx, qrX, qrY, {
        text: verificationUrl,
        size: qrSize,
        margin: 0,
        errorCorrectionLevel: 'H',
      });

      // Icon overlay centered on the QR.
      if (iconCanvas) {
        const iconSize = iconTargetSize;
        const centerX = qrX + (qrSize - iconSize) / 2;
        const centerY = qrY + (qrSize - iconSize) / 2;
        const padding = Math.floor(iconSize * 0.06);
        const bgSize = iconSize + padding * 2;
        const bgCornerRadius = bgSize * 0.2;

        ctx.fillStyle = '#FFFFFF';
        roundRect(
          ctx,
          centerX - padding,
          centerY - padding,
          bgSize,
          bgSize,
          bgCornerRadius,
        );
        ctx.fill();

        ctx.imageSmoothingEnabled = true;
        if ('imageSmoothingQuality' in ctx) {
          (ctx as unknown as Record<string, unknown>).imageSmoothingQuality = 'high';
        }
        ctx.drawImage(iconCanvas, centerX, centerY, iconSize, iconSize);
      }

      // Two-line label below the QR. We deliberately do NOT include
      // the auto-generated 3-word seed — it's a throwaway handle, not
      // anything the recipient will recognize.
      const textCenterX = x + cellWidth / 2;
      let cursorY = qrY + qrSize + lineGap;

      ctx.fillStyle = '#1a1a1a';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';

      ctx.font = `bold ${line1FontSize}px "Segoe UI", Arial, sans-serif`;
      ctx.fillText(textStrings.line1, textCenterX, cursorY, cellWidth * 0.95);
      cursorY += line1FontSize + lineGap;

      ctx.font = `${line2FontSize}px "Segoe UI", Arial, sans-serif`;
      ctx.fillText(textStrings.line2, textCenterX, cursorY, cellWidth * 0.95);
    }
  }

  return canvas.toDataURL('image/png');
}

/**
 * Generate a printable 3x3 grid of QR codes.
 *
 * Renders each QR code directly into its grid cell at the final output
 * DPI (instead of generating a 3.5" card image and downscaling it),
 * which keeps both the QR modules and the labels sharp at print
 * resolution. Uses a memory-safe DPI fallback on mobile so the canvas
 * always allocates without OOM-ing the WebView.
 */
export async function generateQRGridImage(
  sheetData: {name: string, naddr: string, keyPair: VerificationKeyPair}[],
  textStrings: { line1: string; line2: string }
): Promise<string> {

  // Target full print resolution. On mobile we step down through
  // progressively smaller DPIs if the WebView can't allocate the
  // top-tier canvas — this is the same strategy used for the stamp
  // sheet so both modes look identical when allocation succeeds.
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const dpiTiers = isMobile ? [300, 240, 200, 160] : [300];

  const { canvas, ctx, dpi } = allocatePrintCanvas(8.5, 11, dpiTiers);

  const paperWidth = canvas.width;
  const paperHeight = canvas.height;
  const margin = 0.5 * dpi;

  // White background
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, paperWidth, paperHeight);

  const contentWidth = paperWidth - 2 * margin;
  const contentHeight = paperHeight - 2 * margin;
  const cellWidth = contentWidth / 3;
  const cellHeight = contentHeight / 3;

  // Two-line label band under each QR — the auto-generated 3-word
  // seed name is intentionally NOT rendered, since it's a throwaway
  // internal handle and users find it confusing on the printout.
  const textBandHeight = 0.45 * dpi;
  const qrSize = Math.min(cellWidth, cellHeight - textBandHeight) * 0.9;

  // Dashed cut-line styling scales with DPI so the appearance is
  // consistent across every DPI tier.
  const lineWidth = Math.max(1, dpi * 0.012);
  const dashSize = dpi * 0.05;
  const cutPadding = dpi * 0.04;

  // Pre-load the icon overlay once and reuse for every cell — this is
  // both a perf and a correctness win (the previous implementation
  // re-decoded the icon on every iteration).
  const iconTargetSize = Math.floor(qrSize * 0.32);
  let iconCanvas: HTMLCanvasElement | null = null;
  try {
    iconCanvas = await loadAndResizeImage('/icon-192x192.png', iconTargetSize);
  } catch (iconError) {
    console.warn('Failed to load icon for QR grid:', iconError);
  }

  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const entry = sheetData[row * 3 + col];
      if (!entry) continue;

      const x = margin + col * cellWidth;
      const y = margin + row * cellHeight;

      const qrX = x + (cellWidth - qrSize) / 2;
      const qrY = y + (cellHeight - textBandHeight - qrSize) / 2;

      // Dashed cut-line around the QR code itself.
      ctx.strokeStyle = '#888888';
      ctx.lineWidth = lineWidth;
      ctx.setLineDash([dashSize, dashSize]);
      ctx.strokeRect(
        qrX - cutPadding,
        qrY - cutPadding,
        qrSize + cutPadding * 2,
        qrSize + cutPadding * 2,
      );
      ctx.setLineDash([]);

      // Draw the QR directly onto the grid canvas at full DPI — this
      // is what fixes the blur: no intermediate downscale step.
      const verificationUrl = buildStandardVerificationUrl(entry.naddr, entry.keyPair.nsec);
      drawStyledQR(ctx, qrX, qrY, {
        text: verificationUrl,
        size: qrSize,
        margin: 1,
        errorCorrectionLevel: 'H',
      });

      // Icon overlay in the center of the QR code.
      if (iconCanvas) {
        const iconSize = iconTargetSize;
        const centerX = qrX + (qrSize - iconSize) / 2;
        const centerY = qrY + (qrSize - iconSize) / 2;
        const iconPadding = Math.floor(iconSize * 0.06);
        const bgSize = iconSize + iconPadding * 2;
        const bgCornerRadius = bgSize * 0.2;

        ctx.fillStyle = '#FFFFFF';
        roundRect(
          ctx,
          centerX - iconPadding,
          centerY - iconPadding,
          bgSize,
          bgSize,
          bgCornerRadius,
        );
        ctx.fill();

        ctx.imageSmoothingEnabled = true;
        if ('imageSmoothingQuality' in ctx) {
          (ctx as unknown as Record<string, unknown>).imageSmoothingQuality = 'high';
        }
        ctx.drawImage(iconCanvas, centerX, centerY, iconSize, iconSize);
      }

      // Two-line label below the QR, drawn at the page's native DPI
      // so it stays crisp regardless of which fallback tier we landed
      // on. No auto-generated name — see comment above.
      const textCenterX = x + cellWidth / 2;
      const textTop = qrY + qrSize + cutPadding + dpi * 0.08;

      const line1FontSize = Math.floor(qrSize * 0.07);
      const line2FontSize = Math.floor(qrSize * 0.058);
      const lineGap = dpi * 0.04;

      ctx.fillStyle = '#1a1a1a';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';

      let cursorY = textTop;

      ctx.font = `bold ${line1FontSize}px "Segoe UI", Arial, sans-serif`;
      ctx.fillText(textStrings.line1, textCenterX, cursorY, cellWidth * 0.9);
      cursorY += line1FontSize + lineGap * 0.6;

      ctx.font = `${line2FontSize}px "Segoe UI", Arial, sans-serif`;
      ctx.fillText(textStrings.line2, textCenterX, cursorY, cellWidth * 0.9);
    }
  }

  return canvas.toDataURL('image/png');
}