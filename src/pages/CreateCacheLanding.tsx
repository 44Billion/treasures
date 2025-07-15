import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { QrCode, ChevronDown, Download, Printer } from "lucide-react";
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
  type VerificationKeyPair,
} from "@/features/geocache/utils/verification";
import { geocacheToNaddr } from "@/shared/utils/naddr-utils";
import { generateDeterministicDTag } from "@/features/geocache/utils/dTag";
import { ComponentLoading } from "@/components/ui/loading";
import {
  uniqueNamesGenerator,
  Config,
  adjectives,
  colors,
  animals,
} from "unique-names-generator";

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
  const [qrType, setQrType] = useState<"full" | "cutout" | "micro">("full");

  const generateQR = useCallback(async () => {
    if (!user || !verificationKeyPair) return;

    try {
      const dataUrl = await generateVerificationQR(
        naddr,
        verificationKeyPair.nsec,
        qrType
      );
      setQrDataUrl(dataUrl);
    } catch (error) {
      toast({
        title: "QR Generation Failed",
        description:
          error instanceof Error ? error.message : "Failed to generate QR code",
        variant: "destructive",
      });
    }
  }, [user, qrType, toast, naddr, verificationKeyPair]);

  useEffect(() => {
    if (!user) return;

    const generateInitialQR = async () => {
      const finalCacheName = uniqueNamesGenerator(customConfig);
      const dTag = generateDeterministicDTag(finalCacheName, user.pubkey);
      const naddr = geocacheToNaddr(user.pubkey, dTag);
      const keyPair = await generateVerificationKeyPair();
      setCacheName(finalCacheName);
      setNaddr(naddr);
      setVerificationKeyPair(keyPair);
    };

    generateInitialQR();
  }, [user]);

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
      const filename = `${safeCacheName}-qr-code.png`;
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
      navigate(`/create-cache?claimUrl=${encodeURIComponent(claimUrl)}`);
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
          <h1 className="text-foreground text-2xl font-bold flex items-center justify-center gap-2">
            <QrCode className="text-foreground h-8 w-8" />
            Hide a New Geocache
          </h1>

        </div>

        <div className="space-y-4 pt-4 border-t">
          <h2 className="text-lg font-semibold text-foreground">Step 1: Get Your QR Code</h2>
          <p className="text-sm text-muted-foreground">
            Print this QR code and place it inside your physical cache.
          </p>
          <div className="flex justify-center p-4 bg-white rounded-lg border shadow-sm">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="Verification QR Code"
                className="w-full h-auto rounded max-w-xs object-contain"
              />
            ) : (
              <div className="w-64 h-64 flex items-center justify-center bg-muted rounded">
                <ComponentLoading size="sm" title="Generating..." />
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

        <div className="space-y-4 pt-4 border-t">
          <h2 className="text-lg font-semibold text-foreground">Step 2: Create Your Listing</h2>
          <p className="text-sm text-muted-foreground">
            Create the online listing for your geocache now, or scan the QR code later to finish.
          </p>
          <Button
            onClick={handleFillOutNow}
            disabled={!qrDataUrl}
            className="w-full"
          >
            I'll fill it out now
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate("/")}
            className="w-full"
          >
            I'll do it later
          </Button>
        </div>
      </div>
    </PageLayout>
  );
}
