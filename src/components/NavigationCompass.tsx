import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useCompass, formatCompassDistance, getBearingLabel } from '@/hooks/useCompass';
import { CompassOverlay } from '@/components/CompassOverlay';
import { cn } from '@/lib/utils';
import { hapticCompassActivated, hapticProximityThreshold, hapticTreasureNearby, hapticMedium } from '@/utils/haptics';

interface NavigationCompassProps {
  target: { lat: number; lng: number } | null;
  className?: string;
  /** When true, auto-activates the compass on mount */
  autoActivate?: boolean;
  /** Called when the compass deactivates (user taps stop) */
  onDeactivate?: () => void;
}

// ── Arcane ring marks (shared between dormant + active) ─────────

const CARDINAL_TICKS = [
  [120, 5, 120, 18],
  [120, 222, 120, 235],
  [5, 120, 18, 120],
  [222, 120, 235, 120],
] as const;

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
      style={{
        transform: `rotate(${rotation}deg)`,
        transformOrigin: '120px 120px',
        transition: 'transform 0.15s ease-out',
      }}
    >
      <polygon
        points="120,28 72,148 120,210 168,148"
        className="fill-primary/50"
        filter="url(#gem-aura)"
        style={animated ? { animation: 'compass-gem-pulse 4s ease-in-out infinite' } : undefined}
      />
      <polygon points="120,28 72,148 120,120" className="fill-primary" stroke="none" />
      <polygon points="120,28 168,148 120,120" className="fill-primary/85" stroke="none" />
      <polygon points="72,148 120,210 120,120" className="fill-primary/75" stroke="none" />
      <polygon points="168,148 120,210 120,120" className="fill-primary/65" stroke="none" />
      <rect x="60" y="28" width="120" height="182" fill="url(#gem-spec)" clipPath="url(#gem-clip)" />
      <line x1="72" y1="148" x2="120" y2="120" stroke="white" strokeOpacity="0.08" strokeWidth="0.5" />
      <line x1="168" y1="148" x2="120" y2="120" stroke="white" strokeOpacity="0.05" strokeWidth="0.5" />
      <line x1="120" y1="28" x2="120" y2="210" stroke="white" strokeOpacity="0.03" strokeWidth="0.5" />
      <line x1="72" y1="148" x2="168" y2="148" stroke="white" strokeOpacity="0.03" strokeWidth="0.5" />
      <polygon points="120,28 72,148 120,210 168,148" fill="none" className="stroke-primary" strokeWidth="2" strokeLinejoin="round" />
    </g>
  );
}

function NearbyGem() {
  return (
    <g style={{ animation: 'compass-nearby-hover 2.5s ease-in-out infinite' }}>
      <polygon
        points="120,28 72,148 120,210 168,148"
        className="fill-primary/60"
        filter="url(#gem-aura)"
        style={{ animation: 'compass-nearby-glow 1.8s ease-in-out infinite' }}
      />
      <polygon points="120,28 72,148 120,120" className="fill-primary" stroke="none" />
      <polygon points="120,28 168,148 120,120" className="fill-primary/90" stroke="none" />
      <polygon points="72,148 120,210 120,120" className="fill-primary/80" stroke="none" />
      <polygon points="168,148 120,210 120,120" className="fill-primary/70" stroke="none" />
      <rect x="60" y="28" width="120" height="182" fill="url(#gem-spec)" clipPath="url(#gem-clip)" />
      <line x1="72" y1="148" x2="120" y2="120" stroke="white" strokeOpacity="0.12" strokeWidth="0.5" />
      <line x1="168" y1="148" x2="120" y2="120" stroke="white" strokeOpacity="0.08" strokeWidth="0.5" />
      <line x1="120" y1="28" x2="120" y2="210" stroke="white" strokeOpacity="0.05" strokeWidth="0.5" />
      <line x1="72" y1="148" x2="168" y2="148" stroke="white" strokeOpacity="0.05" strokeWidth="0.5" />
      <polygon points="120,28 72,148 120,210 168,148" fill="none" className="stroke-primary" strokeWidth="2.5" strokeLinejoin="round" />
    </g>
  );
}

function DormantGem() {
  return (
    <g style={{ animation: 'compass-dormant-pulse 3s ease-in-out infinite' }}>
      <polygon points="120,28 72,148 120,120" className="fill-primary/25" stroke="none" />
      <polygon points="120,28 168,148 120,120" className="fill-primary/20" stroke="none" />
      <polygon points="72,148 120,210 120,120" className="fill-primary/15" stroke="none" />
      <polygon points="168,148 120,210 120,120" className="fill-primary/10" stroke="none" />
      <rect x="60" y="28" width="120" height="182" fill="url(#gem-spec)" clipPath="url(#gem-clip)" opacity="0.4" />
      <line x1="72" y1="148" x2="120" y2="120" stroke="white" strokeOpacity="0.05" strokeWidth="0.5" />
      <line x1="168" y1="148" x2="120" y2="120" stroke="white" strokeOpacity="0.03" strokeWidth="0.5" />
      <polygon points="120,28 72,148 120,210 168,148" fill="none" className="stroke-primary/30" strokeWidth="2" strokeLinejoin="round" />
    </g>
  );
}

