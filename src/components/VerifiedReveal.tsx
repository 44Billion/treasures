/**
 * VerifiedReveal
 *
 * Full-screen overlay shown when a logged-in user arrives via a valid
 * verification QR code.  Palette is derived at mount from the active theme's
 * CSS custom properties (--primary, --accent, --background, --foreground) so
 * it adapts to any theme automatically.
 *
 * Sequence (~5.5 s, rAF-driven):
 *   1. Dark backdrop fades in (darkened --background hue)
 *   2. Radial glow expands (--accent tinted)
 *   3. Rotating conic incandescence
 *   4. Treasures logo scales in with bounce, tinted warm
 *   5. Verified shield badge pops onto logo corner
 *   6. "Verified Discovery" + cache name + congrats fade up
 *   7. Warm motes twinkle
 *   8. Hold, then fade out → onComplete
 */

import { useEffect, useRef, useState, useLayoutEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ShieldCheck, UserPlus, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { hapticHeavy, hapticMedium, hapticSuccess } from '@/utils/haptics';

// ── Easing ────────────────────────────────────────────────────────────────────

const ease = {
  outQuart:   (t: number) => 1 - Math.pow(1 - t, 4),
  outQuint:   (t: number) => 1 - Math.pow(1 - t, 5),
  outBack:    (t: number) => { const c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); },
  inQuad:     (t: number) => t * t,
  inOutCubic: (t: number) =>
    t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
};

// ── Color helpers ─────────────────────────────────────────────────────────────

/** Parse "H S% L%" from a computed CSS var into [h, s, l] numbers */
function parseHSL(raw: string): [number, number, number] {
  const parts = raw.trim().split(/\s+/);
  const h = parseFloat(parts[0]) || 0;
  const s = parseFloat(parts[1]) || 0;
  const l = parseFloat(parts[2]) || 0;
  return [h, s, l];
}

function hsl(h: number, s: number, l: number, a = 1): string {
  return `hsla(${h}, ${s}%, ${l}%, ${a})`;
}

/** Build the full reveal palette from theme tokens */
function buildPalette(el: Element) {
  const cs = getComputedStyle(el);
  const get = (name: string) => cs.getPropertyValue(name).trim();

  const [pH, pS] = parseHSL(get('--primary'));
  const [aH, aS, aL] = parseHSL(get('--accent'));
  const [bH] = parseHSL(get('--background'));

  // Use accent hue for warm glow; fall back to a gold hue if accent is
  // achromatic (adventure theme has accent at 0% sat / charcoal).
  const warmH = aS > 10 ? aH : 42;
  const warmS = aS > 10 ? Math.min(aS + 20, 80) : 55;

  // Backdrop: dimmed version of the background hue (not pitch-black)
  const bdH = bH;
  const bdS = 25;

  return {
    // Backdrop
    backdropCenter: hsl(bdH, bdS, 22),
    backdropEdge:   hsl(bdH, bdS + 5, 14),

    // Glows (warm, from accent hue or gold fallback)
    glowInner:      (a: number) => hsl(warmH, warmS, 65, 0.30 * a),
    glowInnerDim:   (a: number) => hsl(warmH, warmS - 10, 55, 0.10 * a),
    glowOuter:      (a: number) => hsl(warmH, warmS - 15, 75, 0.10 * a),
    glowOuterDim:   (a: number) => hsl(warmH, warmS - 20, 60, 0.03 * a),

    // Conic gradient stops
    conicBright:    (a: number) => hsl(warmH, warmS, 68, 0.40 * a),
    conicMid:       (a: number) => hsl(warmH, warmS - 10, 75, 0.18 * a),
    conicDim:       (a: number) => hsl(warmH, warmS - 15, 70, 0.10 * a),

    // Motes
    moteWarm:       (a: number) => hsl(warmH, warmS, 65, a),
    moteCool:       (a: number) => hsl(warmH + 40, 15, 95, a),

    // Logo back-shine
    shine:          (a: number) => hsl(warmH, warmS - 10, 94, 0.50 * a),
    shineDim:       (a: number) => hsl(warmH, warmS - 15, 80, 0.15 * a),

    // Logo filter: shift hue toward the warm accent
    logoFilter:     `sepia(0.55) saturate(2.2) brightness(1.15) hue-rotate(${warmH - 50}deg) drop-shadow(0 4px 20px ${hsl(warmH, warmS, 45, 0.4)})`,

    // Badge
    badgeFrom:      hsl(warmH, warmS, 72, 0.95),
    badgeTo:        hsl(warmH - 4, warmS - 10, 58, 0.95),
    badgeShadow:    hsl(warmH, warmS - 10, 45, 0.5),
    badgeIcon:      hsl(warmH - 12, warmS, 20),

    // Text
    textLabel:      (a: number) => hsl(warmH, warmS - 20, 80, a),
    textName:       (a: number) => hsl(warmH + 8, 30, 96, a),
    textCongrats:   (a: number) => hsl(warmH, warmS - 25, 82, a),
    textShadow:     hsl(warmH, warmS - 10, 45, 0.3),

    // Primary for the badge icon color in case it's needed
    primaryH: pH,
    primaryS: pS,

    // Warm hue for the conic gradient rotation
    warmH,
    aL,
  };
}

