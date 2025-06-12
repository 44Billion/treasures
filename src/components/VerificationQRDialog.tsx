import { useState, useEffect } from 'react';
import { Download, Copy, Check, QrCode } from 'lucide-react';
import { ComponentLoading } from '@/components/ui/loading';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/shared/hooks/useToast';
import { generateVerificationQR, downloadQRCode, type VerificationKeyPair } from '@/features/geocache/utils/verification';

interface VerificationQRDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  naddr: string;
  verificationKeyPair: VerificationKeyPair;
  cacheName: string;
}

export function VerificationQRDialog({
  isOpen,
  onOpenChange,
  naddr,
  verificationKeyPair,
  cacheName
}: VerificationQRDialogProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen && naddr && verificationKeyPair.nsec) {
      setIsGenerating(true);
      setQrDataUrl(''); // Clear previous QR code
      
      generateVerificationQR(naddr, verificationKeyPair.nsec)
        .then((dataUrl) => {
          setQrDataUrl(dataUrl);
        })
        .catch((error) => {
          toast({
            title: 'QR Generation Failed',
            description: error instanceof Error ? error.message : 'Unable to generate QR code. Please try again.',
            variant: 'destructive',
          });
        })
        .finally(() => setIsGenerating(false));
    }
  }, [isOpen, naddr, verificationKeyPair.nsec, toast]);

  const handleDownload = () => {
    if (qrDataUrl) {
      const safeCacheName = cacheName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      const filename = `${safeCacheName}-${naddr}-verification-qr.png`;
      downloadQRCode(qrDataUrl, filename);
      toast({
        title: 'QR Code Downloaded',
        description: 'The verification QR code has been saved to your downloads.',
      });
    }
  };

  const handleCopyKey = async () => {
    try {
      await navigator.clipboard.writeText(verificationKeyPair.nsec);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: 'Verification Key Copied',
        description: 'The private verification key has been copied to your clipboard.',
      });
    } catch (error) {
      toast({
        title: 'Copy Failed',
        description: 'Unable to copy to clipboard. Please copy manually.',
        variant: 'destructive',
      });
    }
  };

  const verificationUrl = `https://treasures.to/${naddr}#verify=${verificationKeyPair.nsec}`;

  // Verification QR dialog rendering

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto [&>button]:hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <QrCode className="h-5 w-5" />
            Verification QR Code
          </DialogTitle>
          <DialogDescription className="text-sm">
            Print this QR code and place it with your geocache. Finders can scan it to access the verified logging form.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* QR Code Display */}
          <div className="flex justify-center p-3 sm:p-4 bg-white rounded-lg border">
            {isGenerating ? (
              <div className="w-48 h-48 sm:w-64 sm:h-64 flex items-center justify-center bg-muted rounded">
                <ComponentLoading 
                  size="sm" 
                  title="Generating QR code..." 
                />
              </div>
            ) : qrDataUrl ? (
              <img 
                src={qrDataUrl} 
                alt="Verification QR Code" 
                className="w-48 h-48 m:w-64 sm:h-64 rounded max-w-full max-h-[200px] object-contain"
              />
            ) : (
              <div className="w-48 h-48 sm:w-64 sm:h-64 flex items-center justify-center bg-muted rounded">
                <p className="text-xs sm:text-sm text-muted-foreground text-center px-2">Failed to generate QR code</p>
              </div>
            )}
          </div>

          {/* Download QR Code Button - directly below QR code */}
          <div className="flex justify-center">
            <Button
              onClick={handleDownload}
              disabled={!qrDataUrl}
              className="text-sm"
            >
              <Download className="h-4 w-4 mr-2" />
              Download QR Code
            </Button>
          </div>

          {/* Verification Key */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Verification Key (Keep Private)</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={verificationKeyPair.nsec}
                readOnly
                className="flex-1 px-2 sm:px-3 py-2 text-xs font-mono bg-muted border rounded-md min-w-0 break-all"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyKey}
                className="flex-shrink-0 px-2"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Store this key securely. Anyone with this key can create verified logs for your cache.
            </p>
          </div>

          {/* Verification URL */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Verification URL</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={verificationUrl}
                readOnly
                className="flex-1 px-2 sm:px-3 py-2 text-xs font-mono bg-muted border rounded-md min-w-0 break-all"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(verificationUrl);
                    toast({
                      title: 'URL Copied',
                      description: 'The verification URL has been copied to your clipboard.',
                    });
                  } catch (error) {
                    toast({
                      title: 'Copy Failed',
                      description: 'Unable to copy to clipboard. Please copy manually.',
                      variant: 'destructive',
                    });
                  }
                }}
                className="flex-shrink-0 px-2"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Direct link to the verification form for this cache.
            </p>
          </div>

          {/* Done Button */}
          <div className="pt-2">
            <Button
              variant="secondary"
              onClick={() => onOpenChange(false)}
              className="w-full bg-white text-black hover:bg-gray-100 border"
            >
              Done
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}