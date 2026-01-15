import { useState } from 'react';
import { Copy, Check, Link } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { generateVerificationKeyPair, type VerificationKeyPair } from '@/features/geocache/utils/verification';
import { generateCompactDTag } from '@/features/geocache/utils/dTag';
import { encodeCompactUrl } from '@/shared/utils/compactUrl';
import { NIP_GC_KINDS } from '@/features/geocache/utils/nip-gc';
import { uniqueNamesGenerator, Config, adjectives, colors, animals } from 'unique-names-generator';

const customConfig: Config = {
  dictionaries: [adjectives, colors, animals],
  separator: '-',
  length: 3,
};

interface CompactUrlGeneratorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pubkey: string;
}

interface CompactUrlData {
  name: string;
  dTag: string;
  url: string;
  keyPair: VerificationKeyPair;
}

export function CompactUrlGeneratorDialog({ open, onOpenChange, pubkey }: CompactUrlGeneratorDialogProps) {
  const [count, setCount] = useState(1);
  const [urls, setUrls] = useState<CompactUrlData[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const generated: CompactUrlData[] = [];
      
      for (let i = 0; i < count; i++) {
        const name = uniqueNamesGenerator(customConfig);
        const dTag = generateCompactDTag();
        const keyPair = await generateVerificationKeyPair();
        const url = encodeCompactUrl(pubkey, dTag, keyPair.nsec, NIP_GC_KINDS.GEOCACHE);
        
        generated.push({ name, dTag, url, keyPair });
      }
      
      setUrls(generated);
    } catch (error) {
      console.error('Failed to generate compact URLs:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = async (url: string, index: number) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link className="h-5 w-5" />
            Generate Compact URLs
          </DialogTitle>
          <DialogDescription>
            Create short URLs for pre-generated QR codes
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Count selector */}
          <div className="flex items-center gap-4">
            <Label htmlFor="count" className="shrink-0">How many:</Label>
            <Input
              id="count"
              type="number"
              min={1}
              max={50}
              value={count}
              onChange={(e) => setCount(Math.max(1, Math.min(50, parseInt(e.target.value) || 1)))}
              className="w-24"
            />
            <Button onClick={handleGenerate} disabled={isGenerating}>
              {isGenerating ? 'Generating...' : 'Generate'}
            </Button>
          </div>

          {/* URLs list */}
          {urls.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Generated URLs ({urls.length})</Label>
                <span className="text-xs text-muted-foreground">~{urls[0]?.url.length} chars each</span>
              </div>
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {urls.map((data, index) => (
                  <div key={index} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-semibold">{data.name}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6"
                        onClick={() => handleCopy(data.url, index)}
                      >
                        {copiedIndex === index ? (
                          <>
                            <Check className="h-3 w-3 text-green-600 mr-1" />
                            <span className="text-xs">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3 mr-1" />
                            <span className="text-xs">Copy</span>
                          </>
                        )}
                      </Button>
                    </div>
                    <code className="block text-[10px] bg-muted px-2 py-1.5 rounded break-all font-mono">
                      {data.url}
                    </code>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

