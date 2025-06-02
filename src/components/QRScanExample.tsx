import { useState } from 'react';
import { QrCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { QRScannerDialog } from '@/components/QRScannerDialog';
import { QRUploadScanner } from '@/components/QRUploadScanner';
import { type QRScanResult } from '@/hooks/useQRScanner';
import { parseVerificationFromHash } from '@/lib/verification';

export function QRScanExample() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [lastScanResult, setLastScanResult] = useState<QRScanResult | null>(null);
  const [verificationKey, setVerificationKey] = useState<string | null>(null);

  const handleScanResult = (result: QRScanResult) => {
    setLastScanResult(result);
    
    // Example: Check if this is a verification QR code
    try {
      const url = new URL(result.text);
      const verificationKey = parseVerificationFromHash(url.hash);
      if (verificationKey) {
        setVerificationKey(verificationKey);
      }
    } catch {
      // Not a valid URL, that's okay
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto p-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            QR Code Scanner Example
          </CardTitle>
          <CardDescription>
            Demonstrates how to use ZXing to scan QR codes from uploaded files or camera
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Dialog Scanner */}
          <div>
            <h3 className="font-medium mb-2">Dialog Scanner</h3>
            <Button onClick={() => setIsDialogOpen(true)} className="gap-2">
              <QrCode className="h-4 w-4" />
              Open QR Scanner
            </Button>
          </div>

          {/* Inline Upload Scanner */}
          <div>
            <h3 className="font-medium mb-2">Inline Upload Scanner</h3>
            <QRUploadScanner onScanResult={handleScanResult} />
          </div>

          {/* Results Display */}
          {lastScanResult && (
            <div className="space-y-2">
              <h3 className="font-medium">Last Scan Result:</h3>
              <div className="bg-muted p-3 rounded-lg space-y-2">
                <div>
                  <span className="text-sm font-medium">Content:</span>
                  <div className="font-mono text-sm break-all bg-background p-2 rounded mt-1">
                    {lastScanResult.text}
                  </div>
                </div>
                <div>
                  <span className="text-sm font-medium">Format:</span>
                  <span className="ml-2 text-sm">{lastScanResult.format}</span>
                </div>
                {verificationKey && (
                  <div>
                    <span className="text-sm font-medium text-green-600">Verification Key Found:</span>
                    <div className="font-mono text-sm break-all bg-green-50 p-2 rounded mt-1">
                      {verificationKey}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <QRScannerDialog
        isOpen={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onScanResult={handleScanResult}
        title="Scan Verification QR Code"
        description="Upload an image or use your camera to scan a geocache verification QR code"
      />
    </div>
  );
}