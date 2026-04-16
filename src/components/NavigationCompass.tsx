import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Locate, ShieldAlert, RotateCcw, X } from 'lucide-react';
import { useCompass, formatCompassDistance, getBearingLabel } from '@/hooks/useCompass';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface NavigationCompassProps {
  target: { lat: number; lng: number } | null;
  className?: string;
}

// ── Arcane ring marks (shared between dormant + active) ─────────

/** Cardinal tick data: x1,y1 -> x2,y2 */
const CARDINAL_TICKS = [
  [120, 5, 120, 18],
  [120, 222, 120, 235],
  [5, 120, 18, 120],
  [222, 120, 235, 120],
] as const;

/** Minor 30° tick data */
const MINOR_TICKS = [
  [177.5, 20.5, 173, 28.3],
  [219.5, 62.5, 211.7, 67],
  [219.5, 177.5, 211.7, 173],
  [177.5, 219.5, 173, 211.7],
  [62.5, 219.5, 67, 211.7],
  [20.5, 177.5, 28.3, 173],
  [20.5, 62.5, 28.3, 67],
  [62.5, 20.5, 67, 28.3],
] as const;

/** Cardinal dot positions */
const CARDINAL_DOTS = [
  [120, 10], [120, 230], [10, 120], [230, 120],
] as const;



// ── SVG sub-components ──────────────────────────────────────────

function ArcaneRings({ active }: { active: boolean }) {
  return (
    <>
      <circle cx="120" cy="120" r="115" fill="none" className={active ? 'stroke-border' : 'stroke-muted-foreground/15'} strokeWidth="3" />
      <circle cx="120" cy="120" r="108" fill="none" className={active ? 'stroke-border/15' : 'stroke-muted-foreground/8'} strokeWidth="0.5" />
      <circle cx="120" cy="120" r="102" fill="none" className={active ? 'stroke-border/40' : 'stroke-muted-foreground/10'} strokeWidth="1.5" />
      <circle cx="120" cy="120" r="96" fill="none" className={active ? 'stroke-border/8' : 'stroke-muted-foreground/5'} strokeWidth="0.5" />
    </>
  );
}

function ArcaneCrosshairs({ active }: { active: boolean }) {
  return (
    <>
      <line x1="120" y1="18" x2="120" y2="222" className={active ? 'stroke-border/15' : 'stroke-muted-foreground/5'} strokeWidth="0.75" />
      <line x1="18" y1="120" x2="222" y2="120" className={active ? 'stroke-border/15' : 'stroke-muted-foreground/5'} strokeWidth="0.75" />
      <line x1="39" y1="39" x2="201" y2="201" className={active ? 'stroke-border/8' : 'stroke-muted-foreground/3'} strokeWidth="0.5" />
      <line x1="201" y1="39" x2="39" y2="201" className={active ? 'stroke-border/8' : 'stroke-muted-foreground/3'} strokeWidth="0.5" />
    </>
  );
}

function ArcaneDots({ active, twinkle = false }: { active: boolean; twinkle?: boolean }) {
  return (
    <>
      {CARDINAL_DOTS.map(([cx, cy], i) => (
        <circle
          key={`cd-${i}`}
          cx={cx} cy={cy} r="3"
          className={active ? 'fill-border/30' : 'fill-muted-foreground/10'}
          style={twinkle ? {
            animation: `compass-twinkle ${3 + (i % 3) * 0.7}s ease-in-out infinite ${i * 0.4}s`,
          } : undefined}
        />
      ))}
    </>
  );
}

function ArcaneTicks({ active }: { active: boolean }) {
  return (
    <>
      {CARDINAL_TICKS.map(([x1, y1, x2, y2], i) => (
        <line key={`ct-${i}`} x1={x1} y1={y1} x2={x2} y2={y2} className={active ? 'stroke-border/30' : 'stroke-muted-foreground/10'} strokeWidth="1.5" strokeLinecap="round" />
      ))}
      {MINOR_TICKS.map(([x1, y1, x2, y2], i) => (
        <line key={`mt-${i}`} x1={x1} y1={y1} x2={x2} y2={y2} className={active ? 'stroke-border/15' : 'stroke-muted-foreground/7'} strokeWidth="1" strokeLinecap="round" />
      ))}
    </>
  );
}

