import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, CheckCircle, QrCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/shared/hooks/useToast';
import { parseVerificationFromHash } from '@/features/geocache/utils/verification';
import { DesktopHeader } from '@/components/DesktopHeader';

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

      // Check if it's pointing to treasures.to
      if (urlObj.hostname !== 'treasures.to') {
        return { isValid: false, errorKey: 'claim.error.qrMustPointToTreasures' };
      }

      // Extract naddr from pathname (should be /{naddr})
      const pathname = urlObj.pathname;
      const naddr = pathname.slice(1); // Remove leading slash

      if (!naddr || !naddr.startsWith('naddr1')) {
        return { isValid: false, errorKey: 'claim.error.invalidFormat' };
      }

      // Extract verification key from hash
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
      toast({
        title: t('claim.toast.found.title'),
        description: t('claim.toast.found.description'),
      });

      // Redirect to the cache page with verification key
      navigate(`/${validation.naddr}#verify=${validation.nsec}`);
    } else {
      const errorKey = validation.errorKey || 'claim.error.invalidUrl';
      let errorMessage = t(errorKey);
      let toastDescription = t('claim.toast.invalid.description');

      // Provide more specific guidance for common issues
      if (errorKey === 'claim.error.noVerificationKey') {
        errorMessage = t('claim.error.missingKey');
        toastDescription = t('claim.toast.invalid.missingKey');
      } else if (errorKey === 'claim.error.invalidFormat') {
        errorMessage = t('claim.error.wrongFormat');
        toastDescription = t('claim.toast.invalid.wrongFormat');
      }

      setError(errorMessage);
      setIsProcessing(false);

      toast({
        title: t('claim.toast.invalid.title'),
        description: toastDescription,
        variant: 'destructive',
      });
    }
  };

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setManualUrl(value);

    // Clear error when user starts typing
    if (error) {
      setError(null);
    }

    // Auto-submit if user pastes a complete URL
    if (value.includes('treasures.to') && value.includes('#verify=')) {
      // Small delay to let the paste complete
      setTimeout(() => {
        handleUrlSubmit(value);
      }, 100);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualUrl.trim()) {
      handleUrlSubmit(manualUrl.trim());
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50/60 via-emerald-50/50 to-teal-50/40 dark:from-slate-900 dark:via-green-950 dark:to-emerald-950 adventure:from-amber-100/80 adventure:via-yellow-50/60 adventure:to-orange-100/70">
      <DesktopHeader />

      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2 text-foreground">{t('claim.title')}</h1>
          <p className="text-muted-foreground">
            {t('claim.description')}
          </p>
        </div>

        <div className="space-y-8">
          {/* Instructional Image */}
          <div className="flex items-center justify-center">
            <img
              src="/claim-guide.png"
              alt="QR Code scanning guide"
              className="max-w-xs w-full h-auto dark:invert"
            />
          </div>

          {/* Simple Instructions */}
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold flex-shrink-0">
                1
              </div>
              <p className="text-base pt-1">
                {t('claim.step1', 'Open your camera app or QR scanner')}
              </p>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold flex-shrink-0">
                2
              </div>
              <p className="text-base pt-1">
                {t('claim.step2', 'Point it at the QR code on the geocache')}
              </p>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold flex-shrink-0">
                3
              </div>
              <p className="text-base pt-1">
                {t('claim.step3', 'Tap the notification to open the claim page')}
              </p>
            </div>
          </div>

          {/* Separator */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                {t('claim.or', 'Or')}
              </span>
            </div>
          </div>

          {/* Manual URL Entry */}
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold mb-1">
                {t('claim.manual.title', 'Enter URL Manually')}
              </h3>
              <p className="text-sm text-muted-foreground">
                {t('claim.manual.description', 'If scanning doesn\'t work, paste the URL here')}
              </p>
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
                size="lg"
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

          {/* Error display */}
          {error && (
            <Alert variant="destructive" className="border-0">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Success state */}
          {isProcessing && !error && (
            <Alert className="border-0">
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                {t('claim.alert.validating', 'Validating treasure...')}
              </AlertDescription>
            </Alert>
          )}
        </div>
      </div>
    </div>
  );
}