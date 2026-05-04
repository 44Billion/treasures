import { useState, useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, CheckCircle, QrCode, Link as LinkIcon, ClipboardPaste, Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/useToast';
import { parseVerificationFromHash } from '@/utils/verification';
import { decodeCompactUrl, compactToNaddr } from '@/utils/compactUrl';
import { DesktopHeader } from '@/components/DesktopHeader';
import { PageHero } from '@/components/PageHero';
import { QrScanner } from '@/components/QrScanner';
import { useIsMobile } from '@/hooks/useIsMobile';

export default function Claim() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [manualUrl, setManualUrl] = useState('');
  const showScannerButton = false; // hidden for now // isMobile && isBarcodeDetectorSupported();

  // Start with the scanner already open on supported mobile devices
  const [scannerOpen, setScannerOpen] = useState(showScannerButton);

  /**
   * Accept treasures.to and any *.treasures.to subdomain (e.g. beta.treasures.to).
   */
  const isTreasuresHost = (hostname: string): boolean => {
    const h = hostname.toLowerCase();
    return h === 'treasures.to' || h.endsWith('.treasures.to');
  };

  /**
   * Validate a standard treasures.to URL with naddr + #verify= fragment.
   */
  const validateTreasureUrl = (url: string): { isValid: boolean; naddr?: string; nsec?: string; errorKey?: string } => {
    try {
      const urlObj = new URL(url);
      if (!isTreasuresHost(urlObj.hostname)) {
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
    } catch {
      return { isValid: false, errorKey: 'claim.error.invalidUrl' };
    }
  };

  /**
   * Try to handle the URL as a compact /c/ URL.
   * Returns the target nav path or null if not a compact URL.
   */
  const tryCompactUrl = (url: string): string | null => {
    try {
      const urlObj = new URL(url);
      if (!isTreasuresHost(urlObj.hostname)) return null;
      if (!urlObj.pathname.startsWith('/c/')) return null;
      const payload = urlObj.pathname.slice(3);
      const decoded = decodeCompactUrl(payload);
      if (!decoded) return null;
      const naddr = compactToNaddr(decoded.pubkey, decoded.dTag, decoded.kind);
      return `/${naddr}#verify=${decoded.nsec}`;
    } catch {
      return null;
    }
  };

  /**
   * Extract a bare naddr from a value that is either the naddr itself or a
   * treasures.to URL whose path begins with one. No verification fragment required.
   */
  const tryBareNaddr = (value: string): string | null => {
    const trimmed = value.trim();
    if (trimmed.startsWith('naddr1') && !trimmed.includes('/') && !trimmed.includes(' ')) {
      return `/${trimmed}`;
    }
    try {
      const urlObj = new URL(trimmed);
      if (!isTreasuresHost(urlObj.hostname)) return null;
      const pathname = urlObj.pathname.slice(1);
      if (pathname.startsWith('naddr1') && !urlObj.hash) {
        return `/${pathname}`;
      }
    } catch {
      // not a URL
    }
    return null;
  };

  const handleUrlSubmit = (url: string) => {
    setIsProcessing(true);
    setError(null);

    // Try compact format first
    const compactTarget = tryCompactUrl(url);
    if (compactTarget) {
      toast({ title: t('claim.toast.found.title'), description: t('claim.toast.found.description') });
      navigate(compactTarget);
      return;
    }

    // Try bare naddr / naddr-only URLs
    const bareTarget = tryBareNaddr(url);
    if (bareTarget) {
      toast({ title: t('claim.toast.found.title'), description: t('claim.toast.found.description') });
      navigate(bareTarget);
      return;
    }

    // Standard format
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

  // ─── Scan handler ──────────────────────────────────────────────────────────

  const handleScan = useCallback((raw: string) => {
    setScannerOpen(false);
    // Give the camera stream a moment to stop before navigating
    setTimeout(() => handleUrlSubmit(raw), 80);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Manual entry (debounced auto-submit) ─────────────────────────────────

  const autoSubmitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (autoSubmitTimer.current) clearTimeout(autoSubmitTimer.current);
  }, []);

  const shouldAutoSubmit = (value: string): boolean => {
    const trimmed = value.trim();
    if (!trimmed) return false;
    // Bare naddr pasted
    if (trimmed.startsWith('naddr1') && !trimmed.includes(' ')) return true;
    try {
      const u = new URL(trimmed);
      if (!isTreasuresHost(u.hostname)) return false;
      if (u.pathname.startsWith('/c/')) return true;
      if (u.pathname.slice(1).startsWith('naddr1')) return true;
    } catch {
      return false;
    }
    return false;
  };

  const scheduleAutoSubmit = (value: string) => {
    if (autoSubmitTimer.current) clearTimeout(autoSubmitTimer.current);
    if (!shouldAutoSubmit(value)) return;
    autoSubmitTimer.current = setTimeout(() => {
      autoSubmitTimer.current = null;
      handleUrlSubmit(value.trim());
    }, 400);
  };

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setManualUrl(value);
    if (error) setError(null);
    scheduleAutoSubmit(value);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (autoSubmitTimer.current) {
      clearTimeout(autoSubmitTimer.current);
      autoSubmitTimer.current = null;
    }
    if (manualUrl.trim()) handleUrlSubmit(manualUrl.trim());
  };

  return (
    <>
      <DesktopHeader />

      <PageHero
        icon={QrCode}
        title={t('claim.title')}
        description={scannerOpen ? undefined : t('claim.description')}
      >
        <div className="container mx-auto px-4 max-w-md pb-12">

          {/* ── In-app QR scanner (mobile + BarcodeDetector only) ── */}
          {showScannerButton && (
            <div className="rounded-xl border bg-card p-5 md:p-6 mb-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Camera className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    Scan QR Code
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Use your camera to scan the QR code on the geocache
                  </p>
                </div>
              </div>

              {scannerOpen ? (
                <QrScanner
                  onScan={handleScan}
                  onClose={() => setScannerOpen(false)}
                />
              ) : (
                <Button
                  className="w-full"
                  onClick={() => setScannerOpen(true)}
                  disabled={isProcessing}
                >
                  <Camera className="h-4 w-4 mr-2" />
                  Open Camera Scanner
                </Button>
              )}
            </div>
          )}

          {/* ── Instructions (only shown when scanner is not open) ── */}
          {!scannerOpen && (
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
                {(showScannerButton
                  ? [
                      { num: '1', text: 'Tap "Open Camera Scanner" above' },
                      { num: '2', text: t('claim.step2', 'Point it at the QR code on the geocache') },
                      { num: '3', text: 'The treasure will open automatically' },
                    ]
                  : [
                      { num: '1', text: t('claim.step1', 'Open your camera app or QR scanner') },
                      { num: '2', text: t('claim.step2', 'Point it at the QR code on the geocache') },
                      { num: '3', text: t('claim.step3', 'Tap the notification to open the claim page') },
                    ]
                ).map((step, i) => (
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
          )}

          {/* ── Manual URL entry ── */}
          {!scannerOpen && (
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
                    {t('claim.manual.description', "If scanning doesn't work, paste the URL here")}
                  </p>
                </div>
              </div>

              <form onSubmit={handleManualSubmit} className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    id="treasure-url"
                    type="text"
                    inputMode="url"
                    placeholder="https://treasures.to/naddr1..."
                    value={manualUrl}
                    onChange={handleUrlChange}
                    disabled={isProcessing}
                    className="font-mono text-sm"
                    autoComplete="off"
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    disabled={isProcessing}
                    className="flex-shrink-0"
                    onClick={async () => {
                      try {
                        const text = await navigator.clipboard.readText();
                        setManualUrl(text);
                        if (error) setError(null);
                        // Paste -> immediate submit if it looks valid (no debounce needed)
                        if (shouldAutoSubmit(text)) {
                          if (autoSubmitTimer.current) {
                            clearTimeout(autoSubmitTimer.current);
                            autoSubmitTimer.current = null;
                          }
                          setTimeout(() => handleUrlSubmit(text.trim()), 50);
                        }
                      } catch {
                        toast({
                          title: t('claim.toast.pasteError', 'Paste failed'),
                          description: t('claim.toast.pasteErrorDescription', 'Could not read clipboard. Try pasting manually.'),
                          variant: 'destructive',
                        });
                      }
                    }}
                    aria-label={t('claim.manual.paste', 'Paste from clipboard')}
                  >
                    <ClipboardPaste className="h-4 w-4" />
                  </Button>
                </div>
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
          )}

          {/* ── Error / Success alerts ── */}
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
