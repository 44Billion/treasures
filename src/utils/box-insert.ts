/**
 * Box insert generator — renders a printable sheet of TL;DR rule cards
 * that treasure-hiders can drop inside their containers.
 *
 * Output is a PNG data URL (US Letter, 8.5" × 11", 300 DPI when possible)
 * that the existing `printQRCode` plumbing can feed straight into the
 * native print pipeline. We piggy-back on the QR generator's DPI-tier
 * fallback so low-memory Android WebViews don't OOM.
 *
 * Visual treatment takes cues from the BOQM "Door Prize Voucher" on
 * `src/pages/BOQM.tsx`:
 *   - Pastel amber → rose → violet diagonal gradient body
 *   - Dashed primary-green border
 *   - Rotated, very-faded Treasures emblem watermark in the lower-right
 *   - White medallion (thin green ring, soft ground shadow) with the logo
 *   - Extra-bold, UPPERCASE, wide-tracked headline in primary green
 *     with a small gift icon to the left
 *   - Muted body copy, left-aligned
 *   - Dashed-green horizontal separator above the footer
 *
 * Hard-edged rectangles (no rounded corners) so the printout cuts
 * cleanly on a guillotine / scissors.
 *
 * Layout: 2 columns × 5 rows = 10 standard 3.4" × 1.9" business-card
 * inserts per sheet, with a small gutter for breathing room.
 */

/**
 * Allocate a print-page canvas at the highest DPI the device can
 * actually back with memory, stepping down through a tier list on
 * allocation failure. Mirrors the helper used by the QR sheet
 * generators in `utils/verification.ts`.
 */
function allocateCanvas(
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
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, 1, 1);
      return { canvas, ctx, dpi };
    } catch {
      // Try the next-lower DPI.
    }
  }
  throw new Error('Could not allocate print canvas at any DPI tier');
}

/** Load an image (Promise-wrapped) so we can draw it onto a canvas. */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}

/**
 * Render one rule card onto `ctx` with its top-left corner at (x, y).
 * Mirrors the visual treatment of the BOQM Door Prize Voucher.
 *
 * All measurements are in pixels at the canvas's current DPI; the
 * caller passes `dpi` so we can scale font sizes and stroke widths to
 * stay consistent across DPI tiers.
 */
