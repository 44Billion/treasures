import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, Upload, AlertCircle, CheckCircle, Loader2, QrCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/useToast';
import { parseVerificationFromHash } from '@/lib/verification';
import jsQR from 'jsqr';
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
  const [selectedImagePreview, setSelectedImagePreview] = useState<string | null>(null);
  
  const codeReader = useRef<BrowserQRCodeReader | null>(null);

  useEffect(() => {
    // Check if camera API is available (but don't request permissions yet)
    const checkCameraAPI = () => {
      if ('mediaDevices' in navigator && 'getUserMedia' in navigator.mediaDevices) {
        setHasCamera(true);
      } else {
        setHasCamera(false);
      }
    };

    checkCameraAPI();

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
      
      // First, try to get available video devices to find best camera
      let preferredConstraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: 'environment' },  // Start with back camera preference
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      };

      // Try to identify specific back camera device
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputDevices = devices.filter(device => device.kind === 'videoinput');
        
        console.log('Available cameras:', videoInputDevices.map(d => ({ id: d.deviceId, label: d.label })));
        
        if (videoInputDevices.length > 1) {
          // Look for back camera by label
          const backCamera = videoInputDevices.find(device => {
            const label = device.label.toLowerCase();
            return (
              label.includes('back') ||
              label.includes('rear') ||
              label.includes('environment') ||
              label.includes('facing back') ||
              label.includes('world')
            );
          });
          
          if (backCamera) {
            console.log('Found back camera:', backCamera.label);
            preferredConstraints = {
              video: {
                deviceId: { exact: backCamera.deviceId },
                width: { ideal: 1280 },
                height: { ideal: 720 }
              }
            };
          } else {
            // Fallback: try the last camera (often back camera on mobile)
            console.log('Using last camera as fallback:', videoInputDevices[videoInputDevices.length - 1].label);
            preferredConstraints = {
              video: {
                deviceId: { exact: videoInputDevices[videoInputDevices.length - 1].deviceId },
                width: { ideal: 1280 },
                height: { ideal: 720 }
              }
            };
          }
        }
      } catch (enumerateError) {
        console.log('Could not enumerate devices, using facingMode:', enumerateError);
        // Keep the default facingMode constraint
      }

      // Request camera stream with preferred constraints
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(preferredConstraints);
        console.log('Successfully got stream with preferred camera');
      } catch (preferredError) {
        console.log('Preferred camera failed, trying fallback:', preferredError);
        // Fallback to any back camera
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' }
          });
        } catch (backCameraError) {
          console.log('Back camera failed, trying any camera:', backCameraError);
          // Last resort: any camera
          stream = await navigator.mediaDevices.getUserMedia({
            video: true
          });
        }
      }

      setCameraPermission('granted');
      
      // Set up video element
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }

      // Initialize code reader for QR detection only
      if (!codeReader.current) {
        codeReader.current = new BrowserQRCodeReader();
      }

      // Use ZXing's continuous decode from video element
      await codeReader.current.decodeFromVideoElement(
        videoRef.current!,
        (result, error) => {
          if (result) {
            handleQRCodeDetected(result.getText());
            stopScanning();
          }
          if (error && !(error.name === 'NotFoundException')) {
            // Ignore NotFoundException errors as they're expected when no QR code is visible
          }
        }
      );

    } catch (err) {
      const errorObj = err as { message?: string; name?: string };
      
      console.error('Camera error:', errorObj);
      
      if (errorObj.name === 'NotAllowedError') {
        setError('Camera permission denied. Please allow camera access and try again.');
        setCameraPermission('denied');
      } else if (errorObj.name === 'NotFoundError') {
        setError('No camera found on this device.');
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
    
    // Stop the video stream
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    
    setIsScanning(false);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Reset file input
    event.target.value = '';

    setIsProcessing(true);
    setError(null);

    try {
      // Basic validation
      if (!file.type.startsWith('image/')) {
        throw new Error('Please select an image file');
      }

      if (file.size > 10 * 1024 * 1024) {
        throw new Error('File too large (max 10MB)');
      }

      // Create preview using data URL
      const previewDataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
      });
      
      setSelectedImagePreview(previewDataUrl);

      // Try to read QR code
      const qrData = await readQRFromFile(file);
      
      // Process the QR code
      handleQRCodeDetected(qrData);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      setError(errorMessage);
      setIsProcessing(false);
    }
  };

  // Use jsQR for static images (simple & reliable), ZXing for camera
  const readQRFromFile = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        const img = new Image();
        
        img.onload = () => {
          // Create canvas and get image data
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          if (!ctx) {
            reject(new Error('Canvas not supported'));
            return;
          }
          
          canvas.width = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0);
          
          // Get image data for jsQR
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          
          // jsQR is synchronous and reliable for static images
          const code = jsQR(imageData.data, imageData.width, imageData.height);
          
          if (code) {
            resolve(code.data);
          } else {
            reject(new Error('No QR code found in image'));
          }
        };
        
        img.onerror = () => reject(new Error('Image load failed'));
        img.src = dataUrl;
      };
      
      reader.onerror = () => reject(new Error('File read failed'));
      reader.readAsDataURL(file);
    });
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
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  {/* QR Code frame overlay */}
                  <div className="relative">
                    {/* Frame border */}
                    <div className="w-64 h-64 border-2 border-white rounded-lg shadow-lg relative">
                      <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-green-500 rounded-tl-lg"></div>
                      <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-green-500 rounded-tr-lg"></div>
                      <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-green-500 rounded-bl-lg"></div>
                      <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-green-500 rounded-br-lg"></div>
                    </div>
                    {/* Positioning message */}
                    <div className="absolute top-full mt-4 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-75 text-white px-3 py-1 rounded text-sm whitespace-nowrap">
                      Position QR code within the frame
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Camera controls */}
            <div className="flex gap-2">
              {!isScanning ? (
                <Button 
                  onClick={startScanning} 
                  disabled={!hasCamera || isProcessing}
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

            {/* Camera permission message - only show after attempting to start scanning */}
            {cameraPermission === 'denied' && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Camera access is required to scan QR codes. Please enable camera permissions in your browser settings and try again.
                </AlertDescription>
              </Alert>
            )}

            {/* Camera scanning tips */}
            <div className="text-xs text-muted-foreground space-y-1">
              <p className="font-medium">Tips for best results:</p>
              <ul className="list-disc pl-4 space-y-0.5">
                <li>Ensure the QR code is clearly visible and well-lit</li>
                <li>Hold your camera steady and close enough to read the code</li>
                <li>Avoid shadows, glare, or blurry images</li>
                <li>Try adjusting the distance if the code won't scan</li>
              </ul>
            </div>
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
            
            {/* Image preview */}
            {selectedImagePreview && (
              <div className="relative">
                <img
                  src={selectedImagePreview}
                  alt="Selected QR code image"
                  className="w-full max-h-64 object-contain rounded-lg border bg-muted"
                />
                <div className="absolute top-2 right-2">
                  {isProcessing && (
                    <div className="bg-black bg-opacity-75 text-white px-2 py-1 rounded text-xs">
                      Analyzing...
                    </div>
                  )}
                </div>
              </div>
            )}
            
            <Button
              onClick={() => fileInputRef.current?.click()}
              variant="outline"
              disabled={isProcessing}
              className="w-full mb-4"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing image...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  {selectedImagePreview ? 'Choose Different Image' : 'Choose Image'}
                </>
              )}
            </Button>
            
            {/* File upload specific tips */}
            <div className="text-xs text-muted-foreground space-y-1">
              <p className="font-medium">Image upload tips:</p>
              <ul className="list-disc pl-4 space-y-0.5">
                <li>Supported formats: JPG, PNG, GIF (max 10MB)</li>
                <li>Ensure the entire QR code is visible in the photo</li>
                <li>Take the photo directly above the QR code for best results</li>
              </ul>
            </div>
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