import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { QrCode, Download, Printer, Settings, Gift, Edit, ArrowRight, MoreVertical } from "lucide-react";
import { Chest } from "@/config/cacheIconConstants";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DesktopHeader } from "@/components/DesktopHeader";
import { PageHero } from "@/components/PageHero";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { LoginRequiredCard } from "@/components/LoginRequiredCard";
import { useToast } from "@/hooks/useToast";
import {
  generateVerificationKeyPair,
  generateVerificationQR,
  buildStandardVerificationUrl,
  downloadQRCode,
  generateQRGridImage,
  generateQRStampImage,
  type VerificationKeyPair,
} from "@/utils/verification";
import { geocacheToNaddr } from "@/utils/naddr-utils";
import { generateDeterministicDTag } from "@/utils/dTag";
import { nip19 } from 'nostr-tools';
import { ComponentLoading } from "@/components/ui/loading";
import {
  uniqueNamesGenerator,
  Config,
  adjectives,
  colors,
  animals,
} from "unique-names-generator";
import { CompactUrlGeneratorDialog } from "@/components/CompactUrlGeneratorDialog";

const customConfig: Config = {
  dictionaries: [adjectives, colors, animals],
  separator: "-",
  length: 3,
};

type QrStyle = "full" | "cutout" | "micro" | "sheet" | "stamp";

const QR_STYLES: { value: QrStyle; label: string; description: string }[] = [
  { value: "full", label: "Full", description: "Standard size with branding" },
  { value: "cutout", label: "Cutout", description: "Center cutout for custom labels" },
  { value: "micro", label: "Micro", description: "Compact — fits in small containers" },
  { value: "sheet", label: "Sheet (9)", description: "Print 9 at once for multiple hides" },
];

