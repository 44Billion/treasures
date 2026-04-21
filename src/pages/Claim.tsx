import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, CheckCircle, QrCode, Link as LinkIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/useToast';
import { parseVerificationFromHash } from '@/utils/verification';
import { DesktopHeader } from '@/components/DesktopHeader';
import { PageHero } from '@/components/PageHero';

export default function Claim() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [manualUrl, setManualUrl] = useState('');

  const validateTreasureUrl = (url: string): { isValid: boolean; naddr?: string; nsec?: string; errorKey?: string } => {
    try {
      const urlObj = new URL(url);
      if (urlObj.hostname !== 'treasures.to') {
        return { isValid: false, errorKey: 'claim.error.qrMustPointToTreasures' };
      }
      const pathname = urlObj.pathname;
      const naddr = pathname.slice(1);
      if (!naddr || !naddr.startsWith('naddr1')) {
        return { isValid: false, errorKey: 'claim.error.invalidFormat' };
      }
      const nsec = parseVerificationFromHash(urlObj.hash);
      if (!nsec) {
        return { isValid: false, errorKey: 'claim.error.noVerificationKey' };
      }
      return { isValid: true, naddr, nsec };
    } catch (error) {
      return { isValid: false, errorKey: 'claim.error.invalidUrl' };
    }
  };

  const handleUrlSubmit = (url: string) => {
    setIsProcessing(true);
    setError(null);
    const validation = validateTreasureUrl(url);
    if (validation.isValid && validation.naddr && validation.nsec) {
      toast({ title: t('claim.toast.found.title'), description: t('claim.toast.found.description') });
      navigate(`/${validation.naddr}#verify=${validation.nsec}`);
    } else {
      const errorKey = validation.errorKey || 'claim.error.invalidUrl';
      let errorMessage = t(errorKey);
      let toastDescription = t('claim.toast.invalid.description');
      if (errorKey === 'claim.error.noVerificationKey') {
        errorMessage = t('claim.error.missingKey');
        toastDescription = t('claim.toast.invalid.missingKey');
      } else if (errorKey === 'claim.error.invalidFormat') {
        errorMessage = t('claim.error.wrongFormat');
        toastDescription = t('claim.toast.invalid.wrongFormat');
      }
      setError(errorMessage);
      setIsProcessing(false);
      toast({ title: t('claim.toast.invalid.title'), description: toastDescription, variant: 'destructive' });
    }
  };

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setManualUrl(value);
    if (error) setError(null);
    if (value.includes('treasures.to') && value.includes('#verify=')) {
      setTimeout(() => handleUrlSubmit(value), 100);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualUrl.trim()) handleUrlSubmit(manualUrl.trim());
  };

  return (
    <>
      <DesktopHeader />

      <PageHero
        icon={QrCode}
        title={t('claim.title')}
        description={t('claim.description')}
      >
        <div className="container mx-auto px-4 max-w-md pb-12">
          <div className="rounded-xl border bg-card p-5 md:p-6 mb-6">
          {/* Instructional Image */}
          <div className="flex items-center justify-center mb-6">
            <img
              src="/claim-guide.png"
              alt="QR Code scanning guide"
              className="max-w-[180px] w-full h-auto dark:invert ditto-invert"
            />
          </div>

          {/* Steps with dotted connectors */}
          <div className="space-y-0">
            {[
              { num: '1', text: t('claim.step1', 'Open your camera app or QR scanner') },
              { num: '2', text: t('claim.step2', 'Point it at the QR code on the geocache') },
              { num: '3', text: t('claim.step3', 'Tap the notification to open the claim page') },
            ].map((step, i) => (
              <div key={step.num}>
                {i > 0 && <div className="ml-[1.125rem] h-5 border-l-2 border-dashed border-primary/25" />}
                <div className="flex items-center gap-4">
                  <div className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold flex-shrink-0">
                    {step.num}
                  </div>
                  <p className="text-sm text-foreground">{step.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Manual URL card */}
        <div className="rounded-xl border bg-card p-5 md:p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
              <LinkIcon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                {t('claim.manual.title', 'Enter URL Manually')}
              </h3>
              <p className="text-xs text-muted-foreground">
                {t('claim.manual.description', 'If scanning doesn\'t work, paste the URL here')}
              </p>
            </div>
          </div>

          <form onSubmit={handleManualSubmit} className="space-y-3">
            <Input
              id="treasure-url"
              type="url"
              placeholder="https://treasures.to/naddr1..."
              value={manualUrl}
              onChange={handleUrlChange}
              disabled={isProcessing}
              className="font-mono text-sm"
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck="false"
            />
            <Button
              type="submit"
              disabled={isProcessing || !manualUrl.trim()}
              className="w-full"
            >
              {isProcessing ? (
                <>
                  <CheckCircle className="h-4 w-4 mr-2 animate-spin" />
                  {t('claim.manual.validating', 'Validating...')}
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  {t('claim.manual.submit', 'Claim Treasure')}
                </>
              )}
            </Button>
          </form>
        </div>

        {/* Error / Success */}
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {isProcessing && !error && (
          <Alert className="mb-6">
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>{t('claim.alert.validating', 'Validating treasure...')}</AlertDescription>
          </Alert>
        )}
        </div>
      </PageHero>
    </>
  );
}
