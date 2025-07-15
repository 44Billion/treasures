import { useState, useEffect, useCallback } from "react";
import { QrCode, Download, Copy, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PageLayout } from "@/components/layout";
import { useCurrentUser } from "@/features/auth/hooks/useCurrentUser";
import { LoginRequiredCard } from "@/components/LoginRequiredCard";
import { useToast } from "@/shared/hooks/useToast";
import { 
  generateVerificationKeyPair, 
  downloadQRCode,
  generateVerificationQR,
  type VerificationKeyPair 
} from "@/features/geocache/utils/verification";
import { geocacheToNaddr } from "@/shared/utils/naddr-utils";
import { generateDeterministicDTag } from "@/features/geocache/utils/dTag";
import { ComponentLoading } from "@/components/ui/loading";
import { uniqueNamesGenerator, Config, adjectives, colors, animals } from 'unique-names-generator';

const customConfig: Config = {
  dictionaries: [adjectives, colors, animals],
  separator: '-',
  length: 3,
};

export default function GenerateQR() {
  const { user } = useCurrentUser();
  const { toast } = useToast();

  const [cacheName, setCacheName] = useState<string>('');
  const [verificationKeyPair, setVerificationKeyPair] = useState<VerificationKeyPair | null>(null);
  const [naddr, setNaddr] = useState<string>('');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [qrType, setQrType] = useState<'full' | 'cutout' | 'micro'>('full');

  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (!user) return;

    const generateMockEvent = async () => {
      const finalCacheName = uniqueNamesGenerator(customConfig);

      try {
        // Generate verification keypair
        const keyPair = await generateVerificationKeyPair();
        setVerificationKeyPair(keyPair);

        // Create a deterministic dTag based on cache name and user pubkey
        // This ensures the same naddr will be generated when the actual cache is created
        const dTag = generateDeterministicDTag(finalCacheName, user.pubkey);

        // Generate naddr for the mock event
        const mockNaddr = geocacheToNaddr(user.pubkey, dTag);
        setNaddr(mockNaddr);
        setCacheName(finalCacheName);

        toast({
          title: "QR Code Generated",
          description: "Your QR code is ready for download.",
        });
      } catch (error) {
        toast({
          title: "Generation Failed",
          description: error instanceof Error ? error.message : "Failed to generate QR code",
          variant: "destructive",
        });
      }
    };

    generateMockEvent();
  }, [user, toast]);


  const generateQR = useCallback(async () => {
    if (!naddr || !verificationKeyPair) return;

    setIsGenerating(true);
    try {
      const dataUrl = await generateVerificationQR(naddr, verificationKeyPair.nsec, qrType);
      setQrDataUrl(dataUrl);
    } catch (error) {
      toast({
        title: "QR Generation Failed",
        description: error instanceof Error ? error.message : "Failed to generate QR code",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  }, [naddr, verificationKeyPair, qrType, toast]);

  const handleDownloadQR = () => {
    if (qrDataUrl) {
      const safeCacheName = cacheName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      const filename = `${safeCacheName}-qr-code.png`;
      downloadQRCode(qrDataUrl, filename);
      toast({
        title: "QR Code Downloaded",
        description: "The QR code has been saved to your downloads.",
      });
    }
  };

  // Generate QR when data is ready
  useEffect(() => {
    if (naddr && verificationKeyPair) {
      generateQR();
    }
  }, [naddr, verificationKeyPair, generateQR]);

  if (!user) {
    return (
      <PageLayout maxWidth="md" className="py-16">
        <LoginRequiredCard
          icon={QrCode}
          description="You need to be logged in to generate QR codes for geocaches."
          className="max-w-md mx-auto"
        />
      </PageLayout>
    );
  }

  return (
    <PageLayout maxWidth="2xl" background="default" className="pb-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <QrCode className="h-6 w-6" />
              Generate QR Code in Advance
            </CardTitle>
            <CardDescription>
              Create a QR code that links to the treasure claim page. Just enter a name 
              and get a QR code you can print and place with your cache.
            </CardDescription>
          </CardHeader>
        </Card>

        <div className="space-y-6">
          {/* QR Code Generation */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">QR Code</CardTitle>
              <CardDescription>
                Download this QR code to place with your physical cache. When scanned, it will take finders to the claim page.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* QR Code Display */}
              <div className="flex justify-center p-4 bg-white rounded-lg border">
                {isGenerating ? (
                  <div className="w-64 h-64 flex items-center justify-center bg-muted rounded">
                    <ComponentLoading size="sm" title="Generating QR code..." />
                  </div>
                ) : qrDataUrl ? (
                  <img 
                    src={qrDataUrl} 
                    alt="Verification QR Code" 
                    className="w-64 h-64 rounded max-w-full object-contain"
                  />
                ) : (
                  <div className="w-64 h-64 flex items-center justify-center bg-muted rounded">
                    <p className="text-sm text-muted-foreground text-center">QR code will appear here</p>
                  </div>
                )}
              </div>

              {/* QR Controls */}
              <div className="flex justify-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline">
                      Style
                      <ChevronDown className="h-4 w-4 ml-2" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => setQrType('full')}>
                      Full
                      <span className="text-xs text-muted-foreground ml-2">(Default) Full size QR code</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setQrType('cutout')}>
                      Cutout
                      <span className="text-xs text-muted-foreground ml-2">Smaller QR code with cut lines</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setQrType('micro')}>
                      Micro
                      <span className="text-xs text-muted-foreground ml-2">Log entry list for micro caches</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button
                  onClick={handleDownloadQR}
                  disabled={!qrDataUrl}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download QR Code
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Cache Preview */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Generated Cache: {cacheName}</CardTitle>
              <CardDescription>
                Your QR code is ready for download and placement with your physical cache.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <strong>naddr:</strong>
                  <code className="bg-muted px-2 py-1 rounded text-xs break-all flex-1">{naddr}</code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(naddr);
                        toast({ title: "naddr copied to clipboard" });
                      } catch (error) {
                        toast({ title: "Failed to copy", variant: "destructive" });
                      }
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                
                {verificationKeyPair && (
                  <div className="flex items-center gap-2 text-sm">
                    <strong>Claim URL:</strong>
                    <code className="bg-muted px-2 py-1 rounded text-xs break-all flex-1">
                      https://treasures.to/{naddr}#verify={verificationKeyPair.nsec}
                    </code>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={async () => {
                        try {
                          const claimUrl = `https://treasures.to/${naddr}#verify=${verificationKeyPair.nsec}`;
                          await navigator.clipboard.writeText(claimUrl);
                          toast({ title: "Claim URL copied to clipboard" });
                        } catch (error) {
                          toast({ title: "Failed to copy", variant: "destructive" });
                        }
                      }}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageLayout>
  );
}
