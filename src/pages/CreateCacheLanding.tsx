import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { QrCode, ChevronDown, Download, Printer, Settings, Gift } from "lucide-react";
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
      <div className="max-w-md mx-auto text-center space-y-4">
        <div>
          <h1 className="text-foreground [@media(max-height:800px)]:text-xl text-2xl font-bold flex items-center justify-center gap-2 -mb-1 sm:mb-0">
            <QrCode className="text-foreground h-8 w-8" />
            Hide a New Geocache
          </h1>
        </div>

        <div className="space-y-2 xs:space-y-4">
          <h2 className="text-md sm:text-lg font-semibold text-foreground">Step 1: Get Your QR Code</h2>
          <p className="text-xs text-muted-foreground p-1">
            {qrType === 'sheet' ? 'Print this 3x3 grid of QR codes for multiple geocaches.' : 'Print this QR code and place it inside your geocache.'}
          </p>
          
          <div className="flex justify-center">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="Verification QR Code"
                className="w-full [@media(max-height:680px)]:h-[150px] [@media(max-height:900px)]:max-w-[55vw] sm:h-auto rounded max-w-xs object-contain"
              />
            ) : (
              <div className="w-64 h-64 flex items-center justify-center bg-muted rounded">
                <ComponentLoading size="sm" title="Generating..." />
              </div>
            )}
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center justify-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                <Settings className="h-3 w-3 mr-1" />
                {showAdvanced ? 'Hide' : 'Show'} Advanced Options
              </Button>
            </div>
            
            {showAdvanced && (
              <div className="space-y-3 p-3 bg-muted/30 rounded-lg border">
                <div className="flex items-center gap-2 text-sm font-medium text-primary">
                  <Gift className="h-4 w-4 text-primary" />
                  <span>Create Giftable Cache</span>
                </div>
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground">
                    Recipient's npub (optional)
                  </label>
                  <input
                    type="text"
                    placeholder="npub1..."
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
                    className="w-full px-3 py-2 text-sm border rounded-md bg-background text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  {npubError && (
                    <p className="text-xs text-destructive">{npubError}</p>
                  )}
                  
                  {customNpub && validateNpub(customNpub) && (
                    <GiftAuthorCard npub={customNpub} />
                  )}
                  
                  <p className="text-xs text-muted-foreground">
                    Enter a friend's npub to create a giftable cache.
                  </p>
                  {customNpub && (
                    <Button
                      size="sm"
                      onClick={async () => {
                        if (validateNpub(customNpub)) {
                          setSubmittedNpub(customNpub);
                          toast({
                            title: "Giftable Cache Updated",
                            description: "QR code updated for the gift recipient",
                          });
                        } else {
                          toast({
                            title: "Invalid npub",
                            description: "Please enter a valid npub address",
                            variant: "destructive",
                          });
                        }
                      }}
                      disabled={!customNpub || !!npubError}
                      className="w-full"
                    >
                      <Gift className="h-4 w-4" />
                      Create Giftable QR Code
                    </Button>
                  )}
                </div>
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
            <Button onClick={handleDownloadQR} disabled={!qrDataUrl}>
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
            <Button variant="outline" onClick={handlePrint} disabled={!qrDataUrl}>
              <Printer className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:block">Print</span>
            </Button>
          </div>
        </div>

        <div className="space-y-2 xs:space-y-4 pt-4 border-t">
          <h2 className="text-md sm:text-lg font-semibold text-foreground">Step 2: Create Your Listings</h2>
          {qrType === 'sheet' ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Hide each QR code in a separate geocache location. Scan each QR code with your phone to create the individual listings.
              </p>
              <p className="text-sm text-muted-foreground">
                Each QR code contains a unique verification key - scan them one at a time as you place each cache.
              </p>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Create the online listing for your geocache now, or scan the QR code later to finish.
              </p>
              <div className="flex gap-2 justify-center [@media(max-height:680px)]:flex-row flex-col">
                <Button
                  onClick={handleFillOutNow}
                  disabled={!qrDataUrl}
                  className="[@media(max-height:680px)]:w-50 w-full p-5"
                >
                  I'll fill it out now
                </Button>
                <Button
                  variant="outline"
                  onClick={() => navigate("/")}
                  className="[@media(max-height:680px)]:w-50 w-full p-5"
                >
                  I'll do it later
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </PageLayout>
  );
}
