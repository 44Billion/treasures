import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { QrCode, Download, Copy, Printer, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DesktopHeader } from "@/components/DesktopHeader";
import { PageHero } from "@/components/PageHero";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { LoginRequiredCard } from "@/components/LoginRequiredCard";
import { useToast } from "@/hooks/useToast";
import {
  generateVerificationKeyPair,
  downloadQRCode,
  generateVerificationQR,
  generateQRGridImage,
  generateQRStampImage,
  type VerificationKeyPair,
  buildStandardVerificationUrl
} from "@/utils/verification";
import { geocacheToNaddr } from "@/utils/naddr-utils";
import { generateDeterministicDTag } from "@/utils/dTag";
import { ComponentLoading } from "@/components/ui/loading";
import { uniqueNamesGenerator, Config, adjectives, colors, animals } from 'unique-names-generator';

const customConfig: Config = {
  dictionaries: [adjectives, colors, animals],
  separator: '-',
  length: 3,
};

type QrStyle = "full" | "cutout" | "micro" | "sheet" | "stamp";

const QR_STYLES: { value: QrStyle; label: string; description: string }[] = [
  { value: "full", label: "Full", description: "Standard size with branding" },
  { value: "cutout", label: "Cutout", description: "Center cutout for custom labels" },
  { value: "micro", label: "Micro", description: "Compact — fits in small containers" },
  { value: "sheet", label: "Sheet (9)", description: "Print 9 at once for multiple hides" },
];

