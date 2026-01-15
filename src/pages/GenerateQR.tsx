import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
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
  type VerificationKeyPair,
  buildStandardVerificationUrl
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
  const { t } = useTranslation();
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
      const verificationUrl = buildStandardVerificationUrl(naddr, keyPair.nsec);
      const dataUrl = await generateVerificationQR(verificationUrl, 'full', {
        line1: t('qrCode.foundTreasure'),
        line2: t('qrCode.scanToLog')
      });
      setQrDataUrl(dataUrl);
    };

    generateInitialQR();
  }, [user, searchParams, t]);


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
        const gridUrl = await generateQRGridImage(data, {
          line1: t('qrCode.foundTreasure'),
          line2: t('qrCode.scanToLog')
        });
        setQrDataUrl(gridUrl);
      } else {
        setSheetData([]);
        const verificationUrl = buildStandardVerificationUrl(naddr, verificationKeyPair!.nsec);
        const dataUrl = await generateVerificationQR(verificationUrl, qrType, {
          line1: t('qrCode.foundTreasure'),
          line2: t('qrCode.scanToLog')
        });
        setQrDataUrl(dataUrl);
      }
    } catch (error) {
      toast({
        title: t('generateQR.toast.generationFailed.title'),
        description: error instanceof Error ? error.message : t('generateQR.toast.generationFailed.description'),
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  }, [user, qrType, toast, naddr, verificationKeyPair, t]);

  const handlePrint = () => {
    if (qrDataUrl) {
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      document.body.appendChild(iframe);

      const iframeDoc = iframe.contentDocument;
      if (!iframeDoc) return;

      // Detect if this is a grid (sheet) type
      const isGrid = qrType === 'sheet';

      // Detect mobile for adjusted margins
      const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      const gridMargin = isMobile ? '0.4in' : '0.25in';

      // Write proper HTML with print styles for mobile compatibility
      iframeDoc.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            @page {
              size: ${isGrid ? 'letter portrait' : 'auto'};
              margin: ${isGrid ? gridMargin : '0.5cm'};
            }
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            html, body {
              width: 100%;
              height: 100%;
              display: flex;
              align-items: center;
              justify-content: center;
              background: white;
            }
            img {
              max-width: 100%;
              max-height: ${isGrid ? '100%' : '100vh'};
              width: ${isGrid ? (isMobile ? '95%' : '100%') : 'auto'};
              height: auto;
              display: block;
              object-fit: contain;
              page-break-inside: avoid;
              margin: 0 auto;
            }
            @media print {
              html, body {
                width: 100%;
                height: 100%;
                overflow: hidden;
              }
              img {
                max-width: 100% !important;
                max-height: ${isGrid ? '100%' : '100vh'} !important;
                width: ${isGrid ? (isMobile ? '95%' : '100%') : 'auto'} !important;
                height: auto !important;
                object-fit: contain !important;
                page-break-inside: avoid !important;
                margin: 0 auto !important;
              }
            }
          </style>
        </head>
        <body>
          <img src="${qrDataUrl}" onload="window.print(); setTimeout(() => window.parent.document.body.removeChild(window.frameElement), 500)" />
        </body>
        </html>
      `);
      iframeDoc.close();
    }
  };

  const handleDownloadQR = () => {
    if (qrDataUrl) {
      const safeCacheName = cacheName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      const filename = qrType === 'sheet' ? `${safeCacheName}-qr-sheet.png` : `${safeCacheName}-qr-code.png`;
      downloadQRCode(qrDataUrl, filename);
      toast({
        title: t('generateQR.toast.downloaded.title'),
        description: t('generateQR.toast.downloaded.description'),
      });
    }
  };

  useEffect(() => {
    if (naddr && verificationKeyPair) {
      generateQR();
    }
  }, [qrType, naddr, verificationKeyPair, generateQR]);

  // Additional effect to handle QR type changes more robustly
  useEffect(() => {
    if (qrType && naddr && verificationKeyPair && qrDataUrl) {
      // Clear current QR code immediately to show loading state
      setQrDataUrl('');
      setIsGenerating(true);

      // Small delay to ensure state updates are processed
      setTimeout(() => {
        generateQR();
      }, 100);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qrType]); // Only trigger on qrType changes

  if (!user) {
    return (
      <PageLayout maxWidth="md" className="py-16">
        <LoginRequiredCard
          icon={QrCode}
          description={t('generateQR.loginRequired')}
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
            {t('generateQR.title')}
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            {t('generateQR.description')}
          </p>
        </div>

        <div className="space-y-4">
          <div className="flex justify-center p-4 bg-white rounded-lg border shadow-sm">
            {isGenerating ? (
              <div className="w-64 h-64 flex items-center justify-center bg-muted rounded">
                <ComponentLoading size="sm" title={t('generateQR.generating')} />
              </div>
            ) : qrDataUrl ? (
              <img 
                src={qrDataUrl} 
                alt={t('generateQR.qrCodeAlt')} 
                className="w-full h-auto rounded max-w-xs object-contain"
              />
            ) : (
              <div className="w-64 h-64 flex items-center justify-center bg-muted rounded">
                <p className="text-sm text-muted-foreground text-center">{t('generateQR.placeholder')}</p>
              </div>
            )}
          </div>
          <div className="flex justify-center gap-2 flex-wrap">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  {t('generateQR.style')}
                  <ChevronDown className="h-4 w-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => setQrType('full')}>{t('generateQR.styleFull')}</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setQrType('cutout')}>{t('generateQR.styleCutout')}</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setQrType('micro')}>{t('generateQR.styleMicro')}</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setQrType('sheet')}>{t('generateQR.styleSheet')}</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button onClick={handleDownloadQR} disabled={!qrDataUrl}>
              <Download className="h-4 w-4 mr-2" />
              {t('generateQR.download')}
            </Button>
            <Button variant="outline" onClick={handlePrint} disabled={!qrDataUrl}>
              <Printer className="h-4 w-4 mr-2" />
              {t('generateQR.print')}
            </Button>
          </div>
        </div>

        <div className="space-y-4 text-left">
          {qrType === 'sheet' ? (
            <div>
              <h2 className="text-foreground text-lg font-semibold">{t('generateQR.sheet.title')}</h2>
              <p className="text-sm text-muted-foreground mb-4">{t('generateQR.sheet.description')}</p>
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
                          toast({ title: t('generateQR.toast.claimUrlCopied') });
                        } catch (error) {
                          toast({ title: t('generateQR.toast.copyFailed'), variant: "destructive" });
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
                <h2 className="text-foreground text-lg font-semibold">{t('generateQR.details.title')}</h2>
                <p className="text-sm text-muted-foreground">{t('generateQR.details.description')}</p>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-muted-foreground">{t('generateQR.details.cacheName')}</label>
                <p className="text-foreground font-mono p-2 border rounded-md text-sm bg-muted/50">{cacheName}</p>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-muted-foreground">{t('generateQR.details.claimUrl')}</label>
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
                        toast({ title: t('generateQR.toast.claimUrlCopied') });
                      } catch (error) {
                        toast({ title: t('generateQR.toast.copyFailed'), variant: "destructive" });
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
