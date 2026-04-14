import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { QrCode, ChevronDown, Download, Printer, Settings, Gift, Edit } from "lucide-react";
import { Chest } from "@/config/cacheIconConstants";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PageLayout } from "@/components/PageLayout";
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
  const [qrType, setQrType] = useState<"full" | "cutout" | "micro" | "sheet" | "stamp">("full");
  const [_sheetData, setSheetData] = useState<{name: string, naddr: string, keyPair: VerificationKeyPair}[]>([]);
  const [_stampData, setStampData] = useState<{name: string, naddr: string, keyPair: VerificationKeyPair}[]>([]);
  const [showCompactDialog, setShowCompactDialog] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [customNpub, setCustomNpub] = useState<string>("");
  const [submittedNpub, setSubmittedNpub] = useState<string>("");
  const [npubError, setNpubError] = useState<string>("");

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
        const dataPromises = [];
        for (let i = 0; i < 9; i++) {
          const name = uniqueNamesGenerator(customConfig);
          const dTag = generateDeterministicDTag(name, targetPubkey);
          const naddr = geocacheToNaddr(targetPubkey, dTag);
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
          const dTag = generateDeterministicDTag(name, targetPubkey);
          const naddr = geocacheToNaddr(targetPubkey, dTag);
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
      <PageLayout maxWidth="md" className="py-16">
        <LoginRequiredCard
          icon={QrCode}
          description={t('createCache.loginRequired')}
          className="max-w-md mx-auto"
        />
      </PageLayout>
    );
  }

  return (
    <PageLayout maxWidth="lg" background="default" className="pb-4">
      <div className="max-w-md mx-auto text-center space-y-4">
        {/* Hero Section */}
        <div className="space-y-2">
          <div className="flex items-center gap-3 justify-center mb-2">
            <div className="bg-primary adventure:bg-amber-700 p-2 rounded-lg flex-shrink-0">
              <Chest className="text-white h-6 w-6" />
            </div>
            <div className="text-left">
              <h1 className="text-foreground [@media(max-height:800px)]:text-xl text-2xl font-bold">
                {t('createCache.title')}
              </h1>
              <p className="text-muted-foreground text-xs">
                {t('createCache.subtitle')}
              </p>
            </div>
          </div>
        </div>

        {/* QR Code Section */}
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl p-6 border border-primary/10 adventure:border-amber-200">
            <div className="flex items-center justify-center gap-2 mb-3">
              <QrCode className="h-5 w-5 text-primary adventure:text-amber-600" />
              <h2 className="text-lg font-semibold text-primary adventure:text-amber-700">
                {t('createCache.verificationQR.title')}
              </h2>
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
                <img
                  src={qrDataUrl}
                  alt="Verification QR Code"
                  className="w-full [@media(max-height:680px)]:h-[120px] [@media(max-height:900px)]:max-w-[50vw] sm:h-auto rounded-lg shadow-sm max-w-xs object-contain"
                />
              ) : (
                <div className="w-48 h-48 flex items-center justify-center bg-primary/5 dark:bg-primary/10 adventure:bg-amber-50 adventure:dark:bg-amber-950 rounded-lg">
                  <ComponentLoading size="sm" title={t('createCache.verificationQR.generating')} />
                </div>
              )}
            </div>

            <div className="flex justify-center gap-2 flex-wrap">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Settings className="h-4 w-4 mr-1" />
                    {t('createCache.verificationQR.style')}
                    <ChevronDown className="h-3 w-3 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => setQrType("full")}>
                    {t('createCache.verificationQR.styleFull')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setQrType("cutout")}>
                    {t('createCache.verificationQR.styleCutout')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setQrType("micro")}>
                    {t('createCache.verificationQR.styleMicro')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setQrType("sheet")}>
                    {t('createCache.verificationQR.styleSheet')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setQrType("stamp")}>
                    {t('createCache.verificationQR.styleStamp')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowCompactDialog(true)} className="border-t mt-1 pt-1">
                    <span className="text-primary font-medium">Compact URLs</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button onClick={handleDownloadQR} disabled={!qrDataUrl} size="sm">
                <Download className="h-4 w-4 mr-1" />
                {t('createCache.verificationQR.save')}
              </Button>
              <Button variant="outline" onClick={handlePrint} disabled={!qrDataUrl} size="sm">
                <Printer className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Action Section */}
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl p-6 border border-primary/10 adventure:border-amber-200">
            <div className="flex items-center justify-center gap-2 mb-3">
              <Chest className="h-5 w-5 text-primary adventure:text-amber-600" />
              <h2 className="text-lg font-semibold text-primary adventure:text-amber-700">
                {t('createCache.listing.title')}
              </h2>
            </div>

            {(qrType === 'sheet' || qrType === 'stamp') ? (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  {qrType === 'sheet' ? t('createCache.listing.sheetDescription') : t('createCache.listing.stampDescription')}
                </p>
              </div>
            ) : (
              <>
                <p className="text-xs text-muted-foreground mb-4">
                  {t('createCache.listing.description')}
                </p>
                <div className="flex gap-2 justify-center flex-wrap">
                  <Button
                    onClick={handleFillOutNow}
                    disabled={!qrDataUrl}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground adventure:bg-amber-700 adventure:hover:bg-amber-800"
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    {t('createCache.listing.createNow')}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => navigate("/")}
                    className="border-primary/10 text-primary hover:bg-primary/5 adventure:border-amber-200 adventure:text-amber-700 adventure:hover:bg-amber-50"
                  >
                    {t('createCache.listing.later')}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Simplified Advanced Options */}
        {showAdvanced && (
          <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-primary/10 adventure:border-amber-200">
            <div className="flex items-center gap-2 mb-3">
              <Gift className="h-4 w-4 text-primary adventure:text-amber-600" />
              <span className="text-sm font-medium text-primary adventure:text-amber-700">{t('createCache.gift.title')}</span>
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
              className="w-full px-3 py-2 text-sm border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring adventure:focus:ring-amber-500"
            />
            {npubError && (
              <p className="text-xs text-destructive mt-1">{npubError}</p>
            )}
            {customNpub && !npubError && (
              <Button
                size="sm"
                onClick={async () => {
                  setSubmittedNpub(customNpub);
                  toast({
                    title: t('createCache.gift.updated'),
                    description: t('createCache.gift.updatedDescription'),
                  });
                }}
                className="w-full mt-2 bg-primary hover:bg-primary/90 text-primary-foreground adventure:bg-amber-700 adventure:hover:bg-amber-800"
              >
                <Gift className="h-4 w-4 mr-1" />
                {t('createCache.gift.createQR')}
              </Button>
            )}
          </div>
        )}

        {/* Advanced Toggle */}
        <div className="flex justify-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            <Settings className="h-3 w-3 mr-1" />
            {showAdvanced ? t('common.hide') : t('common.show')} {t('createCache.advanced')}
          </Button>
        </div>

        {/* Compact URL Generator Dialog */}
        {user && (
          <CompactUrlGeneratorDialog
            open={showCompactDialog}
            onOpenChange={setShowCompactDialog}
            pubkey={getPubkeyForNaddr()}
          />
        )}
      </div>
    </PageLayout>
  );
}
