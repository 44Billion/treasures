import { useState, useEffect } from 'react';
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

  const validateTreasureUrl = (url: string): { isValid: boolean; naddr?: string; nsec?: string; error?: string } => {
    try {
      const urlObj = new URL(url);
      
      // Check if it's pointing to treasures.to
      if (urlObj.hostname !== 'treasures.to') {
        return { isValid: false, error: 'QR code must point to treasures.to' };
      }
      
      // Extract naddr from pathname (should be /{naddr})
      const pathname = urlObj.pathname;
      const naddr = pathname.slice(1); // Remove leading slash
      
      if (!naddr || !naddr.startsWith('naddr1')) {
        return { isValid: false, error: 'Invalid treasure URL format' };
      }
      
      // Extract verification key from hash
      const nsec = parseVerificationFromHash(urlObj.hash);
      
      if (!nsec) {
        return { isValid: false, error: 'No verification key found in QR code' };
      }
      
      return { isValid: true, naddr, nsec };
    } catch (error) {
      return { isValid: false, error: 'Invalid URL format' };
    }
  };

  const handleUrlSubmit = (url: string) => {
    setIsProcessing(true);
    setError(null);
    
    const validation = validateTreasureUrl(url);
    
    if (validation.isValid && validation.naddr && validation.nsec) {
      toast({
        title: 'Treasure found!',
        description: 'Redirecting to claim form...',
      });
      
      // Redirect to the cache page with verification key
      navigate(`/${validation.naddr}#verify=${validation.nsec}`);
    } else {
      let errorMessage = validation.error || 'Invalid URL';
      let toastDescription = validation.error || 'This URL is not a valid treasure verification link.';
      
      // Provide more specific guidance for common issues
      if (validation.error?.includes('No verification key found')) {
        errorMessage = 'URL missing verification key';
        toastDescription = 'This URL appears to be incomplete. Please make sure you copied the complete link from the QR code.';
      } else if (validation.error?.includes('Invalid treasure URL format')) {
        errorMessage = 'Invalid treasure URL';
        toastDescription = 'This URL may be outdated or incorrect. Please scan the QR code again and copy the complete link.';
      }
      
      setError(errorMessage);
      setIsProcessing(false);
      
      toast({
        title: 'Invalid URL',
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
        <h1 className="text-3xl font-bold mb-2">Claim Treasure</h1>
        <p className="text-muted-foreground">
          {isMobile 
            ? "Use your camera to scan the QR code - it will automatically detect it!"
            : "Use your phone's camera to scan the QR code, then enter the link below"
          }
        </p>
      </div>

      <div className="space-y-6">
        {/* QR Scanning Instructions */}
        <Card className="border-2 border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {isMobile ? <Smartphone className="h-5 w-5" /> : <Monitor className="h-5 w-5" />}
              {isMobile ? "Scan with Your Camera" : "Scan with Your Phone"}
            </CardTitle>
            <CardDescription>
              {isMobile 
                ? "Your camera app can automatically detect QR codes"
                : "Use your mobile device to scan the QR code"
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
                      {isMobile ? "Open your Camera app" : "Get your phone and open the Camera app"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {isMobile ? "The default camera app works best" : "Most phones have QR scanning built-in"}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold flex-shrink-0 mt-0.5">
                    2
                  </div>
                  <div>
                    <p className="font-medium text-sm">Point the camera at the QR code</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Make sure the entire QR code is visible and well-lit
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold flex-shrink-0 mt-0.5">
                    3
                  </div>
                  <div>
                    <p className="font-medium text-sm">
                      {isMobile ? "Tap the popup that appears" : "Copy the treasure link that appears"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {isMobile 
                        ? "Your phone will show a notification to open the link"
                        : "Then paste it in the form below"
                      }
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Pro Tips */}
            <div className="bg-muted/30 p-4 rounded-lg">
              <p className="font-medium text-sm mb-2">Pro Tips:</p>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• Hold your phone steady about 6-12 inches from the QR code</li>
                <li>• Make sure there's good lighting (avoid shadows and glare)</li>
                <li>• If it doesn't work immediately, try moving slightly closer or further away</li>
                {!isMobile && <li>• If scanning fails, you can manually type the URL below</li>}
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Manual URL Entry - More Prominent */}
        <Card className="border-2 border-muted">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Link className="h-5 w-5" />
              {isMobile ? "Or Enter the Link Manually" : "Enter the Treasure Link"}
            </CardTitle>
            <CardDescription>
              {isMobile 
                ? "You can open the link from your phone's camera directly, or paste the URL provided here"
                : "After scanning with your phone, paste the treasure link here"
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleManualSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="treasure-url" className="text-sm font-medium">
                  Treasure Link
                </Label>
                <div className="relative">
                  <Input
                    id="treasure-url"
                    type="url"
                    placeholder="Paste the treasure link here..."
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
                      Clear
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
                    Validating treasure link...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Claim This Treasure
                  </>
                )}
              </Button>
            </form>
            
            {/* Helpful example */}
            <div className="mt-4 p-3 bg-muted/50 dark:bg-muted rounded-lg">
              <p className="text-xs font-medium text-muted-foreground mb-1">
                The link should look like this:
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
              QR code detected! Validating treasure...
            </AlertDescription>
          </Alert>
        )}
      
      </div>
      </div>
    </div>
  );
}