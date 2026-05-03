/**
 * QrScanner — WebView QR scanner using BarcodeDetector in a Web Worker.
 *
 * Frame capture uses requestVideoFrameCallback (rVFC) which fires in sync with
 * the video decoder — grabbing a frame there costs nothing and doesn't touch
 * the compositor. The ImageBitmap is transferred zero-copy to the worker so
 * the main thread is never blocked by the decode.
 */

import { useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import QrDecodeWorker from '@/workers/qr-decode.worker?worker';

export function isBarcodeDetectorSupported(): boolean {
  return typeof window !== 'undefined' && 'BarcodeDetector' in window;
}

interface QrScannerProps {
  onScan: (value: string) => void;
  onClose: () => void;
  className?: string;
}

type ScannerState = 'requesting' | 'active' | 'denied' | 'error';

// rVFC isn't in the TS DOM lib yet on older targets — cast where needed

export function QrScanner({ onScan, onClose, className }: QrScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const rvfcIdRef = useRef<number>(0);
  const busyRef = useRef(false);
  const stoppedRef = useRef(false);
  const lastValueRef = useRef('');
  // Throttle: only send a frame every N rVFC callbacks (~30fps source → ~6fps decode)
  const frameCountRef = useRef(0);
  const DECODE_EVERY = 5;

  const [state, setState] = useState<ScannerState>('requesting');
  const [errorMsg, setErrorMsg] = useState('');
  const [streamReady, setStreamReady] = useState(false);

  useEffect(() => {
    if (!isBarcodeDetectorSupported()) {
      setState('error');
      setErrorMsg('QR scanning is not supported in this browser.');
      return;
    }

    let cancelled = false;
    workerRef.current = new QrDecodeWorker();

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 640 }, height: { ideal: 640 } },
          audio: false,
        });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        setStreamReady(true);
        setState('active');
      } catch (err: unknown) {
        if (cancelled) return;
        const e = err as { name?: string; message?: string };
        if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
          setState('denied');
        } else {
          setState('error');
          setErrorMsg(e.message ?? 'Could not access camera.');
        }
      }
    }

    start();

    return () => {
      cancelled = true;
      stoppedRef.current = true;
      const video = videoRef.current;
      if (video && rvfcIdRef.current) video.cancelVideoFrameCallback(rvfcIdRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  // Attach stream once video element is mounted
  useEffect(() => {
    if (!streamReady || !videoRef.current || !streamRef.current) return;
    videoRef.current.srcObject = streamRef.current;
  }, [streamReady]);

  // Start rVFC decode loop once active
  useEffect(() => {
    if (state !== 'active') return;
    const worker = workerRef.current;
    if (!worker) return;

    worker.onmessage = (e: MessageEvent<{ value: string | null }>) => {
      busyRef.current = false;
      if (stoppedRef.current) return;
      const value = e.data.value;
      if (value && value !== lastValueRef.current) {
        lastValueRef.current = value;
        stoppedRef.current = true;
        const video = videoRef.current;
        if (video && rvfcIdRef.current) video.cancelVideoFrameCallback(rvfcIdRef.current);
        onScan(value);
      }
    };

    function onFrame() {
      if (stoppedRef.current) return;
      const video = videoRef.current;
      if (!video) return;

      // Re-register immediately so the video keeps rendering at full fps
      rvfcIdRef.current = video.requestVideoFrameCallback(onFrame);

      // Only decode every Nth frame
      frameCountRef.current++;
      if (frameCountRef.current % DECODE_EVERY !== 0) return;
      if (busyRef.current) return;

      createImageBitmap(video).then(bitmap => {
        if (stoppedRef.current) { bitmap.close(); return; }
        busyRef.current = true;
        workerRef.current?.postMessage(bitmap, [bitmap as unknown as Transferable]);
      }).catch(() => { /* video not ready yet, skip frame */ });
    }

    // Wait for video to start playing before registering rVFC
    const video = videoRef.current;
    if (video) {
      const register = () => {
        rvfcIdRef.current = video.requestVideoFrameCallback(onFrame);
      };
      if (video.readyState >= 2) {
        register();
      } else {
        video.addEventListener('canplay', register, { once: true });
      }
    }

    return () => {
      const v = videoRef.current;
      if (v && rvfcIdRef.current) v.cancelVideoFrameCallback(rvfcIdRef.current);
    };
  }, [state, onScan]);

  return (
    <div className={cn('flex flex-col items-center gap-3', className)}>
      <div className="relative w-full aspect-square max-w-xs rounded-xl overflow-hidden bg-black border border-border shadow-inner">

        {/* Only mounted after stream ready — no play-button flash */}
        {streamReady && (
          <video
            ref={videoRef}
            className="absolute inset-0 w-full h-full object-cover"
            autoPlay
            muted
            playsInline
          />
        )}

        {state === 'active' && (
          <div className="absolute inset-0 pointer-events-none">
            <span className="absolute top-4 left-4 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-sm" />
            <span className="absolute top-4 right-4 w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-sm" />
            <span className="absolute bottom-4 left-4 w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-sm" />
            <span className="absolute bottom-4 right-4 w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-sm" />
            <span className="absolute left-4 right-4 h-0.5 bg-primary/70 animate-scan-line" />
          </div>
        )}

        {state === 'requesting' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="text-sm">Requesting camera…</p>
          </div>
        )}
        {state === 'denied' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center text-white">
            <CameraOff className="h-8 w-8 text-destructive" />
            <p className="text-sm font-medium">Camera access denied</p>
            <p className="text-xs text-white/70">Allow camera permission in your device settings, then try again.</p>
          </div>
        )}
        {state === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center text-white">
            <Camera className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">Scanner unavailable</p>
            <p className="text-xs text-white/70">{errorMsg || 'Use the manual URL option below.'}</p>
          </div>
        )}
      </div>

      {state === 'active' && (
        <p className="text-xs text-muted-foreground text-center">
          Point the camera at the QR code on the geocache
        </p>
      )}

      <Button variant="ghost" size="sm" onClick={onClose} className="text-muted-foreground">
        Close scanner
      </Button>
    </div>
  );
}
