import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { QrCode, Download, Upload, CheckCircle, Copy, Trash2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
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
import { buildGeocacheTags, NIP_GC_KINDS } from "@/features/geocache/utils/nip-gc";
import { geocacheToNaddr } from "@/shared/utils/naddr-utils";
import { generateDeterministicDTag } from "@/features/geocache/utils/dTag";
import { ComponentLoading } from "@/components/ui/loading";
import { uniqueNamesGenerator, Config, adjectives, colors, animals } from 'unique-names-generator';

const customConfig: Config = {
  dictionaries: [adjectives, colors, animals],
  separator: '-',
  length: 3,
};

interface PreGeneratedCache {
  name: string;
  dTag: string;
  verificationKeyPair: VerificationKeyPair;
  mockEvent: {
    id: string;
    pubkey: string;
    created_at: number;
    kind: number;
    tags: string[][];
    content: string;
  };
  naddr: string;
  timestamp: number;
}

export default function GenerateQR() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useCurrentUser();
  const { toast } = useToast();

  const [cacheName, setCacheName] = useState<string>('');
  const [verificationKeyPair, setVerificationKeyPair] = useState<VerificationKeyPair | null>(null);
  const [mockEvent, setMockEvent] = useState<PreGeneratedCache['mockEvent'] | null>(null);
  const [naddr, setNaddr] = useState<string>('');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [qrType, setQrType] = useState<'full' | 'cutout' | 'micro'>('full');

  const [isGenerating, setIsGenerating] = useState(false);
  const [exportData, setExportData] = useState<string>('');
  const [importData, setImportData] = useState<string>('');
  const [showGenerated, setShowGenerated] = useState(false);

  // Check if we're importing from URL params
  useEffect(() => {
    const importParam = searchParams.get('import');
    if (importParam) {
      try {
        const decoded = atob(importParam);
        handleImportData(decoded);
      } catch (error) {
        toast({
          title: "Import Failed",
          description: "Invalid import data in URL",
          variant: "destructive",
        });
      }
    }
  }, [searchParams]);

  const generateMockEvent = async () => {
    if (!user) return;

    const finalCacheName = cacheName.trim() || uniqueNamesGenerator(customConfig);

    try {
      // Generate verification keypair
      const keyPair = await generateVerificationKeyPair();
      setVerificationKeyPair(keyPair);

      // Create a deterministic dTag based on cache name and user pubkey
      // This ensures the same naddr will be generated when the actual cache is created
      const dTag = generateDeterministicDTag(finalCacheName, user.pubkey);

      // Generic location (center of US)
      const genericLocation = { lat: 39.8283, lng: -98.5795 };

      // Build tags for the mock event with generic data
      const tags = buildGeocacheTags({
        dTag,
        name: finalCacheName,
        location: genericLocation,
        difficulty: 2, // Generic difficulty
        terrain: 2,    // Generic terrain
        size: 'regular' as any,
        type: 'traditional' as any,
        hint: 'Look carefully around the area',
        images: [],
        verificationPubkey: keyPair.publicKey,
        hidden: false,
      });

      // Create mock event structure
      const mockEventData = {
        id: `mock-${Date.now()}`, // Mock event ID
        pubkey: user.pubkey,
        created_at: Math.floor(Date.now() / 1000),
        kind: NIP_GC_KINDS.GEOCACHE,
        tags,
        content: `A geocache named "${finalCacheName}". This is a mock event for QR code generation.`,
      };

      setMockEvent(mockEventData);

      // Generate naddr for the mock event
      const mockNaddr = geocacheToNaddr(user.pubkey, dTag);
      setNaddr(mockNaddr);

      // Generate export data
      const exportableData: PreGeneratedCache = {
        name: finalCacheName,
        dTag: dTag,
        verificationKeyPair: keyPair,
        mockEvent: mockEventData,
        naddr: mockNaddr,
        timestamp: Date.now(),
      };

      setExportData(JSON.stringify(exportableData, null, 2));
      setShowGenerated(true);

      toast({
        title: "Mock Cache Generated",
        description: "Your pre-generated cache is ready. You can now generate QR codes and export the data.",
      });
    } catch (error) {
      toast({
        title: "Generation Failed",
        description: error instanceof Error ? error.message : "Failed to generate mock cache",
        variant: "destructive",
      });
    }
  };

  const handleImportData = (data: string) => {
    try {
      const parsed: PreGeneratedCache = JSON.parse(data);
      
      // Validate the structure
      if (!parsed.name || !parsed.verificationKeyPair || !parsed.naddr) {
        throw new Error("Invalid cache data structure");
      }

      // Import the data
      setCacheName(parsed.name);
      setVerificationKeyPair(parsed.verificationKeyPair);
      setMockEvent(parsed.mockEvent);
      setNaddr(parsed.naddr);
      setExportData(JSON.stringify(parsed, null, 2));
      setShowGenerated(true);

      toast({
        title: "Cache Data Imported",
        description: "Your pre-generated cache data has been loaded successfully.",
      });

      setImportData('');
    } catch (error) {
      toast({
        title: "Import Failed",
        description: error instanceof Error ? error.message : "Invalid JSON data",
        variant: "destructive",
      });
    }
  };

  const generateQR = async () => {
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
  };

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

  const handleExport = () => {
    if (!exportData) return;

    const blob = new Blob([exportData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `geocache-${cacheName.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: "Data Exported",
      description: "Your pre-generated cache data has been downloaded.",
    });
  };

  const handleCopyExportData = async () => {
    try {
      await navigator.clipboard.writeText(exportData);
      toast({
        title: "Data Copied",
        description: "Export data copied to clipboard",
      });
    } catch (error) {
      toast({
        title: "Copy Failed",
        description: "Unable to copy to clipboard",
        variant: "destructive",
      });
    }
  };

  const handleCopyShareableLink = async () => {
    if (!exportData) return;

    try {
      const encoded = btoa(exportData);
      const shareableUrl = `${window.location.origin}/generate-qr?import=${encoded}`;
      await navigator.clipboard.writeText(shareableUrl);
      toast({
        title: "Shareable Link Copied",
        description: "Link with embedded cache data copied to clipboard",
      });
    } catch (error) {
      toast({
        title: "Copy Failed",
        description: "Unable to copy to clipboard",
        variant: "destructive",
      });
    }
  };

  const handleReset = () => {
    setCacheName('');
    setVerificationKeyPair(null);
    setMockEvent(null);
    setNaddr('');
    setQrDataUrl('');
    setExportData('');
    setImportData('');
    setShowGenerated(false);
  };

  // Generate QR when data is ready
  useEffect(() => {
    if (naddr && verificationKeyPair) {
      generateQR();
    }
  }, [naddr, verificationKeyPair, qrType]);

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

        {!showGenerated ? (
          <div className="gap-6">
            {/* Create New Cache */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Create New QR Code</CardTitle>
                <CardDescription>
                  Generate a QR code with verification key
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="cache-name">Cache Name (Optional)</Label>
                  <Input
                    id="cache-name"
                    value={cacheName}
                    onChange={(e) => setCacheName(e.target.value)}
                    placeholder="My cool treasure!"
                    className="mt-2"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    This will be used for the QR code filename. Uses a random name by default.
                  </p>
                </div>

                <Button 
                  onClick={generateMockEvent}
                  className="w-full"
                >
                  Generate QR Code
                </Button>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Cache Preview */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Generated Cache: {cacheName}</CardTitle>
                <CardDescription>
                  Your QR code is ready. This data can be used to pre-fill the create form later.
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

            {/* Export/Share */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Export & Share</CardTitle>
                <CardDescription>
                  Save or share your cache data to use later in the create form
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Button onClick={handleExport} variant="outline">
                    <Download className="h-4 w-4 mr-2" />
                    Download JSON
                  </Button>
                  <Button onClick={handleCopyExportData} variant="outline">
                    <Copy className="h-4 w-4 mr-2" />
                    Copy Data
                  </Button>
                  <Button onClick={handleCopyShareableLink} variant="outline">
                    <Copy className="h-4 w-4 mr-2" />
                    Copy Shareable Link
                  </Button>
                </div>

                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Next steps:</strong> Save this data and use it to pre-fill the create form when you're ready to publish your cache.
                    You can import this data on the create page or use the shareable link.
                  </AlertDescription>
                </Alert>

                <div className="grid grid-cols-2 gap-2">
                  <Button 
                    onClick={() => navigate('/create')} 
                    className="flex-1"
                  >
                    Go to Create Page
                  </Button>
                  <Button 
                    onClick={handleReset} 
                    variant="outline"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Reset
                  </Button>
                </div>
                <Button
                  variant="secondary"
                  onClick={() => setShowGenerated(false)}
                  className="w-full bg-white text-black hover:bg-gray-100 border"
                >
                  Done
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </PageLayout>
  );
}