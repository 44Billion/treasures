import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, Upload, AlertCircle, CheckCircle, Loader2, QrCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/useToast';
import { parseVerificationFromHash } from '@/lib/verification';
import { BrowserQRCodeReader } from '@zxing/library';

export default function Claim() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [isScanning, setIsScanning] = useState(false);
  const [hasCamera, setHasCamera] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [cameraPermission, setCameraPermission] = useState<'granted' | 'denied' | 'prompt'>('prompt');
  
  const codeReader = useRef<BrowserQRCodeReader | null>(null);

  useEffect(() => {
    // Check if camera is available
    const checkCamera = async () => {
      try {
        // Check if mediaDevices is supported
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          console.log('Camera API not supported');
          setHasCamera(false);
          return;
        }

        // Try to get camera access
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        
        // Stop the stream immediately since we just wanted to check permissions
        stream.getTracks().forEach(track => track.stop());
        
        setHasCamera(true);
        setCameraPermission('granted');
      } catch (err) {
        console.log('Camera not available:', err);
        const errorObj = err as { name?: string };
        setHasCamera(false);
        
        if (errorObj.name === 'NotAllowedError') {
          setCameraPermission('denied');
        } else if (errorObj.name === 'NotFoundError') {
          setCameraPermission('prompt');
        } else {
          setCameraPermission('prompt');
        }
      }
    };

    checkCamera();

    return () => {
      stopScanning();
    };
  }, []);

  const validateTreasureUrl = (url: string): { isValid: boolean; naddr?: string; nsec?: string; error?: string } => {
    try {
      const urlObj = new URL(url);
      
      // Check if it's pointing to treasures.to
      if (urlObj.hostname !== 'treasures.to') {
        return { isValid: false, error: 'QR code must point to treasures.to' };
      }
      
      // Extract naddr from pathname (should be /{naddr})
      const pathname = urlObj.pathname;
      const naddr = pathname.slice(1); // Remove leading slash
      
      if (!naddr || !naddr.startsWith('naddr1')) {
        return { isValid: false, error: 'Invalid treasure URL format' };
      }
      
      // Extract verification key from hash
      const nsec = parseVerificationFromHash(urlObj.hash);
      
      if (!nsec) {
        return { isValid: false, error: 'No verification key found in QR code' };
      }
      
      return { isValid: true, naddr, nsec };
    } catch (error) {
      return { isValid: false, error: 'Invalid URL format' };
    }
  };

  const handleQRCodeDetected = (result: string) => {
    console.log('QR Code detected:', result);
    setIsProcessing(true);
    
    const validation = validateTreasureUrl(result);
    
    if (validation.isValid && validation.naddr && validation.nsec) {
      toast({
        title: 'Treasure found!',
        description: 'Redirecting to claim form...',
      });
      
      // Redirect to the cache page with verification key
      navigate(`/${validation.naddr}#verify=${validation.nsec}`);
    } else {
      setError(validation.error || 'Invalid QR code');
      setIsProcessing(false);
      
      toast({
        title: 'Invalid QR Code',
        description: validation.error || 'This QR code is not a valid treasure verification code.',
        variant: 'destructive',
      });
    }
  };

  const startScanning = async () => {
    if (!hasCamera) {
      setError('Camera not available');
      return;
    }

    try {
      setIsScanning(true);
      setError(null);
      
      if (!codeReader.current) {
        codeReader.current = new BrowserQRCodeReader();
      }

      // Try to start scanning with default camera first
      try {
        await codeReader.current.decodeFromVideoDevice(
          undefined, // Use default camera
          videoRef.current!,
          (result, error) => {
            if (result) {
              handleQRCodeDetected(result.getText());
              stopScanning();
            }
            if (error && !(error.name === 'NotFoundException')) {
              console.error('QR scanning error:', error);
            }
          }
        );
      } catch (defaultCameraError) {
        console.warn('Default camera failed, trying to enumerate devices:', defaultCameraError);
        
        // Fallback: try to get video input devices using navigator.mediaDevices
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const videoInputDevices = devices.filter(device => device.kind === 'videoinput');
          
          if (videoInputDevices.length === 0) {
            throw new Error('No camera devices found');
          }

          // Use the first available camera (usually back camera on mobile)
          const selectedDeviceId = videoInputDevices[0].deviceId;

          await codeReader.current.decodeFromVideoDevice(
            selectedDeviceId,
            videoRef.current!,
            (result, error) => {
              if (result) {
                handleQRCodeDetected(result.getText());
                stopScanning();
              }
              if (error && !(error.name === 'NotFoundException')) {
                console.error('QR scanning error:', error);
              }
            }
          );
        } catch (deviceError) {
          console.error('Device enumeration also failed:', deviceError);
          throw defaultCameraError; // Throw the original error
        }
      }
    } catch (err) {
      console.error('Failed to start camera:', err);
      const errorObj = err as { message?: string; name?: string };
      
      if (errorObj.name === 'NotAllowedError') {
        setError('Camera permission denied. Please allow camera access and try again.');
        setCameraPermission('denied');
      } else {
        setError(errorObj.message || 'Failed to start camera');
      }
      setIsScanning(false);
    }
  };

  const stopScanning = () => {
    if (codeReader.current) {
      codeReader.current.reset();
    }
    setIsScanning(false);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setError(null);

    if (!codeReader.current) {
      codeReader.current = new BrowserQRCodeReader();
    }

    // Create an image element to decode from
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    
    img.onload = () => {
      codeReader.current!.decodeFromImageElement(img)
        .then((result) => {
          handleQRCodeDetected(result.getText());
          URL.revokeObjectURL(objectUrl); // Clean up
        })
        .catch((err) => {
          console.error('Failed to read QR code from image:', err);
          setError('Could not read QR code from image. Please try a clearer image.');
          setIsProcessing(false);
          URL.revokeObjectURL(objectUrl); // Clean up
        });
    };
    
    img.onerror = () => {
      setError('Failed to load image. Please try a different file.');
      setIsProcessing(false);
      URL.revokeObjectURL(objectUrl); // Clean up
    };
    
    img.src = objectUrl;
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">Claim Treasure</h1>
        <p className="text-muted-foreground">
          Scan the QR code found with your treasure to claim your verified find!
        </p>
      </div>

      <div className="space-y-6">
        {/* Camera Scanner */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              Camera Scanner
            </CardTitle>
            <CardDescription>
              Point your camera at the QR code inside the treasure container
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Video preview */}
            <div className="relative">
              <video
                ref={videoRef}
                className={`w-full rounded-lg bg-black ${isScanning ? 'block' : 'hidden'}`}
                style={{ maxHeight: '400px' }}
                playsInline
                muted
              />
              
              {!isScanning && (
                <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
                  <div className="text-center">
                    <QrCode className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">Camera preview will appear here</p>
                  </div>
                </div>
              )}

              {isScanning && (
                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute inset-4 border-2 border-white rounded-lg shadow-lg">
                    <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-green-500 rounded-tl-lg"></div>
                    <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-green-500 rounded-tr-lg"></div>
                    <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-green-500 rounded-bl-lg"></div>
                    <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-green-500 rounded-br-lg"></div>
                  </div>
                  <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-75 text-white px-3 py-1 rounded text-sm">
                    Position QR code within the frame
                  </div>
                </div>
              )}
            </div>

            {/* Camera controls */}
            <div className="flex gap-2">
              {!isScanning ? (
                <Button 
                  onClick={startScanning} 
                  disabled={!hasCamera || cameraPermission === 'denied' || isProcessing}
                  className="flex-1"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Camera className="h-4 w-4 mr-2" />
                      Start Scanning
                    </>
                  )}
                </Button>
              ) : (
                <Button onClick={stopScanning} variant="outline" className="flex-1">
                  Stop Scanning
                </Button>
              )}
            </div>

            {/* Camera permission message */}
            {cameraPermission === 'denied' && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Camera access is required to scan QR codes. Please enable camera permissions in your browser settings and refresh the page.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* File Upload Alternative */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Upload Image
            </CardTitle>
            <CardDescription>
              Alternatively, upload a photo of the QR code
            </CardDescription>
          </CardHeader>
          <CardContent>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileUpload}
              className="hidden"
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              variant="outline"
              disabled={isProcessing}
              className="w-full"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Choose Image
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Error display */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Success state */}
        {isProcessing && !error && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              QR code detected! Validating treasure...
            </AlertDescription>
          </Alert>
        )}

        {/* Instructions */}
        <Card>
          <CardHeader>
            <CardTitle>How to Claim</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium mt-0.5">
                1
              </div>
              <p className="text-sm">Find the QR code inside the treasure container</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium mt-0.5">
                2
              </div>
              <p className="text-sm">Scan it with your camera or upload a photo</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium mt-0.5">
                3
              </div>
              <p className="text-sm">You'll be redirected to submit your verified find log</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}