import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Crosshair } from 'lucide-react';
import { useCompass, formatCompassDistance, getBearingLabel } from '@/hooks/useCompass';
import { computeNearbyTargets, type RadarTarget } from '@/hooks/useRadarCompass';
import { CompassOverlay } from '@/components/CompassOverlay';
import { hapticBlipLock, hapticCompassActivated } from '@/utils/haptics';
import type { Geocache } from '@/types/geocache';

interface RadarCompassProps {
  geocaches: Geocache[];
  onClose: () => void;
  className?: string;
}

// ── Constants ───────────────────────────────────────────────────

const MIN_BLIPS = 5;
const MAX_BLIPS = 10;
const CENTER = 120;
const BLIP_RADIUS = 105;

// ── SVG sub-components ──────────────────────────────────────────

const CARDINAL_TICKS = [
  [120, 5, 120, 18], [120, 222, 120, 235],
  [5, 120, 18, 120], [222, 120, 235, 120],
] as const;

const MINOR_TICKS = [
  [177.5, 20.5, 173, 28.3], [219.5, 62.5, 211.7, 67],
  [219.5, 177.5, 211.7, 173], [177.5, 219.5, 173, 211.7],
  [62.5, 219.5, 67, 211.7], [20.5, 177.5, 28.3, 173],
  [20.5, 62.5, 28.3, 67], [62.5, 20.5, 67, 28.3],
] as const;

const CARDINAL_DOTS = [
  [120, 10], [120, 230], [10, 120], [230, 120],
] as const;

function ArcaneRings() {
  return (
    <>
      <circle cx={CENTER} cy={CENTER} r="115" fill="none" className="stroke-border" strokeWidth="3" />
      <circle cx={CENTER} cy={CENTER} r="108" fill="none" className="stroke-border/15" strokeWidth="0.5" />
      <circle cx={CENTER} cy={CENTER} r="102" fill="none" className="stroke-border/40" strokeWidth="1.5" />
      <circle cx={CENTER} cy={CENTER} r="96" fill="none" className="stroke-border/8" strokeWidth="0.5" />
    </>
  );
}

function ArcaneCrosshairs() {
  return (
    <>
      <line x1="120" y1="18" x2="120" y2="222" className="stroke-border/15" strokeWidth="0.75" />
      <line x1="18" y1="120" x2="222" y2="120" className="stroke-border/15" strokeWidth="0.75" />
      <line x1="39" y1="39" x2="201" y2="201" className="stroke-border/8" strokeWidth="0.5" />
      <line x1="201" y1="39" x2="39" y2="201" className="stroke-border/8" strokeWidth="0.5" />
    </>
  );
}

function ArcaneDots() {
  return (
    <>
      {CARDINAL_DOTS.map(([cx, cy], i) => (
        <circle
          key={`cd-${i}`}
          cx={cx} cy={cy} r="3"
          className="fill-border/30"
          style={{ animation: `compass-twinkle ${3 + (i % 3) * 0.7}s ease-in-out infinite ${i * 0.4}s` }}
        />
      ))}
    </>
  );
}

function ArcaneTicks() {
  return (
    <>
      {CARDINAL_TICKS.map(([x1, y1, x2, y2], i) => (
        <line key={`ct-${i}`} x1={x1} y1={y1} x2={x2} y2={y2} className="stroke-border/30" strokeWidth="1.5" strokeLinecap="round" />
      ))}
      {MINOR_TICKS.map(([x1, y1, x2, y2], i) => (
        <line key={`mt-${i}`} x1={x1} y1={y1} x2={x2} y2={y2} className="stroke-border/15" strokeWidth="1" strokeLinecap="round" />
      ))}
    </>
  );
}

function GemDefs() {
  return (
    <defs>
      <filter id="radar-gem-aura" x="-40%" y="-40%" width="180%" height="180%">
        <feGaussianBlur in="SourceGraphic" stdDeviation="6" />
      </filter>
      <linearGradient id="radar-gem-spec" x1="0.35" y1="0" x2="0.65" y2="1">
        <stop offset="0%" stopColor="white" stopOpacity="0" />
        <stop offset="8%" stopColor="white" stopOpacity="0.3" />
        <stop offset="14%" stopColor="white" stopOpacity="0.05" />
        <stop offset="30%" stopColor="white" stopOpacity="0" />
      </linearGradient>
      <clipPath id="radar-gem-clip">
        <polygon points="120,28 72,148 120,210 168,148" />
      </clipPath>
      <filter id="blip-glow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur in="SourceGraphic" stdDeviation="2" />
      </filter>
    </defs>
  );
}

