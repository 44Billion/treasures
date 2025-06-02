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
  const [selectedImagePreview, setSelectedImagePreview] = useState<string | null>(null);
  
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
          null, // Use default camera
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

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Reset file input to allow selecting the same file again
    event.target.value = '';

    console.log('File upload started:', {
      name: file.name,
      size: file.size,
      type: file.type,
    });

    // Create preview
    const previewUrl = URL.createObjectURL(file);
    setSelectedImagePreview(previewUrl);

    setIsProcessing(true);
    setError(null);

    try {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        throw new Error('Please select an image file (JPG, PNG, GIF, etc.)');
      }

      // Check file size (max 10MB)
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxSize) {
        throw new Error('Image file is too large. Please use an image smaller than 10MB.');
      }

      // Initialize QR reader
      if (!codeReader.current) {
        codeReader.current = new BrowserQRCodeReader();
      }

      // Try multiple approaches for better compatibility
      let qrResult: string | null = null;

      // Approach 1: Direct file reading with FileReader (better for large files)
      try {
        qrResult = await readQRFromFileReader(file);
        console.log('QR code read via FileReader approach');
      } catch (fileReaderError) {
        console.log('FileReader approach failed:', fileReaderError);
      }

      // Approach 2: Object URL approach (fallback)
      if (!qrResult) {
        try {
          qrResult = await readQRFromObjectURL(file);
          console.log('QR code read via Object URL approach');
        } catch (objectUrlError) {
          console.log('Object URL approach also failed:', objectUrlError);
          throw new Error('Unable to read QR code from this image. Please try a different image with a clear, well-lit QR code.');
        }
      }

      if (qrResult) {
        console.log('QR code successfully detected from uploaded file:', qrResult);
        handleQRCodeDetected(qrResult);
      } else {
        throw new Error('No QR code found in the image. Please try a different image.');
      }

    } catch (error) {
      console.error('File upload error:', error);
      const errorObj = error as { message?: string };
      setError(errorObj.message || 'Failed to process image. Please try again.');
      setIsProcessing(false);
    } finally {
      // Clean up preview after processing
      if (previewUrl) {
        setTimeout(() => {
          URL.revokeObjectURL(previewUrl);
          setSelectedImagePreview(null);
        }, 2000);
      }
    }
  };

  // Helper function to read QR code using FileReader approach
  const readQRFromFileReader = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        const result = e.target?.result;
        if (typeof result === 'string') {
          const img = new Image();
          
          img.onload = () => {
            codeReader.current!.decodeFromImageElement(img)
              .then((qrResult) => {
                resolve(qrResult.getText());
              })
              .catch(reject);
          };
          
          img.onerror = () => {
            reject(new Error('Failed to load image from FileReader data'));
          };
          
          img.src = result;
        } else {
          reject(new Error('Invalid FileReader result'));
        }
      };
      
      reader.onerror = () => {
        reject(new Error('Failed to read file'));
      };
      
      reader.readAsDataURL(file);
    });
  };

  // Helper function to read QR code using Object URL approach
  const readQRFromObjectURL = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const objectUrl = URL.createObjectURL(file);
      const img = new Image();
      
      // Set up cleanup function
      const cleanup = () => {
        URL.revokeObjectURL(objectUrl);
      };
      
      img.onload = () => {
        // Add small delay to ensure image is fully rendered
        setTimeout(() => {
          codeReader.current!.decodeFromImageElement(img)
            .then((result) => {
              cleanup();
              resolve(result.getText());
            })
            .catch((error) => {
              cleanup();
              reject(error);
            });
        }, 100);
      };
      
      img.onerror = () => {
        cleanup();
        reject(new Error('Failed to load image from object URL'));
      };
      
      // Set crossOrigin to handle potential CORS issues
      img.crossOrigin = 'anonymous';
      img.src = objectUrl;
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
          <CardContent className="space-y-4">
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
              className="w-full"
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
            
            {/* File upload tips */}
            <div className="text-xs text-muted-foreground space-y-1">
              <p className="font-medium">Tips for best results:</p>
              <ul className="list-disc pl-4 space-y-0.5">
                <li>Ensure the QR code is clearly visible and well-lit</li>
                <li>Hold your camera steady and close enough to read the code</li>
                <li>Avoid shadows, glare, or blurry images</li>
                <li>Supported formats: JPG, PNG, GIF (max 10MB)</li>
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