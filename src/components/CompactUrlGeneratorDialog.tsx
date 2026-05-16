import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Copy, Check, Link, Gift, Settings } from 'lucide-react';
import { nip19 } from 'nostr-tools';
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
import { generateVerificationKeyPair, type VerificationKeyPair } from '@/utils/verification';
import { generateCompactDTag } from '@/utils/dTag';
import { encodeCompactUrl } from '@/utils/compactUrl';
import { NIP_GC_KINDS } from '@/utils/nip-gc';
import { uniqueNamesGenerator, Config, adjectives, colors, animals } from 'unique-names-generator';
import { ProfileSearch } from '@/components/ProfileSearch';
import { WotAuthorCard } from '@/components/WotAuthorCard';

const customConfig: Config = {
  dictionaries: [adjectives, colors, animals],
  separator: '-',
  length: 3,
};

interface CompactUrlGeneratorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pubkey: string;
  selectedNpub?: string;
  onSelectNpub?: (npub: string) => void;
}

interface CompactUrlData {
  name: string;
  dTag: string;
  url: string;
  keyPair: VerificationKeyPair;
}

export function CompactUrlGeneratorDialog({
  open,
  onOpenChange,
  pubkey,
  selectedNpub = '',
  onSelectNpub,
}: CompactUrlGeneratorDialogProps) {
  const { t } = useTranslation();
  const [count, setCount] = useState(1);
  const [urls, setUrls] = useState<CompactUrlData[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [customNpub, setCustomNpub] = useState(selectedNpub);

  useEffect(() => {
    setCustomNpub(selectedNpub);
  }, [selectedNpub, open]);

  const targetPubkey = useMemo(() => {
    if (!customNpub) {
      return pubkey;
    }

    try {
      const decoded = nip19.decode(customNpub);
      if (decoded.type === 'npub') {
        return decoded.data as string;
      }
    } catch {
      // Fall back to default pubkey for invalid input.
    }

    return pubkey;
  }, [customNpub, pubkey]);

  useEffect(() => {
    // Generated links are account-bound. Clear previous output when target changes.
    setUrls([]);
    setCopiedIndex(null);
  }, [targetPubkey]);

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const generated: CompactUrlData[] = [];
      
      for (let i = 0; i < count; i++) {
        const name = uniqueNamesGenerator(customConfig);
        const dTag = generateCompactDTag();
        const keyPair = await generateVerificationKeyPair();
        const url = encodeCompactUrl(targetPubkey, dTag, keyPair.nsec, NIP_GC_KINDS.GEOCACHE);
        
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
      <DialogContent className="max-w-2xl overflow-visible">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link className="h-5 w-5" />
            {t('compactUrl.title')}
          </DialogTitle>
          <DialogDescription>
            {t('compactUrl.description')}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="border-b pb-4">
            <button
              type="button"
              onClick={() => setShowAdvanced((prev) => !prev)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
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
                  onSelect={(selectedPubkey) => {
                    const npub = nip19.npubEncode(selectedPubkey);
                    setCustomNpub(npub);
                    onSelectNpub?.(npub);
                  }}
                  placeholder={t('createCache.gift.placeholder')}
                  value={customNpub}
                />

                {customNpub && (
                  <>
                    <WotAuthorCard pubkey={customNpub} />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => {
                        setCustomNpub('');
                        onSelectNpub?.('');
                      }}
                    >
                      {t('common.reset')}
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Count selector */}
          <div className="flex items-center gap-4">
            <Label htmlFor="count" className="shrink-0">{t('compactUrl.howMany')}</Label>
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
              {isGenerating ? t('common.generating') : t('common.generate')}
            </Button>
          </div>

          {/* URLs list */}
          {urls.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">{t('compactUrl.generatedUrls', { count: urls.length })}</Label>
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
                            <Check className="h-3 w-3 text-primary mr-1" />
                            <span className="text-xs">{t('common.copied')}</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3 mr-1" />
                            <span className="text-xs">{t('common.copy')}</span>
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

