import { useRef, useState, useEffect } from 'react';
import { Camera, Square, AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useQRScanner, type QRScanResult } from '@/hooks/useQRScanner';

interface QRCameraScannerProps {
  onScanResult: (result: QRScanResult) => void;
  onError?: (error: string) => void;
  className?: string;
}

export function QRCameraScanner({
  onScanResult,
  onError,
  className = ''
}: QRCameraScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanResult, setScanResult] = useState<QRScanResult | null>(null);
  
  const { scanFromCamera, isScanning, error, clearError } = useQRScanner();

  const startCamera = async () => {
    try {
      clearError();
      setScanResult(null);
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment', // Prefer back camera
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });
      
      streamRef.current = stream;
      setHasPermission(true);
      setIsActive(true);
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (err) {
      setHasPermission(false);
      const errorMessage = err instanceof Error ? err.message : 'Failed to access camera';
      onError?.(errorMessage);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsActive(false);
    setScanResult(null);
    clearError();
  };

  const captureAndScan = async () => {
    if (!videoRef.current || !isActive) return;

    try {
      const result = await scanFromCamera(videoRef.current);
      if (result) {
        setScanResult(result);
        onScanResult(result);
        stopCamera(); // Stop camera after successful scan
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to scan QR code';
      onError?.(errorMessage);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Camera View */}
      <Card>
        <CardContent className="p-4">
          {!isActive ? (
            <div className="text-center space-y-4 py-8">
              <div className="mx-auto w-16 h-16 text-muted-foreground">
                <Camera className="w-16 h-16" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-medium">Camera Scanner</h3>
                <p className="text-sm text-muted-foreground">
                  Use your device's camera to scan QR codes in real-time
                </p>
              </div>
              <Button onClick={startCamera} className="gap-2">
                <Camera className="w-4 h-4" />
                Start Camera
              </Button>
              {hasPermission === false && (
                <p className="text-xs text-destructive">
                  Camera permission denied. Please enable camera access in your browser settings.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="relative">
                <video
                  ref={videoRef}
                  className="w-full h-64 object-cover rounded-lg bg-black"
                  playsInline
                  muted
                />
                {/* Scanning overlay */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-48 h-48 border-2 border-primary rounded-lg relative">
                    <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-primary"></div>
                    <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-primary"></div>
                    <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-primary"></div>
                    <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-primary"></div>
                  </div>
                </div>
              </div>
              
              <div className="flex gap-2 justify-center">
                <Button
                  onClick={captureAndScan}
                  disabled={isScanning}
                  className="gap-2"
                >
                  {isScanning ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  ) : (
                    <Square className="w-4 h-4" />
                  )}
                  {isScanning ? 'Scanning...' : 'Scan QR Code'}
                </Button>
                <Button variant="outline" onClick={stopCamera}>
                  Stop Camera
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Scan Result */}
      {scanResult && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-2">
              <p className="font-medium">QR Code detected successfully!</p>
              <div className="bg-muted p-2 rounded text-sm font-mono break-all">
                {scanResult.text}
              </div>
              <p className="text-xs text-muted-foreground">
                Format: {scanResult.format}
              </p>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-1">
              <p className="font-medium">Scan failed</p>
              <p className="text-sm">{error.message}</p>
              {error.type === 'not_found' && (
                <p className="text-xs">
                  Tip: Position the QR code within the scanning area and ensure good lighting.
                </p>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}