import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { QrCode, ChevronDown, Download, Printer, Settings, Gift, MapPin, Sparkles, Crown } from "lucide-react";
import { Chest } from "@/features/geocache/constants/cacheIconConstants";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PageLayout } from "@/components/layout";
import { useCurrentUser } from "@/features/auth/hooks/useCurrentUser";
import { LoginRequiredCard } from "@/components/LoginRequiredCard";
import { useToast } from "@/shared/hooks/useToast";
import {
  generateVerificationKeyPair,
  generateVerificationQR,
  downloadQRCode,
  generateQRGridImage,
  type VerificationKeyPair,
} from "@/features/geocache/utils/verification";
import { geocacheToNaddr } from "@/shared/utils/naddr-utils";
import { generateDeterministicDTag } from "@/features/geocache/utils/dTag";
import { nip19 } from 'nostr-tools';
import { ComponentLoading } from "@/components/ui/loading";
import {
  uniqueNamesGenerator,
  Config,
  adjectives,
  colors,
  animals,
} from "unique-names-generator";
import { useAuthor } from "@/features/auth/hooks/useAuthor";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";

const customConfig: Config = {
  dictionaries: [adjectives, colors, animals],
  separator: "-",
  length: 3,
};

export default function CreateCacheLanding() {
  const { user } = useCurrentUser();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [cacheName, setCacheName] = useState<string>("");
  const [verificationKeyPair, setVerificationKeyPair] =
    useState<VerificationKeyPair | null>(null);
  const [naddr, setNaddr] = useState<string>("");
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [qrType, setQrType] = useState<"full" | "cutout" | "micro" | "sheet">("full");
  const [_sheetData, setSheetData] = useState<{name: string, naddr: string, keyPair: VerificationKeyPair}[]>([]);
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

  const GiftAuthorCard = ({ npub }: { npub: string }) => {
    let authorPubkey = '';
    if (npub?.startsWith('npub')) {
      const decoded = nip19.decode(npub);
      if (decoded.type === 'npub') {
        authorPubkey = decoded.data;
      }
    }
    const { data: author, isLoading } = useAuthor(authorPubkey);

    if (!authorPubkey) {
      return null;
    }

    if (isLoading) {
      return (
        <Card>
          <CardContent className="flex items-center gap-3 p-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="space-y-1">
              <Skeleton className="h-3 w-[120px]" />
              <Skeleton className="h-3 w-[80px]" />
            </div>
          </CardContent>
        </Card>
      );
    }

    if (!author) {
      return null;
    }

    const metadata = author.metadata;

    return (
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="flex items-center gap-3 p-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={metadata?.picture} alt={metadata?.name} />
            <AvatarFallback>{metadata?.name?.charAt(0) || '?'}</AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium text-sm text-left">{metadata?.name || 'Unknown User'}</p>
            <p className="text-xs text-muted-foreground text-left">
              {npub.slice(0, 12)}...{npub.slice(-4)}
            </p>
          </div>
        </CardContent>
      </Card>
    );
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
        const gridUrl = await generateQRGridImage(data);
        setQrDataUrl(gridUrl);
      } else {
        setSheetData([]);
        const dataUrl = await generateVerificationQR(
          naddr,
          verificationKeyPair.nsec,
          qrType
        );
        setQrDataUrl(dataUrl);
      }
    } catch (error) {
      toast({
        title: "QR Generation Failed",
        description:
          error instanceof Error ? error.message : "Failed to generate QR code",
        variant: "destructive",
      });
    }
  }, [user, qrType, toast, naddr, verificationKeyPair, getPubkeyForNaddr]);

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
      const filename = qrType === 'sheet' ? `${safeCacheName}-qr-sheet.png` : `${safeCacheName}-qr-code.png`;
      downloadQRCode(qrDataUrl, filename);
      toast({
        title: "QR Code Downloaded",
        description: "The QR code has been saved to your downloads.",
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
          description="You need to be logged in to create a geocache."
          className="max-w-md mx-auto"
        />
      </PageLayout>
    );
  }

  return (
    <PageLayout maxWidth="lg" background="default" className="pb-4">
      <div className="max-w-md mx-auto text-center space-y-6">
        {/* Hero Section */}
        <div className="space-y-2">
          <h1 className="text-foreground [@media(max-height:800px)]:text-xl text-2xl font-bold flex items-center justify-center gap-2 mb-2">
            <div className="bg-green-600 adventure:bg-amber-700 p-2 rounded-lg">
              <Chest className="text-white h-6 w-6" />
            </div>
            Hide a New Geocache
          </h1>
          <p className="text-muted-foreground text-xs">
            Create a treasure for others to discover!
          </p>
        </div>

        {/* QR Code Section */}
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl p-6 border border-green-200 adventure:border-amber-200">
            <div className="flex items-center justify-center gap-2 mb-3">
              <QrCode className="h-5 w-5 text-green-600 adventure:text-amber-600" />
              <h2 className="text-lg font-semibold text-green-700 adventure:text-amber-700">
                Verification QR Code
              </h2>
            </div>

            <p className="text-xs text-muted-foreground mb-4">
              Optional but useful - lets finders log verified discoveries
            </p>

            <div className="flex justify-center mb-4">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt="Verification QR Code"
                  className="w-full [@media(max-height:680px)]:h-[120px] [@media(max-height:900px)]:max-w-[50vw] sm:h-auto rounded-lg shadow-sm max-w-xs object-contain"
                />
              ) : (
                <div className="w-48 h-48 flex items-center justify-center bg-green-50 dark:bg-green-950 adventure:bg-amber-50 adventure:dark:bg-amber-950 rounded-lg">
                  <ComponentLoading size="sm" title="Generating..." />
                </div>
              )}
            </div>

            <div className="flex justify-center gap-2 flex-wrap">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Settings className="h-4 w-4 mr-1" />
                    Style
                    <ChevronDown className="h-3 w-3 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => setQrType("full")}>
                    Full
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setQrType("cutout")}>
                    Cutout
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setQrType("micro")}>
                    Micro
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setQrType("sheet")}>
                    Sheet (3x3)
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button onClick={handleDownloadQR} disabled={!qrDataUrl} size="sm">
                <Download className="h-4 w-4 mr-1" />
                Save
              </Button>
              <Button variant="outline" onClick={handlePrint} disabled={!qrDataUrl} size="sm">
                <Printer className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Action Section */}
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl p-6 border border-green-200 adventure:border-amber-200">
            <div className="flex items-center justify-center gap-2 mb-3">
              <MapPin className="h-5 w-5 text-green-600 adventure:text-amber-600" />
              <h2 className="text-lg font-semibold text-green-700 adventure:text-amber-700">
                Create Your Cache Listing
              </h2>
            </div>

            {qrType === 'sheet' ? (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Hide each QR code in separate locations. Scan each one to create listings.
                </p>
              </div>
            ) : (
              <>
                <p className="text-xs text-muted-foreground mb-4">
                  Create listing now or scan QR code later when ready.
                </p>
                <div className="flex gap-2 justify-center">
                  <Button
                    onClick={handleFillOutNow}
                    disabled={!qrDataUrl}
                    className="bg-green-600 hover:bg-green-700 adventure:bg-amber-700 adventure:hover:bg-amber-800 text-white"
                  >
                    <MapPin className="h-4 w-4 mr-2" />
                    Create Now
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => navigate("/")}
                    className="border-green-200 text-green-700 hover:bg-green-50 adventure:border-amber-200 adventure:text-amber-700 adventure:hover:bg-amber-50"
                  >
                    Later
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Simplified Advanced Options */}
        {showAdvanced && (
          <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-green-200 adventure:border-amber-200">
            <div className="flex items-center gap-2 mb-3">
              <Gift className="h-4 w-4 text-green-600 adventure:text-amber-600" />
              <span className="text-sm font-medium text-green-700 adventure:text-amber-700">Giftable Cache</span>
            </div>
            <input
              type="text"
              placeholder="Recipient's npub (optional)"
              value={customNpub}
              onChange={(e) => {
                const value = e.target.value;
                setCustomNpub(value);
                if (value && !validateNpub(value)) {
                  setNpubError("Invalid npub format");
                } else {
                  setNpubError("");
                }
              }}
              className="w-full px-3 py-2 text-sm border rounded-md bg-background text-primary focus:outline-none focus:ring-2 focus:ring-green-500 adventure:focus:ring-amber-500"
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
                    title: "Giftable Cache Updated",
                    description: "QR code updated for the gift recipient",
                  });
                }}
                className="w-full mt-2 bg-green-600 hover:bg-green-700 adventure:bg-amber-700 adventure:hover:bg-amber-800"
              >
                <Gift className="h-4 w-4 mr-1" />
                Create Gift QR
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
            {showAdvanced ? 'Hide' : 'Show'} Advanced
          </Button>
        </div>
      </div>
    </PageLayout>
  );
}