function GemDefs() {
  return (
    <defs>
      <filter id="gem-aura" x="-40%" y="-40%" width="180%" height="180%">
        <feGaussianBlur in="SourceGraphic" stdDeviation="6" />
      </filter>
      {/* Single clean specular — sharp bright edge, fast falloff */}
      <linearGradient id="gem-spec" x1="0.35" y1="0" x2="0.65" y2="1">
        <stop offset="0%" stopColor="white" stopOpacity="0" />
        <stop offset="8%" stopColor="white" stopOpacity="0.3" />
        <stop offset="14%" stopColor="white" stopOpacity="0.05" />
        <stop offset="30%" stopColor="white" stopOpacity="0" />
      </linearGradient>
      <clipPath id="gem-clip">
        <polygon points="120,28 72,148 120,210 168,148" />
      </clipPath>
    </defs>
  );
}

function GemJewel({ rotation, animated = false }: { rotation: number; animated?: boolean }) {
  return (
    <g
      transform={`rotate(${rotation}, 120, 120)`}
      style={{ transition: 'transform 0.2s ease-out' }}
    >
      {/* Ambient aura */}
      <polygon
        points="120,28 72,148 120,210 168,148"
        className="fill-primary/50"
        filter="url(#gem-aura)"
        style={animated ? { animation: 'compass-gem-pulse 4s ease-in-out infinite' } : undefined}
      />

      {/* 4 facets — tight range for realism, not cartoon */}
      {/* Upper-left: brightest */}
      <polygon points="120,28 72,148 120,120" className="fill-primary" stroke="none" />
      {/* Upper-right: slightly darker */}
      <polygon points="120,28 168,148 120,120" className="fill-primary/85" stroke="none" />
      {/* Lower-left */}
      <polygon points="72,148 120,210 120,120" className="fill-primary/75" stroke="none" />
      {/* Lower-right: darkest */}
      <polygon points="168,148 120,210 120,120" className="fill-primary/65" stroke="none" />

      {/* One specular highlight */}
      <rect x="60" y="28" width="120" height="182" fill="url(#gem-spec)" clipPath="url(#gem-clip)" />

      {/* Facet lines — barely there */}
      <line x1="72" y1="148" x2="120" y2="120" stroke="white" strokeOpacity="0.08" strokeWidth="0.5" />
      <line x1="168" y1="148" x2="120" y2="120" stroke="white" strokeOpacity="0.05" strokeWidth="0.5" />
      <line x1="120" y1="28" x2="120" y2="210" stroke="white" strokeOpacity="0.03" strokeWidth="0.5" />
      <line x1="72" y1="148" x2="168" y2="148" stroke="white" strokeOpacity="0.03" strokeWidth="0.5" />

      {/* Outline */}
      <polygon points="120,28 72,148 120,210 168,148" fill="none" className="stroke-primary" strokeWidth="2" strokeLinejoin="round" />
    </g>
  );
}

function DormantGem() {
  return (
    <g style={{ animation: 'compass-dormant-pulse 3s ease-in-out infinite' }}>
      {/* Upper-left */}
      <polygon points="120,28 72,148 120,120" className="fill-primary/25" stroke="none" />
      {/* Upper-right */}
      <polygon points="120,28 168,148 120,120" className="fill-primary/20" stroke="none" />
      {/* Lower-left */}
      <polygon points="72,148 120,210 120,120" className="fill-primary/15" stroke="none" />
      {/* Lower-right */}
      <polygon points="168,148 120,210 120,120" className="fill-primary/10" stroke="none" />
      {/* Specular hint */}
      <rect x="60" y="28" width="120" height="182" fill="url(#gem-spec)" clipPath="url(#gem-clip)" opacity="0.4" />
      {/* Facet lines */}
      <line x1="72" y1="148" x2="120" y2="120" stroke="white" strokeOpacity="0.05" strokeWidth="0.5" />
      <line x1="168" y1="148" x2="120" y2="120" stroke="white" strokeOpacity="0.03" strokeWidth="0.5" />
      {/* Outline */}
      <polygon points="120,28 72,148 120,210 168,148" fill="none" className="stroke-primary/30" strokeWidth="2" strokeLinejoin="round" />
    </g>
  );
}