export default function CreateCacheLanding() {
  const { t } = useTranslation();
  const { user } = useCurrentUser();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [cacheName, setCacheName] = useState<string>("");
  const [verificationKeyPair, setVerificationKeyPair] =
    useState<VerificationKeyPair | null>(null);
  const [naddr, setNaddr] = useState<string>("");
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [qrType, setQrType] = useState<QrStyle>("full");

  const [showCompactDialog, setShowCompactDialog] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [customNpub, setCustomNpub] = useState<string>("");
  const [submittedNpub, setSubmittedNpub] = useState<string>("");
  const [npubError, setNpubError] = useState<string>("");

  const isBulkType = qrType === 'sheet' || qrType === 'stamp';

  const validateNpub = (npub: string): boolean => {
    try {
      const decoded = nip19.decode(npub);
      return decoded.type === 'npub';
    } catch {
      return false;
    }
  };

  const getPubkeyForNaddr = useCallback((): string => {
    if (submittedNpub && validateNpub(submittedNpub)) {
      const decoded = nip19.decode(submittedNpub);
      return decoded.data as string;
    }
    return user?.pubkey || '';
  }, [submittedNpub, user?.pubkey]);

  const generateQR = useCallback(async () => {
    if (!user || !verificationKeyPair) return;

    try {
      const targetPubkey = getPubkeyForNaddr();

      if (qrType === 'sheet') {
        const dataPromises: Promise<{name: string, naddr: string, keyPair: VerificationKeyPair}>[] = [];
        for (let i = 0; i < 9; i++) {
          const name = uniqueNamesGenerator(customConfig);
          const dTag = generateDeterministicDTag(name, targetPubkey);
          const naddr = geocacheToNaddr(targetPubkey, dTag);
          dataPromises.push(generateVerificationKeyPair().then(keyPair => ({name, naddr, keyPair})));
        }
        const data = await Promise.all(dataPromises);
        const gridUrl = await generateQRGridImage(data, {
          line1: t('qrCode.foundTreasure'),
          line2: t('qrCode.scanToLog')
        });
        setQrDataUrl(gridUrl);
      } else if (qrType === 'stamp') {
        const dataPromises: Promise<{name: string, naddr: string, keyPair: VerificationKeyPair}>[] = [];
        for (let i = 0; i < 42; i++) {
          const name = uniqueNamesGenerator(customConfig);
          const dTag = generateDeterministicDTag(name, targetPubkey);
          const naddr = geocacheToNaddr(targetPubkey, dTag);
          dataPromises.push(generateVerificationKeyPair().then(keyPair => ({name, naddr, keyPair})));
        }
        const data = await Promise.all(dataPromises);
        const stampUrl = await generateQRStampImage(data, {
          line1: t('qrCode.foundTreasure'),
          line2: t('qrCode.scanToLog')
        });
        setQrDataUrl(stampUrl);
      } else {
        const verificationUrl = buildStandardVerificationUrl(naddr, verificationKeyPair.nsec);
        const dataUrl = await generateVerificationQR(verificationUrl, qrType, {
          line1: t('qrCode.foundTreasure'),
          line2: t('qrCode.scanToLog')
        });
        setQrDataUrl(dataUrl);
      }
    } catch (error) {
      toast({
        title: t('createCache.verificationQR.generationFailed'),
        description:
          error instanceof Error ? error.message : t('createCache.verificationQR.generationFailedDescription'),
        variant: "destructive",
      });
    }
  }, [user, qrType, toast, naddr, verificationKeyPair, getPubkeyForNaddr, t]);

  useEffect(() => {
    if (!user) return;

    const generateInitialQR = async () => {
      const finalCacheName = uniqueNamesGenerator(customConfig);
      const targetPubkey = getPubkeyForNaddr();
      const dTag = generateDeterministicDTag(finalCacheName, targetPubkey);
      const naddr = geocacheToNaddr(targetPubkey, dTag);
      const keyPair = await generateVerificationKeyPair();
      setCacheName(finalCacheName);
      setNaddr(naddr);
      setVerificationKeyPair(keyPair);
    };

    generateInitialQR();
  }, [user, submittedNpub, getPubkeyForNaddr]);

  useEffect(() => {
    if (naddr && verificationKeyPair) {
      generateQR();
    }
  }, [qrType, naddr, verificationKeyPair, generateQR]);

  const handleDownloadQR = () => {
    if (qrDataUrl) {
      const safeCacheName = cacheName
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "");
      let filename = `${safeCacheName}-qr-code.png`;
      if (qrType === 'sheet') {
        filename = `${safeCacheName}-qr-sheet.png`;
      } else if (qrType === 'stamp') {
        filename = `${safeCacheName}-qr-stamp.png`;
      }
      downloadQRCode(qrDataUrl, filename);
      toast({
        title: t('createCache.verificationQR.downloaded'),
        description: t('createCache.verificationQR.downloadedDescription'),
      });
    }
  };

  const handlePrint = () => {
    if (qrDataUrl) {
      const iframe = document.createElement("iframe");
      iframe.style.display = "none";
      document.body.appendChild(iframe);
      iframe.contentDocument?.write(
        `<img src="${qrDataUrl}" onload="window.print();setTimeout(() => document.body.removeChild(iframe), 100)" />`
      );
      iframe.contentDocument?.close();
    }
  };

  const handleFillOutNow = () => {
    if (verificationKeyPair) {
      const claimUrl = `https://treasures.to/${naddr}#verify=${verificationKeyPair.nsec}`;
      const params = new URLSearchParams();
      params.set('claimUrl', claimUrl);
      if (customNpub && validateNpub(customNpub)) {
        params.set('giftNpub', customNpub);
      }
      navigate(`/create-cache?${params.toString()}`);
    }
  };

  if (!user) {
    return (
      <>
        <DesktopHeader />
        <PageHero icon={Chest} title={t('createCache.title')} description={t('createCache.subtitle')}>
          <div className="container mx-auto px-4 py-10 max-w-md">
            <LoginRequiredCard
              icon={QrCode}
              description={t('createCache.loginRequired')}
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

      <PageHero icon={Chest} title={t('createCache.title')} description={t('createCache.subtitle')}>
        <div className="container mx-auto px-4 max-w-md pb-12">
          {/* Single unified card */}
          <div className="rounded-xl border bg-card p-5 md:p-6 mb-6">

            {/* 1. QR Preview */}
            <div className="text-center mb-5">
              <div className="flex items-center justify-center gap-2 mb-1">
                <QrCode className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold text-foreground">{t('createCache.verificationQR.title')}</h2>
              </div>
              <p className="text-xs text-muted-foreground mb-4">
                {t('createCache.verificationQR.description').split('\n').map((line, i) => (
                  <span key={i}>
                    {line}
                    {i < t('createCache.verificationQR.description').split('\n').length - 1 && <br />}
                  </span>
                ))}
              </p>

              <div className="flex justify-center mb-4">
                {qrDataUrl ? (
                  <div className="bg-white p-3 rounded-lg inline-block">
                    <img
                      src={qrDataUrl}
                      alt="Verification QR Code"
                      className="w-52 h-auto rounded object-contain"
                    />
                  </div>
                ) : (
                  <div className="w-48 h-48 flex items-center justify-center bg-muted/30 rounded-lg">
                    <ComponentLoading size="sm" title={t('createCache.verificationQR.generating')} />
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
                    <DropdownMenuItem onClick={() => setShowCompactDialog(true)}>
                      <span className="text-primary font-medium">Compact URLs</span>
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

            {/* 3. Primary actions: Save + Print */}
            <div className="flex gap-2 justify-center mb-5">
              <Button onClick={handleDownloadQR} disabled={!qrDataUrl} className="flex-1 max-w-[160px]">
                <Download className="h-4 w-4 mr-1.5" />
                {t('createCache.verificationQR.save')}
              </Button>
              <Button variant="outline" onClick={handlePrint} disabled={!qrDataUrl} className="flex-1 max-w-[160px]">
                <Printer className="h-4 w-4 mr-1.5" />
                Print
              </Button>
            </div>

            {/* 4. Divider */}
            <div className="border-t my-5" />

            {/* 5. Create listing CTA - always visible, messaging adapts */}
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <Chest className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">{t('createCache.listing.title')}</h3>
              </div>

              <p className="text-xs text-muted-foreground mb-3">
                {isBulkType
                  ? (qrType === 'sheet' ? t('createCache.listing.sheetDescription') : t('createCache.listing.stampDescription'))
                  : t('createCache.listing.description')
                }
              </p>

              <div className="flex gap-2 justify-center flex-wrap">
                {!isBulkType && (
                  <Button variant="outline" onClick={handleFillOutNow} disabled={!qrDataUrl} size="sm">
                    <Edit className="h-3.5 w-3.5 mr-1.5" />
                    {t('createCache.listing.createNow')}
                  </Button>
                )}
                <Button variant="ghost" onClick={() => navigate("/")} size="sm">
                  {t('createCache.listing.later')}
                  <ArrowRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              </div>
            </div>

          </div>

          {/* Advanced Options */}
          {showAdvanced && (
            <div className="rounded-xl border bg-card p-5 md:p-6 mb-6">
              <div className="flex items-center gap-2 mb-3">
                <Gift className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">{t('createCache.gift.title')}</span>
              </div>
              <input
                type="text"
                placeholder={t('createCache.gift.placeholder')}
                value={customNpub}
                onChange={(e) => {
                  const value = e.target.value;
                  setCustomNpub(value);
                  if (value && !validateNpub(value)) {
                    setNpubError(t('createCache.gift.invalidNpub'));
                  } else {
                    setNpubError("");
                  }
                }}
                className="w-full px-3 py-2 text-sm border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              {npubError && <p className="text-xs text-destructive mt-1">{npubError}</p>}
              {customNpub && !npubError && (
                <Button
                  size="sm"
                  onClick={async () => {
                    setSubmittedNpub(customNpub);
                    toast({ title: t('createCache.gift.updated'), description: t('createCache.gift.updatedDescription') });
                  }}
                  className="w-full mt-2"
                >
                  <Gift className="h-4 w-4 mr-1" />
                  {t('createCache.gift.createQR')}
                </Button>
              )}
            </div>
          )}

          <div className="flex justify-center pb-8">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-xs text-white/60 hover:text-white hover:bg-white/10 adventure:text-stone-500 adventure:hover:text-stone-800 adventure:hover:bg-stone-700/10 adventure:dark:text-white/60 adventure:dark:hover:text-white"
            >
              <Settings className="h-3 w-3 mr-1" />
              {showAdvanced ? t('common.hide') : t('common.show')} {t('createCache.advanced')}
            </Button>
          </div>

          {user && (
            <CompactUrlGeneratorDialog
              open={showCompactDialog}
              onOpenChange={setShowCompactDialog}
              pubkey={getPubkeyForNaddr()}
            />
          )}
        </div>
      </PageHero>
    </>
  );
}
