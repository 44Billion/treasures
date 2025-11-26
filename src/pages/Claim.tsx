import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Link, AlertCircle, CheckCircle, Smartphone, Monitor } from 'lucide-react';
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
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Detect if user is on mobile device
    const checkMobile = () => {
      const userAgent = navigator.userAgent.toLowerCase();
      const mobileKeywords = ['android', 'iphone', 'ipad', 'ipod', 'blackberry', 'windows phone'];
      return mobileKeywords.some(keyword => userAgent.includes(keyword));
    };
    setIsMobile(checkMobile());
  }, []);

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
        <p className="text-muted-foreground">
          {isMobile 
            ? t('claim.instructions.mobile')
            : t('claim.instructions.desktop')
          }
        </p>
      </div>

      <div className="space-y-6">
        {/* QR Scanning Instructions */}
        <Card className="border-2 border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {isMobile ? <Smartphone className="h-5 w-5" /> : <Monitor className="h-5 w-5" />}
              {isMobile ? t('claim.scan.title.mobile') : t('claim.scan.title.desktop')}
            </CardTitle>
            <CardDescription>
              {isMobile 
                ? t('claim.scan.description.mobile')
                : t('claim.scan.description.desktop')
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Visual Instructions */}
            <div className="bg-gradient-to-r from-primary/5 to-primary/10 p-6 rounded-lg">
              <div className="grid gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold flex-shrink-0 mt-0.5">
                    1
                  </div>
                  <div>
                    <p className="font-medium text-sm">
                      {isMobile ? t('claim.step1.mobile') : t('claim.step1.desktop')}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {isMobile ? t('claim.step1.hint.mobile') : t('claim.step1.hint.desktop')}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold flex-shrink-0 mt-0.5">
                    2
                  </div>
                  <div>
                    <p className="font-medium text-sm">{t('claim.step2.title')}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t('claim.step2.hint')}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold flex-shrink-0 mt-0.5">
                    3
                  </div>
                  <div>
                    <p className="font-medium text-sm">
                      {isMobile ? t('claim.step3.mobile') : t('claim.step3.desktop')}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {isMobile 
                        ? t('claim.step3.hint.mobile')
                        : t('claim.step3.hint.desktop')
                      }
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Pro Tips */}
            <div className="bg-muted/30 p-4 rounded-lg">
              <p className="font-medium text-sm mb-2">{t('claim.proTips.title')}</p>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• {t('claim.proTips.tip1')}</li>
                <li>• {t('claim.proTips.tip2')}</li>
                <li>• {t('claim.proTips.tip3')}</li>
                {!isMobile && <li>• {t('claim.proTips.tip4')}</li>}
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Manual URL Entry - More Prominent */}
        <Card className="border-2 border-muted">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Link className="h-5 w-5" />
              {isMobile ? t('claim.manual.title.mobile') : t('claim.manual.title.desktop')}
            </CardTitle>
            <CardDescription>
              {isMobile 
                ? t('claim.manual.description.mobile')
                : t('claim.manual.description.desktop')
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleManualSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="treasure-url" className="text-sm font-medium">
                  {t('claim.manual.label')}
                </Label>
                <div className="relative">
                  <Input
                    id="treasure-url"
                    type="url"
                    placeholder={t('claim.manual.placeholder')}
                    value={manualUrl}
                    onChange={handleUrlChange}
                    disabled={isProcessing}
                    className="text-base pr-20"
                    autoComplete="off"
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck="false"
                  />
                  {manualUrl && !isProcessing && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-1 top-1 h-8 px-2 text-xs"
                      onClick={() => setManualUrl('')}
                    >
                      {t('claim.manual.clear')}
                    </Button>
                  )}
                </div>
              </div>
              
              <Button
                type="submit"
                disabled={isProcessing || !manualUrl.trim()}
                className="w-full"
                size="lg"
              >
                {isProcessing ? (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2 animate-spin" />
                    {t('claim.manual.validating')}
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    {t('claim.manual.submit')}
                  </>
                )}
              </Button>
            </form>
            
            {/* Helpful example */}
            <div className="mt-4 p-3 bg-muted/50 dark:bg-muted rounded-lg">
              <p className="text-xs font-medium text-muted-foreground mb-1">
                {t('claim.manual.example')}
              </p>
              <p className="font-mono text-xs text-muted-foreground break-all">
                https://treasures.to/naddr1qqs8x...#verify=nsec1abc...
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Error display */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Success state */}
        {isProcessing && !error && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              {t('claim.alert.validating')}
            </AlertDescription>
          </Alert>
        )}
      
      </div>
      </div>
    </div>
  );
}