// ── Inline keyframes ────────────────────────────────────────────

const COMPASS_STYLES = `
@keyframes compass-twinkle {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}
@keyframes compass-gem-pulse {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 0.7; }
}
@keyframes compass-dormant-pulse {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 1; }
}
@keyframes compass-nearby-hover {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-6px); }
}
@keyframes compass-nearby-glow {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 1; }
}
`;

// ── Main component ──────────────────────────────────────────────

export function NavigationCompass({ target, className, autoActivate = false, onDeactivate }: NavigationCompassProps) {
  const { t } = useTranslation();
  const [isActivated, setIsActivated] = useState(autoActivate);

  const compass = useCompass(isActivated ? target : null);

  const handleActivate = useCallback(async () => {
    setIsActivated(true);
    hapticMedium();
    await compass.startTracking();
  }, [compass]);

  const handleDeactivate = useCallback(() => {
    setIsActivated(false);
    compass.stopTracking();
    onDeactivate?.();
  }, [compass, onDeactivate]);

  // Auto-activate: start tracking immediately
  useEffect(() => {
    if (autoActivate) {
      compass.startTracking();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Haptic feedback for proximity thresholds ──────────────────
  const lastThresholdRef = useRef<number | null>(null);
  const wasNearbyRef = useRef(false);
  const wasActiveRef = useRef(false);

  useEffect(() => {
    // Haptic on first GPS lock (transition to active)
    if (compass.isActive && !wasActiveRef.current) {
      hapticCompassActivated();
    }
    wasActiveRef.current = compass.isActive;
  }, [compass.isActive]);

  useEffect(() => {
    const distance = compass.distance;
    if (distance === null || !compass.isActive) return;

    // Nearby threshold (≤10m) — celebratory burst
    const isNearby = distance <= 10;
    if (isNearby && !wasNearbyRef.current) {
      hapticTreasureNearby();
    }
    wasNearbyRef.current = isNearby;

    // Distance thresholds — pulse when crossing inward
    const thresholds = [500, 200, 100, 50, 25];
    const currentThreshold = thresholds.find(t => distance <= t) ?? null;

    if (
      currentThreshold !== null &&
      currentThreshold !== lastThresholdRef.current &&
      (lastThresholdRef.current === null || currentThreshold < lastThresholdRef.current)
    ) {
      hapticProximityThreshold();
    }
    lastThresholdRef.current = currentThreshold;
  }, [compass.distance, compass.isActive]);

  // Dormant state — not yet activated
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
            <span className="text-sm font-medium text-primary group-hover:text-primary transition-colors">
              {t('compass.activate', 'Use Magic Compass')}
            </span>
            <span className="text-xs text-muted-foreground">
              {t('compass.activateHint', 'Follow the gem to the treasure')}
            </span>
          </div>
        </button>
      </div>
    );
  }

  // Active state
  const rotation = compass.arrowRotation ?? 0;
  const distance = compass.distance;
  const bearing = compass.bearing;
  const isLocating = compass.isLocating || (!compass.isActive && !compass.error && !compass.sensorError);
  const isNearby = distance !== null && distance <= 10;

  const compassSvg = (size: string, animated: boolean) => (
    <div className="relative select-none">
      <svg viewBox="0 0 240 240" className={size} aria-hidden="true">
        <GemDefs />
        <ArcaneRings active />
        <ArcaneCrosshairs active />
        <ArcaneDots active twinkle={animated} />
        <ArcaneTicks active />
        {isNearby
          ? <NearbyGem />
          : <GemJewel rotation={rotation} animated={animated} />
        }
      </svg>
    </div>
  );

  return (
    <>
      <style>{COMPASS_STYLES}</style>

      {/* Full-screen overlay compass */}
      <CompassOverlay
        isLocating={isLocating}
        error={compass.error}
        sensorError={compass.sensorError}
        onRetry={() => compass.startTracking()}
        onClose={handleDeactivate}
        zClass="z-[9999]"
      >
        {compassSvg('h-[85vw] w-[85vw] max-h-[70vh] max-w-[70vh]', true)}

        <div className="mt-6 flex flex-col items-center">
          {isNearby ? (
            <span className="text-3xl font-bold text-primary animate-pulse">
              {t('compass.nearby', 'Treasure Nearby!')}
            </span>
          ) : distance !== null ? (
            <>
              <span className="text-4xl font-bold tabular-nums text-foreground">
                {formatCompassDistance(distance)}
              </span>
              {bearing !== null && (
                <span className="text-sm text-muted-foreground mt-1">
                  {getBearingLabel(bearing)}
                </span>
              )}
            </>
          ) : null}
        </div>
      </CompassOverlay>
    </>
  );
}
