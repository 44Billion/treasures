import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, Copy, QrCode, ChevronDown, Printer } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ComponentLoading } from '@/components/ui/loading';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/shared/hooks/useToast';
import { generateVerificationQR, downloadQRCode, type VerificationKeyPair } from '@/features/geocache/utils/verification';
import { encodeCompactUrl } from '@/shared/utils/compactUrl';
import { naddrToGeocache } from '@/shared/utils/naddr-utils';
import { NIP_GC_KINDS } from '@/features/geocache/utils/nip-gc';

interface VerificationQRDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  naddr: string;
  verificationKeyPair: VerificationKeyPair;
  cacheName: string;
  useCompact?: boolean;
}

export function VerificationQRDialog({
  isOpen,
  onOpenChange,
  naddr,
  verificationKeyPair,
  cacheName,
  useCompact = false
}: VerificationQRDialogProps) {
  const { t } = useTranslation();
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [qrType, setQrType] = useState<'full' | 'cutout' | 'micro'>('full');
  const [isGenerating, setIsGenerating] = useState(false);

  const { toast } = useToast();

  // Extract d-tag from naddr (use existing d-tag when regenerating)
  const naddrData = useMemo(() => naddrToGeocache(naddr), [naddr]);
  const existingDTag = naddrData.identifier; // AddressPointer uses 'identifier' for d-tag
  
  // Use the existing d-tag from the geocache (works for both new and regenerated caches)
  const compactUrl = useMemo(() => {
    if (!useCompact) return null;
    return encodeCompactUrl(naddrData.pubkey, existingDTag, verificationKeyPair.nsec, NIP_GC_KINDS.GEOCACHE);
  }, [useCompact, naddrData.pubkey, existingDTag, verificationKeyPair.nsec]);
  
  const standardUrl = useMemo(() => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://treasures.to';
    return `${origin}/${naddr}#verify=${verificationKeyPair.nsec}`;
  }, [naddr, verificationKeyPair.nsec]);
  const verificationUrl = useMemo(() => {
    return useCompact && compactUrl ? compactUrl : standardUrl;
  }, [useCompact, compactUrl, standardUrl]);

  useEffect(() => {
    if (isOpen && naddr && verificationKeyPair.nsec) {
      console.log('[VerificationQR] Generating QR', { useCompact, dTag: existingDTag, urlLength: verificationUrl.length });
      setIsGenerating(true);
      setQrDataUrl(''); // Clear previous QR code
      
      // verificationUrl is already a full URL (either standard or compact format)
      generateVerificationQR(verificationUrl, qrType, {
        line1: t('qrCode.foundTreasure'),
        line2: t('qrCode.scanToLog')
      })
        .then((dataUrl) => {
          console.log('[VerificationQR] QR generated successfully');
          setQrDataUrl(dataUrl);
        })
        .catch((error) => {
          console.error('[VerificationQR] QR generation failed', error);
          toast({
            title: 'QR Generation Failed',
            description: error instanceof Error ? error.message : 'Unable to generate QR code. Please try again.',
            variant: 'destructive',
          });
        })
        .finally(() => setIsGenerating(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, naddr, verificationKeyPair.nsec, qrType, verificationUrl]); // Only depend on values that should trigger regeneration

  const handleQrTypeChange = (type: 'full' | 'cutout' | 'micro') => {
    setQrType(type);
  };

  const handleDownload = () => {
    if (qrDataUrl) {
      const safeCacheName = cacheName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      const filename = `${safeCacheName}-${naddr}-verification-qr-${qrType}.png`;
      downloadQRCode(qrDataUrl, filename);
      toast({
        title: 'QR Code Downloaded',
        description: 'The verification QR code has been saved to your downloads.',
      });
    }
  };



  const handlePrint = () => {
    if (qrDataUrl) {
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(`
          <html>
            <head>
              <title>Print QR Code</title>
              <style>
                @page { size: auto;  margin: 0mm; }
                body { margin: 0; display: flex; justify-content: center; align-items: center; height: 100vh; }
                img { max-width: 100%; max-height: 100%; object-fit: contain; }
              </style>
            </head>
            <body onload="window.print(); setTimeout(function() { window.close(); }, 100);">
              <img src="${qrDataUrl}" alt="Verification QR Code" />
            </body>
          </html>
        `);
        printWindow.document.close();
      } else {
        toast({
          title: 'Print Failed',
          description: 'Could not open print window. Please check your browser settings.',
          variant: 'destructive',
        });
      }
    }
  };

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
              <div className="w-full flex items-center justify-center bg-muted rounded">
                <ComponentLoading 
                  size="sm" 
                  title="Generating QR code..." 
                />
              </div>
            ) : qrDataUrl ? (
              <img 
                src={qrDataUrl} 
                alt="Verification QR Code" 
                className="rounded max-w-full overflow-hidden h-[150px] xs:h-full object-contain"
              />
            ) : (
              <div className="w-48 h-48 sm:w-64 sm:h-64 flex items-center justify-center bg-muted rounded">
                <p className="text-xs sm:text-sm text-muted-foreground text-center px-2">Failed to generate QR code</p>
              </div>
            )}
          </div>

          <div className="flex justify-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="text-sm"
                >
                  Style
                  <ChevronDown className="h-4 w-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => handleQrTypeChange('full')}>
                  Full
                  <span className="text-xs text-muted-foreground ml-2">(Default) Full size QR code</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleQrTypeChange('cutout')}>
                  Cutout
                  <span className="text-xs text-muted-foreground ml-2">Smaller QR code with cut lines</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleQrTypeChange('micro')}>
                  Micro
                  <span className="text-xs text-muted-foreground ml-2">Log entry list for micro caches</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              onClick={handleDownload}
              disabled={!qrDataUrl}
              className="text-sm"
            >
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
            <Button
              onClick={handlePrint}
              disabled={!qrDataUrl}
              variant="outline"
              className="text-sm"
            >
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
            
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
              Direct link to the verification form for this cache. This URL contains the private verification key. Do not share it publicly.
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