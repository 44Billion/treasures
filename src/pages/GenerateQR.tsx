import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { QrCode, Download, Copy, ChevronDown, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  generateQRGridImage,
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
  const [searchParams] = useSearchParams();

  const [cacheName, setCacheName] = useState<string>('');
  const [verificationKeyPair, setVerificationKeyPair] = useState<VerificationKeyPair | null>(null);
  const [naddr, setNaddr] = useState<string>('');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [qrType, setQrType] = useState<'full' | 'cutout' | 'micro' | 'sheet'>('full');
  const [sheetData, setSheetData] = useState<{name: string, naddr: string, keyPair: VerificationKeyPair}[]>([]);

  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (!user) return;

    const generateInitialQR = async () => {
      const customName = searchParams.get('name');
      const finalCacheName = customName?.trim() || uniqueNamesGenerator(customConfig);
      const dTag = generateDeterministicDTag(finalCacheName, user.pubkey);
      const naddr = geocacheToNaddr(user.pubkey, dTag);
      const keyPair = await generateVerificationKeyPair();
      setCacheName(finalCacheName);
      setNaddr(naddr);
      setVerificationKeyPair(keyPair);
      const dataUrl = await generateVerificationQR(naddr, keyPair.nsec, 'full');
      setQrDataUrl(dataUrl);
    };

    generateInitialQR();
  }, [user, searchParams]);


  const generateQR = useCallback(async () => {
    if (!user) return;

    setIsGenerating(true);
    try {
      if (qrType === 'sheet') {
        const dataPromises = [];
        for (let i = 0; i < 9; i++) {
          const name = uniqueNamesGenerator(customConfig);
          const dTag = generateDeterministicDTag(name, user.pubkey);
          const naddr = geocacheToNaddr(user.pubkey, dTag);
          dataPromises.push(generateVerificationKeyPair().then(keyPair => ({name, naddr, keyPair})));
        }
        const data = await Promise.all(dataPromises);
        setSheetData(data);
        const gridUrl = await generateQRGridImage(data);
        setQrDataUrl(gridUrl);
      } else {
        setSheetData([]);
        const dataUrl = await generateVerificationQR(naddr, verificationKeyPair!.nsec, qrType);
        setQrDataUrl(dataUrl);
      }
    } catch (error) {
      toast({
        title: "QR Generation Failed",
        description: error instanceof Error ? error.message : "Failed to generate QR code",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  }, [user, qrType, toast, naddr, verificationKeyPair]);

  const handlePrint = () => {
    if (qrDataUrl) {
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      document.body.appendChild(iframe);
      iframe.contentDocument?.write(`<img src="${qrDataUrl}" onload="window.print();setTimeout(() => document.body.removeChild(iframe), 100)" />`);
      iframe.contentDocument?.close();
    }
  };

  const handleDownloadQR = () => {
    if (qrDataUrl) {
      const safeCacheName = cacheName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      const filename = qrType === 'sheet' ? `${safeCacheName}-qr-sheet.png` : `${safeCacheName}-qr-code.png`;
      downloadQRCode(qrDataUrl, filename);
      toast({
        title: "QR Code Downloaded",
        description: "The QR code has been saved to your downloads.",
      });
    }
  };

  useEffect(() => {
    if (naddr && verificationKeyPair) {
      generateQR();
    }
  }, [qrType, naddr, verificationKeyPair, generateQR]);

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
    <PageLayout maxWidth="lg" background="default" className="pb-4">
      <div className="max-w-md mx-auto text-center space-y-4">
        <div>
          <h1 className="text-foreground text-2xl font-bold flex items-center justify-center gap-2">
            <QrCode className="text-foreground h-8 w-8" />
            Generate QR Code
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            Create a QR code that links to the treasure claim page. Just enter a name 
            and get a QR code you can print and place with your cache.
          </p>
        </div>

        <div className="space-y-4">
          <div className="flex justify-center p-4 bg-white rounded-lg border shadow-sm">
            {isGenerating ? (
              <div className="w-64 h-64 flex items-center justify-center bg-muted rounded">
                <ComponentLoading size="sm" title="Generating..." />
              </div>
            ) : qrDataUrl ? (
              <img 
                src={qrDataUrl} 
                alt="Verification QR Code" 
                className="w-full h-auto rounded max-w-xs object-contain"
              />
            ) : (
              <div className="w-64 h-64 flex items-center justify-center bg-muted rounded">
                <p className="text-sm text-muted-foreground text-center">QR code will appear here</p>
              </div>
            )}
          </div>
          <div className="flex justify-center gap-2 flex-wrap">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  Style
                  <ChevronDown className="h-4 w-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => setQrType('full')}>Full</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setQrType('cutout')}>Cutout</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setQrType('micro')}>Micro</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setQrType('sheet')}>Sheet (3x3)</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button onClick={handleDownloadQR} disabled={!qrDataUrl}>
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
            <Button variant="outline" onClick={handlePrint} disabled={!qrDataUrl}>
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
          </div>
        </div>

        <div className="space-y-4 text-left">
          {qrType === 'sheet' ? (
            <div>
              <h2 className="text-foreground text-lg font-semibold">Generated Caches (Sheet)</h2>
              <p className="text-sm text-muted-foreground mb-4">A 3x3 grid of unique QR codes has been generated.</p>
              <ul className="space-y-2">
                {sheetData.map((data, index) => (
                  <li key={index} className="flex items-center justify-between gap-2 p-2 border rounded-md bg-muted/50">
                    <span className="text-foreground font-mono text-sm">{data.name}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={async () => {
                        try {
                          const claimUrl = `https://treasures.to/${data.naddr}#verify=${data.keyPair.nsec}`;
                          await navigator.clipboard.writeText(claimUrl);
                          toast({ title: "Claim URL copied" });
                        } catch (error) {
                          toast({ title: "Failed to copy", variant: "destructive" });
                        }
                      }}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <h2 className="text-foreground text-lg font-semibold">Generated Cache Details</h2>
                <p className="text-sm text-muted-foreground">This is the information for the generated QR code.</p>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-muted-foreground">Cache Name</label>
                <p className="text-foreground font-mono p-2 border rounded-md text-sm bg-muted/50">{cacheName}</p>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-muted-foreground">Claim URL</label>
                <div className="flex items-center gap-2">
                  <code className="text-foreground bg-muted/50 px-2 py-1 rounded-md text-xs break-all flex-1 overflow-x-auto whitespace-nowrap">
                    https://treasures.to/{naddr}#verify={verificationKeyPair?.nsec}
                  </code>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={async () => {
                      try {
                        const claimUrl = `https://treasures.to/${naddr}#verify=${verificationKeyPair?.nsec}`;
                        await navigator.clipboard.writeText(claimUrl);
                        toast({ title: "Claim URL copied" });
                      } catch (error) {
                        toast({ title: "Failed to copy", variant: "destructive" });
                      }
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </PageLayout>
  );
}