export default function GenerateQR() {
  const { t } = useTranslation();
  const { user } = useCurrentUser();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();

  const [cacheName, setCacheName] = useState<string>('');
  const [verificationKeyPair, setVerificationKeyPair] = useState<VerificationKeyPair | null>(null);
  const [naddr, setNaddr] = useState<string>('');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [qrType, setQrType] = useState<QrStyle>('full');
  const [sheetData, setSheetData] = useState<{name: string, naddr: string, keyPair: VerificationKeyPair}[]>([]);
  const [, setStampData] = useState<{name: string, naddr: string, keyPair: VerificationKeyPair}[]>([]);

  const [isGenerating, setIsGenerating] = useState(false);

  const isBulkType = qrType === 'sheet' || qrType === 'stamp';

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
        setStampData([]);
        const gridUrl = await generateQRGridImage(data, {
          line1: t('qrCode.foundTreasure'),
          line2: t('qrCode.scanToLog')
        });
        setQrDataUrl(gridUrl);
      } else if (qrType === 'stamp') {
        const dataPromises = [];
        for (let i = 0; i < 42; i++) {
          const name = uniqueNamesGenerator(customConfig);
          const dTag = generateDeterministicDTag(name, user.pubkey);
          const naddr = geocacheToNaddr(user.pubkey, dTag);
          dataPromises.push(generateVerificationKeyPair().then(keyPair => ({name, naddr, keyPair})));
        }
        const data = await Promise.all(dataPromises);
        setStampData(data);
        setSheetData([]);
        const stampUrl = await generateQRStampImage(data, {
          line1: t('qrCode.foundTreasure'),
          line2: t('qrCode.scanToLog')
        });
        setQrDataUrl(stampUrl);
      } else {
        setSheetData([]);
        setStampData([]);
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

      const isGrid = qrType === 'sheet' || qrType === 'stamp';
      const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      const gridMargin = isMobile ? '0.4in' : '0.25in';

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
      let filename = `${safeCacheName}-qr-code.png`;
      if (qrType === 'sheet') {
        filename = `${safeCacheName}-qr-sheet.png`;
      } else if (qrType === 'stamp') {
        filename = `${safeCacheName}-qr-stamp.png`;
      }
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
      setQrDataUrl('');
      setIsGenerating(true);

      setTimeout(() => {
        generateQR();
      }, 100);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qrType]);

  if (!user) {
    return (
      <>
        <DesktopHeader />
        <PageHero icon={QrCode} title={t('generateQR.title')} description={t('generateQR.description')}>
          <div className="container mx-auto px-4 py-10 max-w-md">
            <LoginRequiredCard
              icon={QrCode}
              description={t('generateQR.loginRequired')}
              className="max-w-md mx-auto"
            />
          </div>
        </PageHero>
      </>
    );
  }

  return (
    <>
      <DesktopHeader />

      <PageHero icon={QrCode} title={t('generateQR.title')} description={t('generateQR.description')}>
        <div className="container mx-auto px-4 max-w-md pb-12">
          {/* Single unified card */}
          <div className="rounded-xl border bg-card p-5 md:p-6 mb-6">

            {/* 1. QR Preview */}
            <div className="text-center mb-5">
              <div className="flex items-center justify-center gap-2 mb-1">
                <QrCode className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold text-foreground">{t('generateQR.preview.heading')}</h2>
              </div>

              <div className="flex justify-center mb-4 mt-3">
                {isGenerating ? (
                  <div className="w-48 h-48 flex items-center justify-center bg-muted/30 rounded-lg">
                    <ComponentLoading size="sm" title={t('generateQR.generating')} />
                  </div>
                ) : qrDataUrl ? (
                  <div className="bg-white p-3 rounded-lg inline-block">
                    <img
                      src={qrDataUrl}
                      alt={t('generateQR.qrCodeAlt')}
                      className="w-52 h-auto rounded object-contain"
                    />
                  </div>
                ) : (
                  <div className="w-48 h-48 flex items-center justify-center bg-muted/30 rounded-lg">
                    <p className="text-sm text-muted-foreground text-center">{t('generateQR.placeholder')}</p>
                  </div>
                )}
              </div>
            </div>

            {/* 2. Style pills with overflow menu */}
            <div className="mb-5">
              <p className="text-xs text-muted-foreground mb-2 text-center">Style</p>
              <div className="flex flex-wrap gap-1.5 justify-center items-center">
                {QR_STYLES.map((style) => (
                  <button
                    key={style.value}
                    type="button"
                    onClick={() => setQrType(style.value)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                      qrType === style.value
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                  >
                    {style.label}
                  </button>
                ))}
                {/* Overflow menu for less common options */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className={`px-2 py-1.5 rounded-full text-xs font-medium transition-all ${
                        qrType === 'stamp'
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                      }`}
                    >
                      <MoreVertical className="h-3.5 w-3.5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setQrType("stamp")}>
                      Stamp (42) — bulk print grid
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              {/* Description of selected style */}
              <p className="text-[11px] text-muted-foreground text-center mt-1.5">
                {qrType === 'stamp'
                  ? '6×7 grid for bulk hiding'
                  : QR_STYLES.find(s => s.value === qrType)?.description}
              </p>
            </div>

            {/* 3. Primary actions: Download + Print */}
            <div className="flex gap-2 justify-center mb-5">
              <Button onClick={handleDownloadQR} disabled={!qrDataUrl} className="flex-1 max-w-[160px]">
                <Download className="h-4 w-4 mr-1.5" />
                {t('generateQR.download')}
              </Button>
              <Button variant="outline" onClick={handlePrint} disabled={!qrDataUrl} className="flex-1 max-w-[160px]">
                <Printer className="h-4 w-4 mr-1.5" />
                {t('generateQR.print')}
              </Button>
            </div>

            {/* 4. Details section */}
            <div className="border-t pt-5">
              {qrType === 'sheet' ? (
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-1">{t('generateQR.sheet.title')}</h3>
                  <p className="text-xs text-muted-foreground mb-3">{t('generateQR.sheet.description')}</p>
                  <ul className="space-y-1.5">
                    {sheetData.map((data, index) => (
                      <li key={index} className="flex items-center justify-between gap-2 p-2 border rounded-lg bg-muted/30">
                        <span className="text-foreground font-mono text-xs truncate">{data.name}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="flex-shrink-0 h-7 w-7"
                          onClick={async () => {
                            try {
                              const claimUrl = `https://treasures.to/${data.naddr}#verify=${data.keyPair.nsec}`;
                              await navigator.clipboard.writeText(claimUrl);
                              toast({ title: t('generateQR.toast.claimUrlCopied') });
                            } catch {
                              toast({ title: t('generateQR.toast.copyFailed'), variant: "destructive" });
                            }
                          }}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : isBulkType ? (
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-1">{t('generateQR.stamp.title')}</h3>
                  <p className="text-xs text-muted-foreground">{t('generateQR.stamp.description')}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground mb-1">{t('generateQR.details.title')}</h3>
                    <p className="text-xs text-muted-foreground">{t('generateQR.details.description')}</p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">{t('generateQR.details.cacheName')}</label>
                    <p className="text-foreground font-mono p-2 border rounded-lg text-sm bg-muted/30">{cacheName}</p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">{t('generateQR.details.claimUrl')}</label>
                    <div className="flex items-center gap-2">
                      <code className="text-foreground bg-muted/30 px-2 py-1.5 rounded-lg text-xs break-all flex-1 overflow-x-auto whitespace-nowrap border">
                        https://treasures.to/{naddr}#verify={verificationKeyPair?.nsec}
                      </code>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="flex-shrink-0 h-7 w-7"
                        onClick={async () => {
                          try {
                            const claimUrl = `https://treasures.to/${naddr}#verify=${verificationKeyPair?.nsec}`;
                            await navigator.clipboard.writeText(claimUrl);
                            toast({ title: t('generateQR.toast.claimUrlCopied') });
                          } catch {
                            toast({ title: t('generateQR.toast.copyFailed'), variant: "destructive" });
                          }
                        }}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </PageHero>
    </>
  );
}
