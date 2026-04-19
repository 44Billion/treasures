import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Locate, ShieldAlert, RotateCcw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type OverlayPhase = 'entering' | 'active' | 'exiting';

interface CompassOverlayProps {
  /** Whether the compass is still acquiring a GPS fix */
  isLocating: boolean;
  /** Error message, if any */
  error: string | null;
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
 * loading ("Finding you..."), and error states.
 * The caller provides compass-specific content as children.
 */
export function CompassOverlay({
  isLocating,
  error,
  onRetry,
  onClose,
  zClass = 'z-[9999]',
  className,
  children,
}: CompassOverlayProps) {
  const { t } = useTranslation();
  const [phase, setPhase] = useState<OverlayPhase>('entering');

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

  const closeButton = (
    <button
      onClick={handleClose}
      className="absolute top-4 right-4 z-10 p-2 rounded-full text-muted-foreground/60 hover:text-foreground transition-colors"
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
        <div className="flex flex-col items-center gap-4">
          <div className="relative h-28 w-28">
            <Locate className="h-6 w-6 absolute inset-0 m-auto text-primary animate-pulse" />
            <div className="absolute inset-0 rounded-full border-2 border-primary/20 animate-ping" />
          </div>
          <p className="text-sm text-muted-foreground">{t('compass.locating', 'Finding you...')}</p>
        </div>
      ) : error ? (
        // Error state
        <div className="flex flex-col items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-destructive">
            <ShieldAlert className="h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <div className="flex gap-2">
            <Button onClick={onRetry} variant="outline" size="sm" className="gap-1.5">
              <RotateCcw className="h-3.5 w-3.5" />
              {t('compass.retry', 'Retry')}
            </Button>
            <Button onClick={handleClose} variant="ghost" size="sm">
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
              'absolute bottom-8 text-sm text-muted-foreground/50 hover:text-muted-foreground transition-all duration-500 delay-300',
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
