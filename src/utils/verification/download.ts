/**
 * Download and print helpers for verification QR images.
 *
 * On Android these call the native QRPlugin (MediaStore save / PrintManager);
 * on the web they fall back to Blob-URL downloads and print windows.
 */

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
