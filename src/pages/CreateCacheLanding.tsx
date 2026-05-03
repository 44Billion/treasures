import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { QrCode, Download, Printer, Settings, Gift, Edit, MoreVertical, FileText, ChevronRight, BookOpen } from "lucide-react";
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
import { useTheme } from "@/hooks/useTheme";
import { LoginRequiredCard } from "@/components/LoginRequiredCard";
import { useToast } from "@/hooks/useToast";
import {
  generateVerificationKeyPair,
  generateVerificationQR,
  buildStandardVerificationUrl,
  downloadQRCode,
  printQRCode,
  generateQRGridImage,
  generateQRStampImage,
  type VerificationKeyPair,
} from "@/utils/verification";
import { geocacheToNaddr } from "@/utils/naddr-utils";
import { generateCompactDTag } from "@/utils/dTag";
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
import { ProfileSearch } from "@/components/ProfileSearch";
import { WotAuthorCard } from "@/components/WotAuthorCard";

const customConfig: Config = {
  dictionaries: [adjectives, colors, animals],
  separator: "-",
  length: 3,
};

type QrStyle = "full" | "cutout" | "micro" | "sheet" | "stamp";

export default function CreateCacheLanding() {
  const { t } = useTranslation();

  const QR_STYLES: { value: QrStyle; label: string; description: string }[] = [
    { value: "full", label: t('createCache.verificationQR.styleFull'), description: t('createCache.verificationQR.styleFullDesc') },
    { value: "cutout", label: t('createCache.verificationQR.styleCutout'), description: t('createCache.verificationQR.styleCutoutDesc') },
    { value: "micro", label: t('createCache.verificationQR.styleMicro'), description: t('createCache.verificationQR.styleMicroDesc') },
    { value: "sheet", label: t('createCache.verificationQR.styleSheet'), description: t('createCache.verificationQR.styleSheetDesc') },
  ];

  const { user } = useCurrentUser();
  const { resolvedTheme } = useTheme();
  const isDitto = resolvedTheme === 'ditto';
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
  const [selectedPath, setSelectedPath] = useState<'qr' | null>(null);
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
          const dTag = generateCompactDTag();
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
          const dTag = generateCompactDTag();
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
      const dTag = generateCompactDTag();
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

  const handleDownloadQR = async () => {
    if (!qrDataUrl) return;
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
    try {
      await downloadQRCode(qrDataUrl, filename);
      toast({
        title: t('createCache.verificationQR.downloaded'),
        description: t('createCache.verificationQR.downloadedDescription'),
      });
    } catch (err) {
      toast({
        title: t('createCache.verificationQR.downloadFailed', 'Download Failed'),
        description: err instanceof Error ? err.message : 'Could not save the QR code.',
        variant: 'destructive',
      });
    }
  };

  const handlePrint = async () => {
    if (!qrDataUrl) return;
    try {
      await printQRCode(qrDataUrl);
    } catch (err) {
      toast({
        title: 'Print Failed',
        description: err instanceof Error ? err.message : 'Could not print the QR code.',
        variant: 'destructive',
      });
    }
  };

  const handleFillOutNow = () => {
    if (verificationKeyPair) {
      const claimUrl = `https://treasures.to/${naddr}#verify=${verificationKeyPair.nsec}`;
      const params = new URLSearchParams();
      params.set('claimUrl', claimUrl);
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
        <div className="container mx-auto px-4 max-w-md md:max-w-lg pb-12 space-y-3">

          {/* Path 1: With Verification QR */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => { if (selectedPath !== 'qr') setSelectedPath('qr'); }}
            onKeyDown={(e) => { if (e.key === 'Enter' && selectedPath !== 'qr') setSelectedPath('qr'); }}
            className={`rounded-xl border bg-card transition-all ${
              selectedPath !== 'qr' ? 'hover:border-primary/50 hover:shadow-md cursor-pointer' : ''
            }`}
          >
            {/* Clickable header area */}
            <div className="p-5 md:p-6">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 w-10 h-10 md:w-12 md:h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <QrCode className="h-5 w-5 md:h-6 md:w-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-sm md:text-base font-semibold text-foreground">{t('createCache.verificationQR.title')}</h2>
                  <p className="text-xs md:text-sm text-muted-foreground mt-0.5">{t('createCache.verificationQR.description')}</p>
                  <p className="text-xs md:text-sm font-medium text-primary mt-1.5">{t('createCache.verificationQR.finderNote')}</p>
                </div>
                {selectedPath !== 'qr' && (
                  <ChevronRight className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground flex-shrink-0" />
                )}
              </div>
            </div>

            {/* Expanded QR flow */}
            {selectedPath === 'qr' && (
              <div className="px-5 md:px-6 pb-5 md:pb-6 space-y-5" onClick={(e) => e.stopPropagation()}>
                {/* QR Preview */}
                <div className="flex justify-center">
                  {qrDataUrl ? (
                    <div className="bg-white p-3 rounded-lg inline-block shadow-sm">
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

                {/* Style pills */}
                <div>
                  <p className="text-xs text-muted-foreground mb-2 text-center">{t('createCache.verificationQR.style')}</p>
                  <div className="flex gap-1.5 justify-center items-center">
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
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className={`px-2 py-1.5 rounded-full text-xs font-medium transition-all ${
                            qrType === 'stamp'
                              ? 'bg-primary text-primary-foreground shadow-sm'
                              : 'text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          <MoreVertical className="h-3.5 w-3.5" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setQrType("stamp")}>
                          {t('createCache.verificationQR.styleStamp')}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setShowCompactDialog(true)}>
                          <span className="text-primary font-medium">{t('createCache.verificationQR.compactUrls')}</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <p className="text-[11px] text-muted-foreground text-center mt-1.5">
                    {qrType === 'stamp'
                      ? t('createCache.verificationQR.styleStampDesc')
                      : QR_STYLES.find(s => s.value === qrType)?.description}
                  </p>
                </div>

                {/* Save + Print */}
                <div className="flex gap-2 justify-center">
                  <Button onClick={handleDownloadQR} disabled={!qrDataUrl} className="flex-1 max-w-[160px]">
                    <Download className="h-4 w-4 mr-1.5" />
                    {t('createCache.verificationQR.save')}
                  </Button>
                  <Button variant="outline" onClick={handlePrint} disabled={!qrDataUrl} className="flex-1 max-w-[160px]">
                    <Printer className="h-4 w-4 mr-1.5" />
                    {t('createCache.verificationQR.print')}
                  </Button>
                </div>

                {/* Next steps */}
                {!isBulkType && (
                  <div className="flex flex-col gap-2">
                    <Button variant="outline" onClick={handleFillOutNow} disabled={!qrDataUrl} className="w-full">
                      <Edit className="h-4 w-4 mr-1.5" />
                      {t('createCache.listing.createNow')}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="w-full">
                      <QrCode className="h-3.5 w-3.5 mr-1.5" />
                      {t('createCache.listing.scanLater')}
                    </Button>
                  </div>
                )}
                {isBulkType && (
                  <p className="text-xs text-muted-foreground text-center">
                    {qrType === 'sheet' ? t('createCache.listing.sheetDescription') : t('createCache.listing.stampDescription')}
                  </p>
                )}

                {/* Advanced (inside QR path only) */}
                <div className="border-t pt-4">
                  <button
                    type="button"
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mx-auto"
                  >
                    <Settings className="h-3 w-3" />
                    {showAdvanced ? t('common.hide') : t('common.show')} {t('createCache.advanced')}
                  </button>

                  {showAdvanced && (
                    <div className="mt-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <Gift className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-xs font-medium text-foreground">{t('createCache.gift.title')}</span>
                      </div>
                      <ProfileSearch
                        onSelect={(pubkey) => {
                          const npub = nip19.npubEncode(pubkey);
                          setCustomNpub(npub);
                          setNpubError("");
                          setSubmittedNpub(npub);
                          toast({ title: t('createCache.gift.updated'), description: t('createCache.gift.updatedDescription') });
                        }}
                        placeholder={t('createCache.gift.placeholder')}
                        value={customNpub}
                      />
                      {submittedNpub && <WotAuthorCard pubkey={submittedNpub} />}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Path 2: Listing Only */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => navigate('/create-cache')}
            onKeyDown={(e) => { if (e.key === 'Enter') navigate('/create-cache'); }}
            className="rounded-xl border bg-card p-5 md:p-6 hover:border-primary/50 hover:shadow-md cursor-pointer transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 w-10 h-10 md:w-12 md:h-12 rounded-full bg-muted flex items-center justify-center">
                <FileText className="h-5 w-5 md:h-6 md:w-6 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-sm md:text-base font-semibold text-foreground">{t('createCache.listing.title')}</h2>
                <p className="text-xs md:text-sm text-muted-foreground mt-0.5">{t('createCache.listing.description')}</p>
                <p className="text-xs md:text-sm font-medium text-muted-foreground/70 mt-1.5">{t('createCache.listing.finderNote')}</p>
              </div>
              <ChevronRight className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground flex-shrink-0" />
            </div>
          </div>

          <p className={`flex items-center justify-center gap-1.5 text-sm md:text-base pt-4 ${isDitto ? 'text-muted-foreground' : 'text-white/80 adventure:text-stone-600'}`}>
            <BookOpen className="h-4 w-4 flex-shrink-0" />
            {t('createCache.firstTimeHint')}{' '}
            <a href="/blog/86184109eae937d8d6f980b4a0b46da4ef0d983eade403ee1b4c0b6bde238b47/h" className={`font-semibold ${isDitto ? 'hover:text-foreground' : 'hover:text-white adventure:hover:text-stone-800'}`}>
              {t('createCache.firstTimeLink')}
            </a>
          </p>

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