function GemJewel({ rotation }: { rotation: number }) {
  return (
    <g style={{ transform: `rotate(${rotation}deg)`, transformOrigin: `${CENTER}px ${CENTER}px`, transition: 'transform 0.15s ease-out' }}>
      <polygon points="120,28 72,148 120,210 168,148" className="fill-primary/50" filter="url(#radar-gem-aura)" style={{ animation: 'compass-gem-pulse 4s ease-in-out infinite' }} />
      <polygon points="120,28 72,148 120,120" className="fill-primary" stroke="none" />
      <polygon points="120,28 168,148 120,120" className="fill-primary/85" stroke="none" />
      <polygon points="72,148 120,210 120,120" className="fill-primary/75" stroke="none" />
      <polygon points="168,148 120,210 120,120" className="fill-primary/65" stroke="none" />
      <rect x="60" y="28" width="120" height="182" fill="url(#radar-gem-spec)" clipPath="url(#radar-gem-clip)" />
      <line x1="72" y1="148" x2="120" y2="120" stroke="white" strokeOpacity="0.08" strokeWidth="0.5" />
      <line x1="168" y1="148" x2="120" y2="120" stroke="white" strokeOpacity="0.05" strokeWidth="0.5" />
      <line x1="120" y1="28" x2="120" y2="210" stroke="white" strokeOpacity="0.03" strokeWidth="0.5" />
      <line x1="72" y1="148" x2="168" y2="148" stroke="white" strokeOpacity="0.03" strokeWidth="0.5" />
      <polygon points="120,28 72,148 120,210 168,148" fill="none" className="stroke-primary" strokeWidth="2" strokeLinejoin="round" />
    </g>
  );
}

// ── Radar blips ─────────────────────────────────────────────────

function blipPosition(angleDeg: number, radius: number = BLIP_RADIUS): { x: number; y: number } {
  const rad = (angleDeg - 90) * (Math.PI / 180);
  return { x: CENTER + radius * Math.cos(rad), y: CENTER + radius * Math.sin(rad) };
}

function RadarBlip({ angle, index, isLockedOn, onTap }: {
  target: RadarTarget; angle: number; index: number; isLockedOn: boolean; onTap: () => void;
}) {
  const pos = blipPosition(angle);
  const size = isLockedOn ? 7 : 4.5;
  const delay = index * 0.3;

  return (
    <g onClick={(e) => { e.stopPropagation(); onTap(); }} style={{ cursor: 'pointer' }}>
      <circle cx={pos.x} cy={pos.y} r={14} fill="transparent" />
      <circle cx={pos.x} cy={pos.y} r={size + 2} className={isLockedOn ? 'fill-primary/50' : 'fill-primary/20'} filter="url(#blip-glow)" style={{ animation: `radar-blip-pulse 2s ease-in-out infinite ${delay}s` }} />
      <circle cx={pos.x} cy={pos.y} r={size} className={isLockedOn ? 'fill-primary' : 'fill-primary/70'} stroke="white" strokeWidth={isLockedOn ? 2 : 0.75} strokeOpacity={isLockedOn ? 0.9 : 0.6} style={{ animation: `radar-blip-pulse 2s ease-in-out infinite ${delay}s` }} />
      {isLockedOn && (
        <circle cx={pos.x} cy={pos.y} r={size + 5} fill="none" className="stroke-primary/60" strokeWidth="1" strokeDasharray="3 3" />
      )}
    </g>
  );
}

// ── Inline keyframes ────────────────────────────────────────────

const RADAR_STYLES = `
@keyframes compass-twinkle {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}
@keyframes compass-gem-pulse {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 0.7; }
}
@keyframes radar-blip-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
`;

// ── Main component ──────────────────────────────────────────────

