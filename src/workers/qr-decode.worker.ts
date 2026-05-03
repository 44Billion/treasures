/**
 * QR decode worker — BarcodeDetector off the main thread.
 * Receives ImageBitmap (zero-copy transfer), returns { value: string | null }.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

interface BarcodeDetectorCtor {
  new(opts: { formats: string[] }): {
    detect(src: ImageBitmap): Promise<Array<{ rawValue: string }>>;
  };
}

const Ctor = (self as any).BarcodeDetector as BarcodeDetectorCtor | undefined;
const detector = Ctor ? new Ctor({ formats: ['qr_code'] }) : null;

self.onmessage = async (e: MessageEvent<ImageBitmap>) => {
  const bitmap = e.data;
  try {
    if (!detector) { (self as any).postMessage({ value: null }); return; }
    const results = await detector.detect(bitmap);
    (self as any).postMessage({ value: results[0]?.rawValue ?? null });
  } catch {
    (self as any).postMessage({ value: null });
  } finally {
    bitmap.close();
  }
};