// ── Inline keyframes (scoped to this component) ─────────────────

const COMPASS_STYLES = `
@keyframes compass-twinkle {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}
@keyframes compass-gem-pulse {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 0.7; }
}
@keyframes compass-ring-draw {
  from { stroke-dashoffset: 724; }
  to { stroke-dashoffset: 0; }
}
@keyframes compass-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes compass-scale-in {
  from { opacity: 0; transform: scale(0.7); }
  to { opacity: 1; transform: scale(1); }
}
`;

// ── Main component ──────────────────────────────────────────────

/**
 * A magic compass that points toward a geocache.
 *
 * Wind Waker inspired: arcane ring with an uneven jewel pointer.
 * On mobile, activating goes full-screen immersive with animations.
 * On desktop, stays inline.
 */
export function NavigationCompass({ target, className }: NavigationCompassProps) {
  const { t } = useTranslation();
  const [isActivated, setIsActivated] = useState(false);
  const [overlayPhase, setOverlayPhase] = useState<'hidden' | 'entering' | 'active' | 'exiting'>('hidden');

  const compass = useCompass(isActivated ? target : null);

  const handleActivate = useCallback(async () => {
    setIsActivated(true);
    setOverlayPhase('entering');
    // Double-rAF to ensure entering state renders before we transition
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setOverlayPhase('active');
      });
    });
    await compass.startTracking();
  }, [compass]);

  const handleDeactivate = useCallback(() => {
    setOverlayPhase('exiting');
    setTimeout(() => {
      setIsActivated(false);
      setOverlayPhase('hidden');
      compass.stopTracking();
    }, 400);
  }, [compass]);

  // Lock body scroll on mobile when overlay is active
  useEffect(() => {
    if (overlayPhase === 'active' || overlayPhase === 'entering') {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [overlayPhase]);

  // Not activated yet — dormant
  if (!isActivated) {
    return (
      <div className={cn('flex flex-col items-center', className)}>
        <style>{COMPASS_STYLES}</style>
        <button
          onClick={handleActivate}
          className="group flex flex-col items-center gap-4 py-2 w-full"
        >
          <div className="relative h-52 w-52">
            <svg viewBox="0 0 240 240" className="h-full w-full">
              <GemDefs />
              <ArcaneRings active={false} />
              <ArcaneCrosshairs active={false} />
              <ArcaneDots active={false} />
              <ArcaneTicks active={false} />
              <DormantGem />
            </svg>
          </div>
          <div className="flex flex-col items-center gap-1">
            <span className="text-sm font-medium text-primary/80 group-hover:text-primary transition-colors">
              {t('compass.activate', 'Use Magic Compass')}
            </span>
            <span className="text-xs text-muted-foreground/60">
              {t('compass.activateHint', 'Follow the gem to the treasure')}
            </span>
          </div>
        </button>
      </div>
    );
  }

  // Error state
  if (compass.error) {
    return (
      <div className={cn('flex flex-col items-center gap-3', className)}>
        <div className="flex items-center gap-2 text-sm text-destructive">
          <ShieldAlert className="h-4 w-4 flex-shrink-0" />
          <span>{compass.error}</span>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleActivate} variant="outline" size="sm" className="gap-1.5">
            <RotateCcw className="h-3.5 w-3.5" />
            {t('compass.retry', 'Retry')}
          </Button>
          <Button onClick={handleDeactivate} variant="ghost" size="sm">
            {t('compass.dismiss', 'Dismiss')}
          </Button>
        </div>
      </div>
    );
  }

  // Loading state
  if (compass.isLocating || (!compass.isActive && !compass.error)) {
    return (
      <div className={cn('flex flex-col items-center gap-3 py-4', className)}>
        <div className="relative h-28 w-28">
          <Locate className="h-6 w-6 absolute inset-0 m-auto text-primary animate-pulse" />
          <div className="absolute inset-0 rounded-full border-2 border-primary/20 animate-ping" />
        </div>
        <p className="text-sm text-muted-foreground">{t('compass.locating', 'Finding you...')}</p>
      </div>
    );
  }

  // Active compass
  const rotation = compass.arrowRotation ?? 0;
  const distance = compass.distance;
  const bearing = compass.bearing;

  const isEntering = overlayPhase === 'entering';
  const isActive = overlayPhase === 'active';
  const isExiting = overlayPhase === 'exiting';

  const compassSvg = (size: string, animated: boolean) => (
    <div
      className="relative select-none"
      role="img"
      aria-label={
        distance !== null && bearing !== null
          ? `Pointing ${getBearingLabel(bearing)}, ${formatCompassDistance(distance)} away`
          : 'Compass'
      }
    >
      <svg
        viewBox="0 0 240 240"
        className={size}
        aria-hidden="true"
      >
        <GemDefs />
        <ArcaneRings active />
        <ArcaneCrosshairs active />
        <ArcaneDots active twinkle={animated} />
        <ArcaneTicks active />
        <GemJewel rotation={rotation} animated={animated} />
      </svg>
    </div>
  );

  const distanceInfo = distance !== null && (
    <div className="flex flex-col items-center">
      <span className={cn(
        'font-bold tabular-nums text-foreground',
        'text-2xl lg:text-2xl',
      )}>
        {formatCompassDistance(distance)}
      </span>
      {bearing !== null && (
        <span className="text-xs text-muted-foreground">
          {getBearingLabel(bearing)}
        </span>
      )}
    </div>
  );

  return (
    <>
      <style>{COMPASS_STYLES}</style>

      {/* Desktop: inline compass (hidden on mobile) */}
      <div className={cn('hidden lg:flex flex-col items-center gap-3', className)}>
        {compassSvg('h-64 w-64', false)}
        {distanceInfo}
        <button
          onClick={handleDeactivate}
          className="text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
        >
          {t('compass.deactivate', 'Stop')}
        </button>
      </div>

      {/* Mobile: full-screen immersive overlay */}
      <div
        className={cn(
          'lg:hidden fixed inset-0 z-50 flex flex-col items-center justify-center',
          'bg-background/95 backdrop-blur-sm',
          'transition-opacity duration-400',
          (isEntering) && 'opacity-0',
          (isActive) && 'opacity-100',
          (isExiting) && 'opacity-0',
        )}
      >
        {/* Close button */}
        <button
          onClick={handleDeactivate}
          className="absolute top-4 right-4 z-10 p-2 rounded-full text-muted-foreground/60 hover:text-foreground transition-colors"
          style={{
            paddingTop: 'calc(0.5rem + env(safe-area-inset-top, 0px))',
            paddingRight: 'calc(0.5rem + env(safe-area-inset-right, 0px))',
          }}
        >
          <X className="h-6 w-6" />
        </button>

        {/* Compass — centered, huge */}
        <div
          className={cn(
            'transition-all duration-700 ease-out',
            (isActive) ? 'opacity-100 scale-100' : 'opacity-0 scale-75',
          )}
        >
          {compassSvg('h-[70vw] w-[70vw] max-h-[70vh] max-w-[70vh]', true)}
        </div>

        {/* Distance — big and bold below the compass */}
        <div
          className={cn(
            'mt-6 transition-all duration-500 delay-200',
            (isActive) ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4',
          )}
        >
          {distance !== null && (
            <div className="flex flex-col items-center">
              <span className="text-4xl font-bold tabular-nums text-foreground">
                {formatCompassDistance(distance)}
              </span>
              {bearing !== null && (
                <span className="text-sm text-muted-foreground mt-1">
                  {getBearingLabel(bearing)}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Stop text at bottom */}
        <button
          onClick={handleDeactivate}
          className={cn(
            'absolute bottom-8 text-sm text-muted-foreground/50 hover:text-muted-foreground transition-all duration-500 delay-300',
            (isActive) ? 'opacity-100' : 'opacity-0',
          )}
          style={{
            paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          }}
        >
          {t('compass.deactivate', 'Stop Navigating')}
        </button>
      </div>
    </>
  );
}