export function RadarCompass({ geocaches, onClose, className }: RadarCompassProps) {
  const { t } = useTranslation();
  const userPositionRef = useRef<{ lat: number; lng: number } | null>(null);
  const [lockedOnDTag, setLockedOnDTag] = useState<string | null>(null);
  const [userPosition, setUserPosition] = useState<{ lat: number; lng: number } | null>(null);

  // GPS watch
  useEffect(() => {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserPosition(loc);
        userPositionRef.current = loc;
      },
      () => {},
      { enableHighAccuracy: false, timeout: 5000, maximumAge: 60000 }
    );

    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserPosition(loc);
        userPositionRef.current = loc;
      },
      () => {},
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 2000 }
    );

    return () => navigator.geolocation.clearWatch(id);
  }, []);

  // Nearby targets
  const allTargets = useMemo(() => {
    if (!userPosition) return [];
    return computeNearbyTargets(userPosition.lat, userPosition.lng, geocaches, MAX_BLIPS);
  }, [userPosition, geocaches]);

  const radarTargets = useMemo(() => {
    if (allTargets.length <= MIN_BLIPS) return allTargets;
    return allTargets;
  }, [allTargets]);

  // Active target (locked or nearest)
  const activeTarget = useMemo(() => {
    if (lockedOnDTag) {
      const locked = radarTargets.find(t => t.geocache.dTag === lockedOnDTag);
      if (locked) return locked;
    }
    return radarTargets[0] ?? null;
  }, [radarTargets, lockedOnDTag]);

  // Compass pointing at active target
  const compassTarget = activeTarget?.geocache.location ?? null;
  const compass = useCompass(compassTarget);

  // Start compass on mount
  const wasActiveRef = useRef(false);
  useEffect(() => {
    compass.startTracking();
    return () => { compass.stopTracking(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Haptic on first GPS lock
  useEffect(() => {
    if (compass.isActive && !wasActiveRef.current) {
      hapticCompassActivated();
    }
    wasActiveRef.current = compass.isActive;
  }, [compass.isActive]);

  const handleClose = useCallback(() => {
    compass.stopTracking();
    onClose();
  }, [compass, onClose]);

  const handleBlipTap = useCallback((dTag: string) => {
    hapticBlipLock();
    setLockedOnDTag(prev => prev === dTag ? null : dTag);
  }, []);

  const rotation = compass.arrowRotation ?? 0;
  const heading = compass.heading;
  const isLocating = compass.isLocating || (!compass.isActive && !compass.error && !compass.sensorError);
  const isLockedOn = lockedOnDTag !== null;

  const blipAngles = useMemo(() => {
    return radarTargets.map(t => {
      return heading !== null ? (t.bearing - heading + 360) % 360 : t.bearing;
    });
  }, [radarTargets, heading]);

  return (
    <CompassOverlay
      isLocating={isLocating}
      error={compass.error}
      sensorError={compass.sensorError}
      onRetry={() => compass.startTracking()}
      onClose={handleClose}
      className={className}
    >
      <style>{RADAR_STYLES}</style>

      {/* Compass SVG with radar blips */}
      <div
        role="img"
        aria-label={
          activeTarget
            ? `Radar compass: ${isLockedOn ? 'locked on' : 'nearest'} treasure is ${activeTarget.geocache.name}, ${formatCompassDistance(activeTarget.distance)} ${getBearingLabel(activeTarget.bearing)}`
            : 'Radar compass'
        }
      >
        <svg
          viewBox="0 0 240 240"
          className="h-[85vw] w-[85vw] max-h-[70vh] max-w-[70vh]"
          aria-hidden="true"
        >
          <GemDefs />
          <ArcaneRings />
          <ArcaneCrosshairs />
          <ArcaneDots />
          <ArcaneTicks />

          {radarTargets.map((target, i) => (
            <RadarBlip
              key={target.geocache.dTag}
              target={target}
              angle={blipAngles[i] ?? 0}
              index={i}
              isLockedOn={lockedOnDTag !== null && target.geocache.dTag === lockedOnDTag}
              onTap={() => handleBlipTap(target.geocache.dTag)}
            />
          ))}

          <GemJewel rotation={rotation} />
        </svg>
      </div>

      {/* Target info */}
      <div className="mt-6 flex flex-col items-center">
        {activeTarget && (
          <>
            <span className="text-4xl font-bold tabular-nums text-foreground">
              {formatCompassDistance(activeTarget.distance)}
            </span>
            <span className="text-sm text-muted-foreground mt-1">
              {getBearingLabel(activeTarget.bearing)}
            </span>
            <span className="text-xs text-muted-foreground/70 mt-2 max-w-[60vw] text-center truncate flex items-center gap-1.5">
              {isLockedOn && <Crosshair className="h-3 w-3 text-primary shrink-0" />}
              {activeTarget.geocache.name}
            </span>
          </>
        )}

        {radarTargets.length > 1 && (
          <span className="text-[10px] text-muted-foreground/50 mt-3">
            {radarTargets.length} {t('radar.nearbyCaches', 'nearby treasures')}
            {!isLockedOn && ` · ${t('radar.tapToLock', 'tap to lock on')}`}
          </span>
        )}
      </div>
    </CompassOverlay>
  );
}
