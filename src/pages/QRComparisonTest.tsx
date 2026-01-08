import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageLayout } from "@/components/layout";
import { useCurrentUser } from "@/features/auth/hooks/useCurrentUser";
import { LoginRequiredCard } from "@/components/LoginRequiredCard";
import {
  generateVerificationKeyPair,
  type VerificationKeyPair
} from "@/features/geocache/utils/verification";
import { geocacheToNaddr } from "@/shared/utils/naddr-utils";
import { generateDeterministicDTag, generateCompactDTag } from "@/features/geocache/utils/dTag";
import { NIP_GC_KINDS } from "@/features/geocache/utils/nip-gc";
import { encodeCompactUrl } from "@/shared/utils/compactUrl";
import { ComponentLoading } from "@/components/ui/loading";
import { uniqueNamesGenerator, Config, adjectives, colors, animals } from 'unique-names-generator';
import QRCode from 'qrcode';

const customConfig: Config = {
  dictionaries: [adjectives, colors, animals],
  separator: '-',
  length: 3,
};

interface TreasureComparison {
  name: string;
  dTag: string;
  pubkey: string;
  naddr: string;
  keyPair: VerificationKeyPair;
  standardUrl: string;
  compactUrl: string;
  standardQR: string;
  compactQR: string;
}

export default function QRComparisonTest() {
  const { t } = useTranslation();
  const { user } = useCurrentUser();
  const [comparisons, setComparisons] = useState<TreasureComparison[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (!user) return;
    generateComparisons();
  }, [user]);

  const generateComparisons = async () => {
    if (!user) return;
    
    setIsGenerating(true);
    try {
      const results: TreasureComparison[] = [];
      
      for (let i = 0; i < 10; i++) {
        const name = uniqueNamesGenerator(customConfig);
        const dTag = generateDeterministicDTag(name, user.pubkey); // Standard d-tag
        const compactDTag = generateCompactDTag(); // 6-char hex for compact URLs
        const naddr = geocacheToNaddr(user.pubkey, dTag);
        const keyPair = await generateVerificationKeyPair();
        
        const standardUrl = `https://treasures.to/${naddr}#verify=${keyPair.nsec}`;
        const compactUrl = encodeCompactUrl(user.pubkey, compactDTag, keyPair.nsec, NIP_GC_KINDS.GEOCACHE);
        
        // Generate QR codes
        const [standardQR, compactQR] = await Promise.all([
          QRCode.toDataURL(standardUrl, {
            width: 200,
            margin: 1,
            errorCorrectionLevel: 'M'
          }),
          QRCode.toDataURL(compactUrl, {
            width: 200,
            margin: 1,
            errorCorrectionLevel: 'M'
          })
        ]);
        
        results.push({
          name,
          dTag,
          pubkey: user.pubkey,
          naddr,
          keyPair,
          standardUrl,
          compactUrl,
          standardQR,
          compactQR
        });
      }
      
      setComparisons(results);
    } catch (error) {
      console.error('Failed to generate comparisons:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  if (!user) {
    return (
      <PageLayout maxWidth="md" className="py-16">
        <LoginRequiredCard
          icon={QrCode}
          description="Login required to test QR generation"
          className="max-w-md mx-auto"
        />
      </PageLayout>
    );
  }

  // Calculate averages
  const avgStandardLen = comparisons.length > 0 
    ? Math.round(comparisons.reduce((sum, c) => sum + c.standardUrl.length, 0) / comparisons.length)
    : 0;
  const avgCompactLen = comparisons.length > 0
    ? Math.round(comparisons.reduce((sum, c) => sum + c.compactUrl.length, 0) / comparisons.length)
    : 0;
  const savings = avgStandardLen - avgCompactLen;
  const savingsPercent = avgStandardLen > 0 ? Math.round((savings / avgStandardLen) * 100) : 0;

  return (
    <PageLayout maxWidth="full" background="default" className="pb-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-foreground text-2xl font-bold flex items-center justify-center gap-2">
            <QrCode className="text-foreground h-8 w-8" />
            QR Code Format Comparison Test
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            Comparing standard naddr URLs vs compact binary URLs
          </p>
        </div>

        {isGenerating ? (
          <div className="flex justify-center py-12">
            <ComponentLoading size="lg" title="Generating 10 test treasures..." />
          </div>
        ) : (
          <>
            {/* Summary stats */}
            <div className="bg-muted/50 rounded-lg p-4 border">
              <h2 className="font-semibold text-lg mb-2">Summary</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Avg Standard URL:</span>
                  <span className="ml-2 font-mono font-bold">{avgStandardLen} chars</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Avg Compact URL:</span>
                  <span className="ml-2 font-mono font-bold text-green-600">{avgCompactLen} chars</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Savings:</span>
                  <span className="ml-2 font-mono font-bold text-green-600">{savings} chars ({savingsPercent}%)</span>
                </div>
                <div>
                  <Button onClick={generateComparisons} variant="outline" size="sm">
                    Regenerate
                  </Button>
                </div>
              </div>
            </div>

            {/* Individual comparisons */}
            <div className="space-y-6">
              {comparisons.map((comparison, index) => (
                <div key={index} className="bg-white dark:bg-gray-900 rounded-lg border p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-lg">
                      #{index + 1}: {comparison.name}
                    </h3>
                  </div>
                  
                  {/* URLs comparison */}
                  <div className="space-y-2">
                    <div className="flex items-start gap-2">
                      <span className="text-sm font-medium text-muted-foreground w-20 shrink-0">Standard:</span>
                      <code className="text-xs bg-muted px-2 py-1 rounded break-all flex-1">
                        {comparison.standardUrl}
                      </code>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {comparison.standardUrl.length} chars
                      </span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-sm font-medium text-green-600 w-20 shrink-0">Compact:</span>
                      <code className="text-xs bg-green-50 dark:bg-green-950 px-2 py-1 rounded break-all flex-1">
                        {comparison.compactUrl}
                      </code>
                      <span className="text-xs text-green-600 shrink-0">
                        {comparison.compactUrl.length} chars
                      </span>
                    </div>
                  </div>
                  
                  {/* QR codes side by side */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center">
                      <p className="text-sm font-medium mb-2">Standard QR</p>
                      <div className="bg-white p-2 rounded border inline-block">
                        <img src={comparison.standardQR} alt="Standard QR" className="w-40 h-40" />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {comparison.standardUrl.length} chars encoded
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium text-green-600 mb-2">Compact QR</p>
                      <div className="bg-white p-2 rounded border inline-block">
                        <img src={comparison.compactQR} alt="Compact QR" className="w-40 h-40" />
                      </div>
                      <p className="text-xs text-green-600 mt-1">
                        {comparison.compactUrl.length} chars encoded
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </PageLayout>
  );
}