type Palette = ReturnType<typeof buildPalette>;

// ── Motes ─────────────────────────────────────────────────────────────────────

interface Mote {
  angle: number;
  radius: number;
  size: number;
  delay: number;
  speed: number;
  warm: boolean;
}

function generateMotes(count: number): Mote[] {
  return Array.from({ length: count }, (_, i) => ({
    angle:  (i / count) * Math.PI * 2 + Math.sin(i * 2.3) * 0.4,
    radius: 90 + (i % 5) * 30 + Math.sin(i * 1.7) * 20,
    size:   3 + (i % 4) * 2,
    delay:  i / count,
    speed:  0.7 + (i % 5) * 0.2,
    warm:   i % 3 !== 0,
  }));
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface VerifiedRevealProps {
  geocacheName?: string;
  isLoggedIn: boolean;
  onComplete: () => void;
  onLogin?: () => void;
  onSignup?: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function VerifiedReveal({
  geocacheName,
  isLoggedIn,
  onComplete,
  onLogin,
  onSignup,
}: VerifiedRevealProps) {
  const { t } = useTranslation();
  const rootRef = useRef<HTMLDivElement>(null);
  const [palette, setPalette] = useState<Palette | null>(null);
  const [progress, setProgress] = useState(0);
  const [dismissing, setDismissing] = useState(false);
  const [dismissProgress, setDismissProgress] = useState(0);
  const cancelRef = useRef<(() => void) | undefined>(undefined);
  const dismissCancelRef = useRef<(() => void) | undefined>(undefined);
  const pendingCallbackRef = useRef<(() => void) | null>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const motes = useMemo(() => generateMotes(36), []);

  // Derive palette from computed CSS vars on mount
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    // Read from <html> so we get the theme's actual computed values
    setPalette(buildPalette(document.documentElement));
  }, []);

  const cleanup = useCallback(() => {
    cancelRef.current?.();
    cancelRef.current = undefined;
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  // For logged-out users, stop at ~0.60 (after congrats + buttons fade in).
  // For logged-in users, play all the way through including fadeOut.
  const stopPoint = isLoggedIn ? 1.0 : 0.60;

  // Haptic bursts fire at animation milestones. Track phase in a ref so the
  // bursts happen exactly once each — previously this lived in a useEffect
  // with progress-dependent deps that re-evaluated ~60x/sec.
  const hapticPhaseRef = useRef(0);
  const fireHaptics = useCallback((p: number) => {
    const phase = hapticPhaseRef.current;
    // The sub-ranges below match the visual sub() ranges in the render body.
    const logoIn = Math.max(0, Math.min(1, (p - 0.08) / (0.22 - 0.08)));
    const badgeIn = Math.max(0, Math.min(1, (p - 0.22) / (0.32 - 0.22)));
    const congratsIn = Math.max(0, Math.min(1, (p - 0.42) / (0.54 - 0.42)));
    // Apply the outBack easing used visually so the haptic lines up
    // roughly with when each element "pops" into view.
    const logoEased = ease.outBack(logoIn);
    const badgeEased = ease.outBack(badgeIn);
    const congratsEased = ease.outQuart(congratsIn);
    if (phase < 1 && logoEased > 0.5) {
      hapticHeavy();
      hapticPhaseRef.current = 1;
    } else if (phase < 2 && badgeEased > 0.5) {
      hapticMedium();
      hapticPhaseRef.current = 2;
    } else if (phase < 3 && congratsEased > 0.5) {
      hapticSuccess();
      hapticPhaseRef.current = 3;
    }
  }, []);

  useLayoutEffect(() => {
    const duration = 7000;
    const start = performance.now();
    let id = 0;

    const tick = (now: number) => {
      const raw = Math.min(1, (now - start) / duration);
      const eased = ease.inOutCubic(raw);
      const p = Math.min(eased, stopPoint);
      setProgress(p);
      fireHaptics(p);
      if (raw < 1 && eased < stopPoint) {
        id = requestAnimationFrame(tick);
      } else if (isLoggedIn) {
        onCompleteRef.current();
      }
      // If !isLoggedIn, we just stop -- user must interact
    };

    id = requestAnimationFrame(tick);
    cancelRef.current = () => cancelAnimationFrame(id);
    return cleanup;
  }, [cleanup, isLoggedIn, stopPoint, fireHaptics]);

  // Manual dismiss animation (used when logged-out user clicks a button)
  const triggerDismiss = useCallback((callback: () => void) => {
    if (dismissing) return;
    pendingCallbackRef.current = callback;
    setDismissing(true);

    const duration = 500;
    const start = performance.now();
    let id = 0;

    const tick = (now: number) => {
      const raw = Math.min(1, (now - start) / duration);
      setDismissProgress(ease.inQuad(raw));
      if (raw < 1) {
        id = requestAnimationFrame(tick);
      } else {
        pendingCallbackRef.current?.();
        onCompleteRef.current();
      }
    };

    id = requestAnimationFrame(tick);
    dismissCancelRef.current = () => cancelAnimationFrame(id);
  }, [dismissing]);

  useEffect(() => () => { dismissCancelRef.current?.(); }, []);

  // Phase helper
  const sub = (lo: number, hi: number) => Math.max(0, Math.min(1, (progress - lo) / (hi - lo)));

  // ── Phases ──
  const backdropIn   = ease.outQuart(sub(0.00, 0.06));
  const glowIn       = ease.outQuint(sub(0.03, 0.18));
  const conicIn      = ease.outQuart(sub(0.05, 0.20));
  const logoIn       = ease.outBack(sub(0.08, 0.22));
  const badgeIn      = ease.outBack(sub(0.22, 0.32));
  const textIn       = ease.outQuart(sub(0.26, 0.38));
  const nameIn       = ease.outQuart(sub(0.32, 0.44));
  const congratsIn   = ease.outQuart(sub(0.42, 0.54));

  // ── Haptic bursts at key animation moments ──
  // Fired directly in the rAF tick (see fireHaptics above) rather than a
  // state-derived useEffect that re-runs every frame.
  const buttonsIn    = ease.outQuart(sub(0.50, 0.60)); // logged-out only
  const motesIn      = ease.outQuart(sub(0.14, 0.30));
  const fadeOut       = isLoggedIn
    ? ease.inQuad(sub(0.78, 1.00))
    : dismissProgress; // driven by manual dismiss

  // ── Derived animation values ──
  const logoScale = 0.2 + logoIn * 0.8;
  const logoOpacity = Math.min(1, logoIn * 1.5) * (1 - fadeOut * 0.3);
  const conicRotation = progress * 120;
  const badgeScale = badgeIn < 0.7
    ? badgeIn / 0.7 * 1.25
    : 1.25 - (badgeIn - 0.7) / 0.3 * 0.25;
  const badgeOpacity = Math.min(1, badgeIn * 2) * (1 - fadeOut * 0.3);

  // Use palette, or transparent placeholders while it resolves (1 frame)
  const C = palette;

  return (
    <div
      ref={rootRef}
      className="fixed inset-0 z-[99997] overflow-hidden select-none"
      style={{
        background: C
          ? `radial-gradient(ellipse at 50% 43%, ${C.backdropCenter} 0%, ${C.backdropEdge} 100%)`
          : 'transparent',
        opacity: C ? 1 - fadeOut : 0,
        pointerEvents: fadeOut > 0.5 ? 'none' : 'auto',
      }}
    >
      {C && (
        <>
          {/* ── Warm radial glow ── */}
          <div
            className="absolute left-1/2 top-[43%] pointer-events-none"
            style={{
              width: 700,
              height: 700,
              borderRadius: '50%',
              background: `radial-gradient(circle, ${C.glowInner(1)} 0%, ${C.glowInnerDim(1)} 40%, transparent 70%)`,
              transform: `translate(-50%, -50%) scale(${0.3 + glowIn * 0.7})`,
              opacity: glowIn * (1 - fadeOut * 0.5),
              filter: 'blur(25px)',
            }}
          />

          {/* ── Wider halo ── */}
          <div
            className="absolute left-1/2 top-[43%] pointer-events-none"
            style={{
              width: 1000,
              height: 1000,
              borderRadius: '50%',
              background: `radial-gradient(circle, ${C.glowOuter(1)} 0%, ${C.glowOuterDim(1)} 50%, transparent 70%)`,
              transform: `translate(-50%, -50%) scale(${0.4 + glowIn * 0.6})`,
              opacity: glowIn * 0.6,
              filter: 'blur(35px)',
            }}
          />

          {/* ── Rotating conic incandescence ── */}
          <div
            className="absolute left-1/2 top-[43%] pointer-events-none"
            style={{
              width: 500,
              height: 500,
              transform: `translate(-50%, -50%) rotate(${conicRotation}deg) scale(${0.6 + conicIn * 0.4})`,
              opacity: conicIn * 0.55 * (1 - fadeOut * 0.6),
              background: `conic-gradient(
                from 0deg,
                ${C.conicMid(1)} 0deg,
                ${C.conicBright(1)} 45deg,
                ${C.conicMid(1)} 90deg,
                ${C.conicDim(1)} 140deg,
                ${C.conicBright(1)} 200deg,
                ${C.conicMid(1)} 260deg,
                ${C.conicDim(1)} 310deg,
                ${C.conicMid(1)} 360deg
              )`,
              borderRadius: '50%',
              filter: 'blur(25px)',
            }}
          />

          {/* ── Twinkle motes ── */}
          {motesIn > 0 && motes.map((m, i) => {
            const cycle = (progress * 3 * m.speed + m.delay) % 1;
            const pulse = Math.sin(cycle * Math.PI);
            const a = motesIn * pulse * 0.85 * (1 - fadeOut);
            if (a < 0.03) return null;

            const x = Math.cos(m.angle) * m.radius;
            const y = Math.sin(m.angle) * m.radius;

            return (
              <div
                key={i}
                className="absolute left-1/2 top-[43%] pointer-events-none"
                style={{
                  width: m.size,
                  height: m.size,
                  borderRadius: '50%',
                  transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
                  background: m.warm
                    ? `radial-gradient(circle, ${C.moteWarm(a)} 0%, transparent 70%)`
                    : `radial-gradient(circle, ${C.moteCool(a)} 0%, transparent 70%)`,
                }}
              />
            );
          })}

          {/* ── Center content ── */}
          <div
            className="absolute inset-0 flex flex-col items-center justify-center"
            style={{ paddingBottom: '8%' }}
          >
            {/* Logo + badge */}
            <div className="relative">
              {/* Back-shine */}
              <div
                className="absolute left-1/2 top-1/2 pointer-events-none"
                style={{
                  width: 240,
                  height: 240,
                  borderRadius: '50%',
                  transform: 'translate(-50%, -50%)',
                  background: `radial-gradient(circle, ${C.shine(1)} 0%, ${C.shineDim(1)} 50%, transparent 70%)`,
                  opacity: logoIn * (1 - fadeOut * 0.5),
                }}
              />

              {/* Treasures logo */}
              <img
                src="/icon.svg"
                alt=""
                style={{
                  width: 120,
                  height: 120,
                  transform: `scale(${logoScale})`,
                  opacity: logoOpacity,
                  filter: C.logoFilter,
                }}
              />

              {/* Verified badge */}
              <div
                className="absolute"
                style={{
                  bottom: -2,
                  right: -8,
                  transform: `scale(${badgeScale})`,
                  opacity: badgeOpacity,
                }}
              >
                <div
                  className="flex items-center justify-center rounded-full"
                  style={{
                    width: 36,
                    height: 36,
                    background: `linear-gradient(135deg, ${C.badgeFrom} 0%, ${C.badgeTo} 100%)`,
                    boxShadow: `0 2px 12px ${C.badgeShadow}`,
                  }}
                >
                  <ShieldCheck style={{ width: 20, height: 20, color: C.badgeIcon }} strokeWidth={2} />
                </div>
              </div>
            </div>

            {/* Text */}
            <div className="text-center mt-6 space-y-2">
              <p
                className="text-sm font-medium tracking-[0.25em] uppercase"
                style={{
                  color: C.textLabel(textIn * 0.85 * (1 - fadeOut)),
                  transform: `translateY(${(1 - textIn) * 10}px)`,
                }}
              >
                {t('reveal.verifiedDiscovery')}
              </p>
              {geocacheName && (
                <p
                  className="text-2xl font-semibold px-6"
                  style={{
                    color: C.textName(nameIn * 0.95 * (1 - fadeOut)),
                    transform: `translateY(${(1 - nameIn) * 8}px)`,
                    textShadow: `0 2px 20px ${C.textShadow}`,
                  }}
                >
                  {geocacheName}
                </p>
              )}
              <p
                className="text-base px-8"
                style={{
                  color: C.textCongrats(congratsIn * 0.75 * (1 - fadeOut)),
                  transform: `translateY(${(1 - congratsIn) * 8}px)`,
                }}
              >
                {t('reveal.congrats')}<br />{t('reveal.logYourQuest')}
              </p>

              {/* Login/Signup buttons for logged-out users */}
              {!isLoggedIn && buttonsIn > 0 && (
                <div
                  className="flex flex-col items-center gap-3 pt-4 w-full max-w-xs mx-auto"
                  style={{
                    opacity: buttonsIn * (1 - fadeOut),
                    transform: `translateY(${(1 - buttonsIn) * 12}px)`,
                  }}
                >
                  <Button
                    onClick={() => onSignup && triggerDismiss(onSignup)}
                    size="lg"
                    className="w-full rounded-full font-semibold shadow-lg"
                    style={{
                      background: `linear-gradient(135deg, ${C.badgeFrom} 0%, ${C.badgeTo} 100%)`,
                      color: C.badgeIcon,
                    }}
                  >
                    <UserPlus className="w-4 h-4 mr-2" />
                    {t('reveal.createAccount')}
                  </Button>
                  <Button
                    onClick={() => onLogin && triggerDismiss(onLogin)}
                    variant="ghost"
                    size="lg"
                    className="w-full rounded-full"
                    style={{
                      color: C.textLabel(0.8),
                      borderColor: C.textLabel(0.2),
                    }}
                  >
                    <LogIn className="w-4 h-4 mr-2" />
                    {t('reveal.login')}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
