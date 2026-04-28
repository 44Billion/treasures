import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Locate, MapPinOff, Compass, RotateCcw, X, ChevronDown, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

type OverlayPhase = 'entering' | 'active' | 'exiting';

interface CompassOverlayProps {
  /** Whether the compass is still acquiring a GPS fix */
  isLocating: boolean;
  /** Error message (GPS/location errors) */
  error: string | null;
  /** Sensor-specific error (orientation/motion sensor issues) */
  sensorError?: string | null;
  /** Called to retry after an error */
  onRetry: () => void;
  /** Called to close the overlay */
  onClose: () => void;
  /** z-index class (default z-[9999]) */
  zClass?: string;
  /** Optional extra class */
  className?: string;
  /** The compass content to render when active */
  children: ReactNode;
}

/**
 * Shared full-screen overlay shell for compass modes.
 *
 * Handles enter/exit transitions, scroll lock, close button,
 * loading ("Finding you..."), and error states (GPS + sensor).
 * The caller provides compass-specific content as children.
 */
export function CompassOverlay({
  isLocating,
  error,
  sensorError,
  onRetry,
  onClose,
  zClass = 'z-[9999]',
  className,
  children,
}: CompassOverlayProps) {
  const { t } = useTranslation();
  const [phase, setPhase] = useState<OverlayPhase>('entering');
  const [helpOpen, setHelpOpen] = useState(false);

  // Entry animation
  useEffect(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setPhase('active');
      });
    });
  }, []);

  // Lock body scroll
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  const handleClose = useCallback(() => {
    setPhase('exiting');
    setTimeout(onClose, 400);
  }, [onClose]);

  const isActive = phase === 'active';

  // Determine which error to show (GPS takes priority since it blocks the compass entirely)
  const activeError = error || sensorError || null;
  const isSensorError = !error && !!sensorError;

  const closeButton = (
    <button
      onClick={handleClose}
      className="absolute top-4 right-4 z-10 p-2 rounded-full text-muted-foreground/80 hover:text-foreground transition-colors"
      style={{
        paddingTop: 'calc(0.5rem + env(safe-area-inset-top, 0px))',
        paddingRight: 'calc(0.5rem + env(safe-area-inset-right, 0px))',
      }}
    >
      <X className="h-6 w-6" />
    </button>
  );

  const backdrop = cn(
    'fixed inset-0 flex flex-col items-center justify-center',
    'bg-background/95 backdrop-blur-sm',
    'transition-opacity duration-400',
    'overflow-hidden',
    zClass,
    phase === 'entering' && 'opacity-0',
    isActive && 'opacity-100',
    phase === 'exiting' && 'opacity-0',
    className,
  );

  // Loading + error render *inside* the overlay backdrop
  return (
    <div className={backdrop}>
      {closeButton}

      {isLocating ? (
        // Loading state
        <div className="flex flex-col items-center gap-4 px-6">
          <div className="relative h-28 w-28">
            <Locate className="h-6 w-6 absolute inset-0 m-auto text-primary animate-pulse" />
            <div className="absolute inset-0 rounded-full border-2 border-primary/20 animate-ping" />
          </div>
          <p className="text-sm text-muted-foreground">{t('compass.locating', 'Finding you...')}</p>
        </div>
      ) : activeError ? (
        // Error state — contained card-like presentation
        <div className="flex flex-col items-center gap-6 px-6 max-w-sm w-full max-h-full overflow-y-auto py-12">
          {/* Error icon */}
          <div className="relative h-20 w-20">
            <div className="absolute inset-0 rounded-full bg-destructive/10" />
            {isSensorError ? (
              <Compass className="h-8 w-8 absolute inset-0 m-auto text-destructive/70" />
            ) : (
              <MapPinOff className="h-8 w-8 absolute inset-0 m-auto text-destructive/70" />
            )}
          </div>

          {/* Error title + message */}
          <div className="flex flex-col items-center gap-2 text-center">
            <h3 className="text-base font-medium text-foreground">
              {isSensorError
                ? t('compass.sensorErrorTitle', 'Compass Sensor Unavailable')
                : t('compass.locationErrorTitle', 'Location Unavailable')}
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {activeError}
            </p>
          </div>

          {/* Sensor help — expandable browser instructions */}
          {isSensorError && (
            <Collapsible open={helpOpen} onOpenChange={setHelpOpen} className="w-full">
              <CollapsibleTrigger className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-muted-foreground transition-colors w-full py-1">
                <Smartphone className="h-3 w-3" />
                <span>{t('compass.howToEnable', 'How to enable motion sensors')}</span>
                <ChevronDown className={cn('h-3 w-3 transition-transform duration-200', helpOpen && 'rotate-180')} />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-3 rounded-lg border border-border/50 bg-muted/30 p-4 text-left space-y-4">
                  <SensorHelpItem
                    browser="Chrome / Chromium / Vanadium"
                    steps={t('compass.helpChrome', 'Tap the lock or settings icon in the address bar > Site settings > Motion sensors > Allow')}
                  />
                  <SensorHelpItem
                    browser="Brave"
                    steps={t('compass.helpBrave', 'Menu (three dots) > Settings > Site settings > Motion sensors > Allow')}
                  />
                  <SensorHelpItem
                    browser="Firefox / Ironfox"
                    steps={t('compass.helpFirefox', 'Tap the padlock or shield icon in the address bar > Turn off Enhanced Tracking Protection for this site, then reload')}
                  />
                  <SensorHelpItem
                    browser="Safari (iOS)"
                    steps={t('compass.helpSafari', 'Should work automatically. If not, go to Settings > Safari > Motion & Orientation Access > enable')}
                  />
                  <div className="pt-2 border-t border-border/30">
                    <p className="text-[11px] text-muted-foreground/80 leading-relaxed">
                      {t('compass.helpAndroidNote', 'On Android, you may also need to grant sensor permissions to your browser app itself: Android Settings > Apps > [Your Browser] > Permissions')}
                    </p>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Action buttons */}
          <div className="flex gap-3">
            <Button onClick={onRetry} variant="outline" size="default" className="gap-2">
              <RotateCcw className="h-4 w-4" />
              {t('compass.tryAgain', 'Try Again')}
            </Button>
            <Button onClick={handleClose} variant="ghost" size="default">
              {t('compass.dismiss', 'Dismiss')}
            </Button>
          </div>
        </div>
      ) : (
        // Active — render compass content
        <>
          <div
            className={cn(
              'transition-all duration-700 ease-out',
              isActive ? 'opacity-100 scale-100' : 'opacity-0 scale-75',
            )}
          >
            {children}
          </div>

          {/* Stop navigating */}
          <button
            onClick={handleClose}
            className={cn(
              'absolute bottom-8 text-sm text-muted-foreground/70 hover:text-muted-foreground transition-all duration-500 delay-300',
              isActive ? 'opacity-100' : 'opacity-0',
            )}
            style={{
              paddingBottom: 'env(safe-area-inset-bottom, 0px)',
            }}
          >
            {t('compass.deactivate', 'Stop Navigating')}
          </button>
        </>
      )}
    </div>
  );
}

/** Individual browser help row */
function SensorHelpItem({ browser, steps }: { browser: string; steps: string }) {
  return (
    <div className="text-xs">
      <span className="font-medium text-foreground">{browser}</span>
      <p className="text-muted-foreground mt-0.5 leading-relaxed">{steps}</p>
    </div>
  );
}
