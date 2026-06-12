/**
 * QR code rendering for geocache verification.
 *
 * Generates printable verification QR codes: single cards (full / cutout /
 * micro), 3x3 grid sheets, and 5x6 stamp sheets. All rendering happens on
 * canvas at print DPI with memory-safe fallbacks for mobile WebViews.
 */

import { drawStyledQR, roundRect } from '@/utils/qr-renderer';
import { buildStandardVerificationUrl, type VerificationKeyPair } from './keys';

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