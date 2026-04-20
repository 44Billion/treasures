/**
 * Custom QR code renderer with branded styling.
 *
 * Draws QR codes with:
 * - Rounded dot modules using a brand-green gradient
 * - Custom finder patterns (eyes) with rounded outer borders and circular inner dots
 * - Clean white background
 *
 * Uses the `qrcode` library's `create()` to get the raw module matrix,
 * then renders everything manually onto a canvas context.
 */

import QRCode from 'qrcode';

// Brand colors (forest green from CSS --primary)
const BRAND_GREEN_DARK = '#1a6e3f';   // --primary-700 approx
const BRAND_GREEN = '#299e5e';        // --primary
const BRAND_GREEN_LIGHT = '#3cb575';  // lighter variant

/**
 * Check if a module at (row, col) is part of a finder pattern (the three 7x7 corners).
 */
function isFinderModule(row: number, col: number, size: number): boolean {
  // Top-left finder: rows 0-6, cols 0-6
  if (row <= 6 && col <= 6) return true;
  // Top-right finder: rows 0-6, cols (size-7) to (size-1)
  if (row <= 6 && col >= size - 7) return true;
  // Bottom-left finder: rows (size-7) to (size-1), cols 0-6
  if (row >= size - 7 && col <= 6) return true;
  return false;
}

/**
 * Draw a single rounded-corner rectangle on the canvas.
 */
export function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/**
 * Draw a custom finder pattern (eye) at the given origin.
 *
 * Structure (each finder is 7x7 modules):
 * - Outer ring: 7x7 rounded rect, dark
 * - Gap ring:   5x5 rounded rect, light (background)
 * - Inner dot:  3x3 rounded rect, dark
 */
function drawFinderPattern(
  ctx: CanvasRenderingContext2D,
  originX: number,
  originY: number,
  moduleSize: number,
  darkColor: string,
) {
  const outerSize = 7 * moduleSize;
  const outerRadius = moduleSize * 1.4;

  // Outer ring (dark)
  ctx.fillStyle = darkColor;
  roundRect(ctx, originX, originY, outerSize, outerSize, outerRadius);
  ctx.fill();

  // Gap ring (white / light)
  const gapOffset = moduleSize;
  const gapSize = 5 * moduleSize;
  const gapRadius = moduleSize * 1.0;

  ctx.fillStyle = '#FFFFFF';
  roundRect(ctx, originX + gapOffset, originY + gapOffset, gapSize, gapSize, gapRadius);
  ctx.fill();

  // Inner dot (dark, circular)
  const innerOffset = 2 * moduleSize;
  const innerSize = 3 * moduleSize;
  const innerRadius = moduleSize * 0.8;

  ctx.fillStyle = darkColor;
  roundRect(ctx, originX + innerOffset, originY + innerOffset, innerSize, innerSize, innerRadius);
  ctx.fill();
}

export interface StyledQROptions {
  /** Text to encode */
  text: string;
  /** Pixel width/height of the resulting QR (excluding margin) */
  size: number;
  /** Quiet-zone modules around the code (default 1) */
  margin?: number;
  /** Error correction level (default 'H' for logo overlay compatibility) */
  errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
}

/**
 * Render a styled QR code directly onto a canvas 2D context.
 *
 * The caller is responsible for positioning: the QR is drawn starting at
 * (destX, destY) on the provided context.
 */
export function drawStyledQR(
  ctx: CanvasRenderingContext2D,
  destX: number,
  destY: number,
  options: StyledQROptions,
) {
  const {
    text,
    size,
    margin = 1,
    errorCorrectionLevel = 'H',
  } = options;

  // Generate the raw QR matrix
  const qr = QRCode.create(text, { errorCorrectionLevel });
  const modules = qr.modules;
  const moduleCount = modules.size; // e.g. 29, 33, etc.
  const totalModules = moduleCount + margin * 2;
  const moduleSize = size / totalModules;

  // White rounded-square background for the QR area
  const bgRadius = size * 0.04;
  ctx.fillStyle = '#FFFFFF';
  roundRect(ctx, destX, destY, size, size, bgRadius);
  ctx.fill();

  // Create a gradient for the data modules
  const gradient = ctx.createLinearGradient(
    destX,
    destY,
    destX + size,
    destY + size,
  );
  gradient.addColorStop(0, BRAND_GREEN_DARK);
  gradient.addColorStop(0.5, BRAND_GREEN);
  gradient.addColorStop(1, BRAND_GREEN_LIGHT);

  // --- Draw data modules (rounded dots) ---
  const dotScale = 0.88; // dot diameter relative to module size (smaller = more gap)
  const dotRadius = (moduleSize * dotScale) / 2;

  for (let row = 0; row < moduleCount; row++) {
    for (let col = 0; col < moduleCount; col++) {
      // Skip finder pattern regions — we draw those separately
      if (isFinderModule(row, col, moduleCount)) continue;

      const isDark = modules.data[row * moduleCount + col] === 1;
      if (!isDark) continue;

      const cx = destX + (col + margin + 0.5) * moduleSize;
      const cy = destY + (row + margin + 0.5) * moduleSize;

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(cx, cy, dotRadius, 0, 2 * Math.PI);
      ctx.fill();
    }
  }

  // --- Draw finder patterns (custom eyes) ---
  const finderColor = BRAND_GREEN_DARK;

  // Top-left
  drawFinderPattern(
    ctx,
    destX + margin * moduleSize,
    destY + margin * moduleSize,
    moduleSize,
    finderColor,
  );

  // Top-right
  drawFinderPattern(
    ctx,
    destX + (margin + moduleCount - 7) * moduleSize,
    destY + margin * moduleSize,
    moduleSize,
    finderColor,
  );

  // Bottom-left
  drawFinderPattern(
    ctx,
    destX + margin * moduleSize,
    destY + (margin + moduleCount - 7) * moduleSize,
    moduleSize,
    finderColor,
  );
}

/**
 * Convenience: render a styled QR code to a data-URL PNG string.
 *
 * This creates a temporary canvas, draws the QR, and returns the result.
 * Useful as a drop-in replacement for `QRCode.toDataURL()`.
 */
export function styledQRToDataURL(
  text: string,
  size: number,
  errorCorrectionLevel: 'L' | 'M' | 'Q' | 'H' = 'H',
): string {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context');

  drawStyledQR(ctx, 0, 0, {
    text,
    size,
    margin: 1,
    errorCorrectionLevel,
  });

  return canvas.toDataURL('image/png', 1.0);
}