function drawCard(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  cardW: number,
  cardH: number,
  dpi: number,
  logoImg: HTMLImageElement | null,
): void {
  // ── Pastel diagonal gradient body (hard-edged rectangle) ──────────
  // amber-50 (#fffbeb) → rose-50 (#fff1f2) → violet-50 (#f5f3ff)
  const grad = ctx.createLinearGradient(x, y, x + cardW, y + cardH);
  grad.addColorStop(0, '#FFFBEB');
  grad.addColorStop(0.5, '#FFF1F2');
  grad.addColorStop(1, '#F5F3FF');

  ctx.save();
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, cardW, cardH);
  ctx.restore();

  // ── Clip subsequent decoration to the card rect ────────────────────
  // The watermark must stay inside this card and never bleed into
  // neighbors.
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, cardW, cardH);
  ctx.clip();

  // ── Watermark logo (rotated, very faded, lower-right) ──────────────
  if (logoImg) {
    ctx.save();
    const wmSize = cardH * 1.5;
    const wmAnchorX = x + cardW - dpi * 0.08;
    const wmAnchorY = y + cardH - dpi * 0.08;
    ctx.globalAlpha = 0.13;
    ctx.translate(wmAnchorX, wmAnchorY);
    ctx.rotate((-12 * Math.PI) / 180);
    ctx.imageSmoothingEnabled = true;
    if ('imageSmoothingQuality' in ctx) {
      (ctx as unknown as Record<string, unknown>).imageSmoothingQuality = 'high';
    }
    ctx.drawImage(logoImg, -wmSize * 0.55, -wmSize * 0.8, wmSize, wmSize);
    ctx.restore();
  }

  ctx.restore(); // end clip

  // ── Dashed primary-green border (hard-edged rectangle) ─────────────
  ctx.save();
  ctx.strokeStyle = '#3D9F35';
  ctx.lineWidth = Math.max(1, dpi * 0.014);
  ctx.setLineDash([dpi * 0.07, dpi * 0.045]);
  const borderInset = ctx.lineWidth / 2;
  ctx.strokeRect(
    x + borderInset,
    y + borderInset,
    cardW - borderInset * 2,
    cardH - borderInset * 2,
  );
  ctx.restore();

  // ── Padding box for content ────────────────────────────────────────
  const padL = dpi * 0.2;
  const padR = dpi * 0.2;
  const padT = dpi * 0.2;

  // ── Logo medallion (top-left) ──────────────────────────────────────
  // White disc, thin green ring, subtle ground shadow.
  const medR = dpi * 0.22;
  const medCx = x + padL + medR;
  const medCy = y + padT + medR;

  // Soft ground-shadow under the medallion
  ctx.save();
  ctx.beginPath();
  ctx.arc(medCx, medCy + medR * 0.08, medR * 1.02, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
  ctx.filter = 'blur(2px)';
  ctx.fill();
  ctx.restore();

  // White disc
  ctx.save();
  ctx.beginPath();
  ctx.arc(medCx, medCy, medR, 0, Math.PI * 2);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.restore();

  // Thin green ring
  ctx.save();
  ctx.strokeStyle = 'rgba(61, 159, 53, 0.4)'; // primary/40
  ctx.lineWidth = Math.max(0.8, dpi * 0.008);
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.arc(medCx, medCy, medR - ctx.lineWidth / 2, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // The logo inside the disc
  if (logoImg) {
    const logoSize = medR * 2 * 0.74;
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    if ('imageSmoothingQuality' in ctx) {
      (ctx as unknown as Record<string, unknown>).imageSmoothingQuality = 'high';
    }
    ctx.drawImage(
      logoImg,
      medCx - logoSize / 2,
      medCy - logoSize / 2,
      logoSize,
      logoSize,
    );
    ctx.restore();
  }

  // ── Headline row (extra-bold tracked uppercase) ────────────────────
  const headlineX = medCx + medR + dpi * 0.13;
  const headlineY = y + padT + medR * 0.55;
  const headlineSize = Math.floor(dpi * 0.14);

  // "YOU FOUND A TREASURE!" — extra-bold, uppercase, wide tracking.
  // Canvas 2D has no native letter-spacing on all browsers, so we draw
  // each character with manual advance to guarantee the spaced look.
  const headlineText = 'YOU FOUND A TREASURE!';
  const headlineFont =
    `900 ${headlineSize}px "Segoe UI", "Helvetica Neue", Arial, sans-serif`;

  ctx.save();
  ctx.fillStyle = '#3D9F35';
  ctx.font = headlineFont;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  const tracking = headlineSize * 0.12; // ~0.18em in CSS units
  let cursorX = headlineX;
  for (const ch of headlineText) {
    ctx.fillText(ch, cursorX, headlineY);
    cursorX += ctx.measureText(ch).width + tracking;
  }
  ctx.restore();

  // ── Body copy (rules, left-aligned, muted dark gray) ───────────────
  const rules = [
    '1.  Scan the QR code inside to claim & log your find.',
    '2.  Take a trinket! Even better? Trade for one of your own.',
    '3.  Leave the container so the next finder can enjoy it too.',
    '4.  Put it back EXACTLY where and how you found it.',
  ];

  const bodySize = Math.floor(dpi * 0.105);
  const bodyLineGap = dpi * 0.155;
  let bodyY = y + padT + medR * 2 + dpi * 0.08;
  const bodyX = x + padL;
  const bodyRight = x + cardW - padR;

  ctx.save();
  ctx.fillStyle = '#52525B'; // zinc-600
  ctx.font = `500 ${bodySize}px "Segoe UI", "Helvetica Neue", Arial, sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  for (const line of rules) {
    ctx.fillText(line, bodyX, bodyY, bodyRight - bodyX);
    bodyY += bodyLineGap;
  }
  ctx.restore();

  // ── Dashed-green separator above the footer (voucher signature) ────
  const sepY = y + cardH - dpi * 0.32;
  ctx.save();
  ctx.strokeStyle = 'rgba(61, 159, 53, 0.45)'; // primary/30
  ctx.lineWidth = Math.max(0.8, dpi * 0.008);
  ctx.setLineDash([dpi * 0.04, dpi * 0.035]);
  ctx.beginPath();
  ctx.moveTo(x + padL, sepY);
  ctx.lineTo(x + cardW - padR, sepY);
  ctx.stroke();
  ctx.restore();

  // ── Footer: tagline (italic green) + brand crumbs (muted) ──────────
  const taglineSize = Math.floor(dpi * 0.095);
  ctx.save();
  ctx.fillStyle = '#3D9F35';
  ctx.font = `italic 600 ${taglineSize}px "Segoe UI", "Helvetica Neue", Arial, sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('a real-world treasure hunt', x + padL, y + cardH - dpi * 0.21);
  ctx.restore();

  const crumbsSize = Math.floor(dpi * 0.085);
  ctx.save();
  ctx.fillStyle = '#71717A'; // zinc-500
  ctx.font = `${crumbsSize}px "Segoe UI", "Helvetica Neue", Arial, sans-serif`;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillText(
    'treasures.to  \u00b7  find  \u00b7  claim  \u00b7  hide',
    x + cardW - padR,
    y + cardH - dpi * 0.21,
  );
  ctx.restore();
}

/**
 * Generate a printable PNG sheet of 10 "YOU FOUND A TREASURE!" rule
 * cards (2 × 5 grid of 3.5" × 2" business-card inserts on US Letter).
 *
 * The returned data URL can be passed directly to `printQRCode()` —
 * the same plumbing the QR sheet/stamp printouts use — so the user
 * gets the OS print dialog with a "Save as PDF" destination.
 */
export async function generateBoxInsertImage(): Promise<string> {
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const dpiTiers = isMobile ? [300, 240, 200, 160] : [300];

  const { canvas, ctx, dpi } = allocateCanvas(8.5, 11, dpiTiers);

  // White paper background — also serves as the color for the
  // "punched out" coupon edge bites, so it must match the page.
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Card grid: 2 cols × 5 rows of 3.5" × 2" cards, centered on the page,
  // with a small gutter between cards so the dashed borders and
  // perforated edges have room to breathe.
  const cardW = 3.4 * dpi;
  const cardH = 1.9 * dpi;
  const gutter = dpi * 0.18;
  const cols = 2;
  const rows = 5;
  const gridW = cols * cardW + (cols - 1) * gutter;
  const gridH = rows * cardH + (rows - 1) * gutter;
  const marginX = (canvas.width - gridW) / 2;
  const marginY = (canvas.height - gridH) / 2;

  // Pre-load the logo once and reuse it for every card.
  let logoImg: HTMLImageElement | null = null;
  try {
    logoImg = await loadImage('/icon-512x512.png');
  } catch (err) {
    console.warn('Failed to load logo for box insert:', err);
  }

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const cardX = marginX + col * (cardW + gutter);
      const cardY = marginY + row * (cardH + gutter);
      drawCard(ctx, cardX, cardY, cardW, cardH, dpi, logoImg);
    }
  }

  return canvas.toDataURL('image/png');
}
