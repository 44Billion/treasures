/**
 * BOQMWelcomeOverlay
 * ------------------
 * A modal-style welcome shown to logged-out visitors who land on the BOQM
 * Austin event page (typically by scanning a flyer QR, tapping a link in the
 * BOQM newsletter, or following a friend's share). The goal is the same as
 * AdventureWelcomeOverlay — get a complete newcomer from "what's this?" to
 * "I'm in" without leaving the BOQM context — but tuned for the event hype
 * cycle: clear rainbow imagery, a live mini-countdown right inside the card,
 * and a third CTA for grabbing a ticket.
 *
 * Surface:
 *   - Centered card over a dimmed backdrop with a rainbow header band that
 *     matches the BOQM palette (FLAG_COLORS).
 *   - Mini bunting drape across the top, plus a live D / H / M / S countdown
 *     so the modal itself feels like part of the event countdown rather than
 *     an interruption.
 *   - Body switches between four modes via internal state:
 *       'welcome' - friendly intro + Join / Log in / Get ticket CTAs
 *       'signup'  - inline <SignupFlow>
 *       'login'   - inline <LoginFlow>
 *       'howto'   - compact "how it works" explainer with Back to welcome
 *
 * Dismissibility:
 *   - "I'll look around first" link closes the overlay for the rest of this
 *     browser session (sessionStorage). Refreshing or returning later brings
 *     it back, which is right for printed event QRs scanned by many visitors.
 *
 * The overlay never shows for logged-in users; the parent gates rendering on
 * `!user`.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Compass,
  ExternalLink,
  Heart,
  HelpCircle,
  KeyRound,
  ScanQrCode,
  Sparkles,
  Ticket,
  UserPlus,
  X,
} from 'lucide-react';

import { LoginFlow } from '@/components/auth/LoginFlow';
import { SignupFlow } from '@/components/auth/SignupFlow';
import { Button } from '@/components/ui/button';

interface BOQMWelcomeOverlayProps {
  /** Live countdown values (days / hours / minutes / seconds). */
  countdown: {
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    done: boolean;
  };
  /** Human-readable date line, e.g. "Saturday, June 6, 2026 · 12:00 PM CT". */
  dateLine: string;
  /** External ticket URL (Eventeny). */
  ticketUrl: string;
  /** Called when the visitor successfully signs up or logs in. */
  onAuthComplete: () => void;
  /** Called when the visitor explicitly dismisses without authenticating. */
  onDismiss: () => void;
}

type Mode = 'welcome' | 'signup' | 'login' | 'howto';

/** Rainbow palette — kept in lockstep with BOQM.tsx FLAG_COLORS. */
const FLAG_COLORS = [
  '#ff595e', // red
  '#ff924c', // orange
  '#ffca3a', // yellow
  '#8ac926', // green
  '#1982c4', // blue
  '#6a4c93', // violet
];

/** Compact rainbow bunting that drapes across the modal header. */
function HeaderBunting() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 200 30"
      preserveAspectRatio="none"
      className="absolute inset-x-0 top-0 w-full h-7 pointer-events-none select-none"
    >
      <path
        d="M 4,3 Q 100,16 196,3"
        stroke="rgba(255,255,255,0.6)"
        strokeWidth="0.8"
        fill="none"
      />
      {Array.from({ length: 9 }, (_, i) => {
        const t = (i + 0.5) / 9;
        const x = 4 + t * 192;
        // y on quadratic Bezier from (4,3) via (100,16) to (196,3)
        const y =
          (1 - t) * (1 - t) * 3 + 2 * (1 - t) * t * 16 + t * t * 3;
        const color = FLAG_COLORS[i % FLAG_COLORS.length];
        return (
          <g key={i} transform={`translate(${x}, ${y})`}>
            <polygon
              points="-5,1 5,1 0,13"
              fill={color}
              stroke="rgba(0,0,0,0.2)"
              strokeWidth="0.4"
              style={{ filter: 'drop-shadow(0 1px 1.5px rgba(0,0,0,0.3))' }}
            />
          </g>
        );
      })}
    </svg>
  );
}

/** A single countdown digit with the same rainbow gradient as the page. */
function MiniCountdownCell({
  value,
  label,
}: {
  value: number;
  label: string;
}) {
  const padded = value.toString().padStart(2, '0');
  return (
    <div className="flex flex-col items-center min-w-[44px] min-[400px]:min-w-[60px]">
      <span
        key={padded}
        className="font-extrabold tabular-nums leading-none text-2xl min-[400px]:text-4xl bg-clip-text text-transparent"
        style={{
          backgroundImage:
            'linear-gradient(90deg, #f4a8ac 0%, #f4b97c 22%, #f0d878 42%, #a8d49a 60%, #8fb8d8 80%, #b8a6d0 100%)',
          filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.35))',
        }}
      >
        {padded}
      </span>
      <span className="mt-1 text-[9px] uppercase tracking-[0.2em] font-semibold text-white/90">
        {label}
      </span>
    </div>
  );
}

export function BOQMWelcomeOverlay({
  countdown,
  dateLine,
  ticketUrl,
  onAuthComplete,
  onDismiss,
}: BOQMWelcomeOverlayProps) {
  const [mode, setMode] = useState<Mode>('welcome');

  // Lock body scroll while the overlay is up so it feels like a true modal
  // regardless of how tall the underlying page is.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  // Anticipation copy adapts based on whether the event is upcoming or live.
  // We keep this short: the modal is a doorway, not a brochure.
  const anticipation = useMemo(() => {
    if (countdown.done) {
      return 'The treasure hunt is on right now. Join in and start finding treasures hidden across the expo.';
    }
    if (countdown.days > 7) {
      return "We're counting down to a real-world treasure hunt scattered through 100+ LGBTQIA+ artists and makers.";
    }
    if (countdown.days >= 1) {
      return 'Almost there! Join now so your treasure key is ready when the doors open.';
    }
    return 'Hours to go. Join now so you can start exploring the moment doors open.';
  }, [countdown.days, countdown.done]);

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center px-4 py-6 sm:py-10 bg-black/70 backdrop-blur-sm overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="boqm-welcome-title"
    >
      <div className="relative w-full max-w-md rounded-3xl bg-background shadow-2xl border border-border overflow-hidden my-auto">
        {/* Close button — only on the welcome step; auth steps back out via
            their own Back link. */}
        {mode === 'welcome' && (
          <button
            type="button"
            onClick={onDismiss}
            className="absolute top-3 right-3 z-20 rounded-full p-2 text-white/90 hover:text-white hover:bg-white/15 transition-colors"
            aria-label="Close"
          >
            <X className="h-6 w-6" />
          </button>
        )}

        {/* Rainbow header band with bunting + countdown. Sets the celebratory
            tone immediately so the visitor knows this is event-related, not a
            random app login prompt. */}
        <div
          className="relative px-5 sm:px-6 pt-9 pb-5"
          style={{
            background:
              'linear-gradient(135deg, #ff595e 0%, #ff924c 18%, #ffca3a 36%, #8ac926 54%, #1982c4 75%, #6a4c93 100%)',
          }}
        >
          {/* Subtle dark wash so white text stays readable across the rainbow */}
          <div
            aria-hidden="true"
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                'linear-gradient(180deg, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.15) 100%)',
            }}
          />
          <HeaderBunting />

          <div className="relative">
            <div className="flex items-center gap-2 text-[10px] min-[400px]:text-xs uppercase tracking-[0.22em] font-semibold text-white/95 [text-shadow:0_1px_3px_rgba(0,0,0,0.5)]">
              <Heart className="h-3.5 w-3.5" />
              BOQM Austin · A Treasure Hunt
            </div>
            <h2
              id="boqm-welcome-title"
              className="mt-1.5 text-xl min-[400px]:text-3xl font-extrabold leading-tight text-white [text-shadow:0_2px_4px_rgba(0,0,0,0.5)]"
            >
              {countdown.done ? 'The treasure hunt is on!' : "We're counting down!"}
            </h2>

            {!countdown.done && (
              <div className="mt-4 flex items-center justify-between gap-2 rounded-xl bg-black/25 backdrop-blur-sm px-3 py-2 border border-white/15">
                <MiniCountdownCell value={countdown.days} label="Days" />
                <MiniCountdownCell value={countdown.hours} label="Hrs" />
                <MiniCountdownCell value={countdown.minutes} label="Min" />
                <MiniCountdownCell value={countdown.seconds} label="Sec" />
              </div>
            )}

            <p className="mt-3 text-[11px] min-[400px]:text-xs text-white/90 [text-shadow:0_1px_2px_rgba(0,0,0,0.5)]">
              {dateLine}
            </p>
          </div>
        </div>

        <div className="px-5 sm:px-6 pt-5 pb-5 sm:pb-6 space-y-4">
          {mode === 'welcome' && (
            <>
              <p className="text-xs min-[400px]:text-sm text-foreground/90 leading-relaxed">
                {anticipation}
              </p>

              <ol className="text-xs min-[400px]:text-sm space-y-2 text-foreground/90">
                <li className="flex gap-2">
                  <span className="font-semibold text-primary">1.</span>
                  <span>
                    Tap{' '}
                    <UserPlus className="inline h-4 w-4 align-text-bottom text-primary" />{' '}
                    <strong>Join</strong> to forge your free treasure key.
                    Takes about a minute, no email needed.
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="font-semibold text-primary">2.</span>
                  <span>
                    Grab a{' '}
                    <Ticket className="inline h-4 w-4 align-text-bottom text-primary" />{' '}
                    <strong>BOQM ticket</strong> if you don't have one yet.
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="font-semibold text-primary">3.</span>
                  <span>
                    On event day, follow the{' '}
                    <Compass className="inline h-4 w-4 align-text-bottom text-primary" />{' '}
                    <strong>Compass</strong> to treasures hidden across the
                    expo and claim your finds.
                  </span>
                </li>
              </ol>

              <div className="flex flex-col gap-2 pt-1">
                <Button
                  size="lg"
                  className="w-full rounded-full font-semibold h-10 min-[400px]:h-11 text-sm min-[400px]:text-base"
                  onClick={() => setMode('signup')}
                >
                  <UserPlus className="h-4 w-4" />
                  Join the adventure
                </Button>

                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="w-full rounded-full font-semibold h-10 min-[400px]:h-11 text-sm min-[400px]:text-base"
                >
                  <a
                    href={ticketUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Ticket className="h-4 w-4" />
                    Get a BOQM ticket
                    <ExternalLink className="h-3.5 w-3.5 opacity-70" />
                  </a>
                </Button>

                <Button
                  size="sm"
                  variant="ghost"
                  className="w-full rounded-full text-xs min-[400px]:text-sm"
                  onClick={() => setMode('login')}
                >
                  <KeyRound className="h-3.5 w-3.5" />
                  Already have a treasure key? Log in
                </Button>
              </div>

              <div className="flex items-center justify-between !mt-1 min-[400px]:!mt-0 min-[400px]:pt-2 text-[9px] min-[400px]:text-xs text-muted-foreground gap-2 min-[400px]:gap-3">
                <button
                  type="button"
                  onClick={() => setMode('howto')}
                  className="inline-flex items-center gap-1 min-[400px]:gap-1.5 hover:text-foreground transition-colors min-h-9"
                >
                  <HelpCircle className="h-3 w-3 min-[400px]:h-5 min-[400px]:w-5" />
                  How does this work?
                </button>
                <button
                  type="button"
                  onClick={onDismiss}
                  className="inline-flex items-center gap-1 min-[400px]:gap-1.5 hover:text-foreground transition-colors min-h-9"
                >
                  <Compass className="hidden min-[400px]:inline h-5 w-5" />
                  I'll look around first
                </button>
              </div>
            </>
          )}

          {mode === 'signup' && (
            <div className="space-y-3">
              <SignupFlow onComplete={onAuthComplete} />
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setMode('welcome')}
                  className="text-[11px] min-[400px]:text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
                >
                  Back
                </button>
              </div>
            </div>
          )}

          {mode === 'login' && (
            <div className="space-y-3">
              <LoginFlow
                onLogin={onAuthComplete}
                onSignup={() => setMode('signup')}
              />
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setMode('welcome')}
                  className="text-[11px] min-[400px]:text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
                >
                  Back
                </button>
              </div>
            </div>
          )}

          {mode === 'howto' && (
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => setMode('welcome')}
                className="inline-flex items-center gap-1.5 text-xs min-[400px]:text-sm font-medium text-muted-foreground hover:text-foreground transition-colors min-h-9 -ml-1"
              >
                <ArrowLeft className="h-5 w-5" />
                Back
              </button>

              <div className="space-y-1">
                <h3 className="text-base min-[400px]:text-lg font-bold leading-tight">
                  How the BOQM Treasure Hunt works
                </h3>
                <p className="text-xs min-[400px]:text-sm text-muted-foreground">
                  Four short steps to your first find at the expo.
                </p>
              </div>

              <ol className="space-y-3">
                <li className="flex gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 pt-0.5">
                    <p className="text-xs min-[400px]:text-sm font-semibold">Forge your treasure key</p>
                    <p className="text-xs min-[400px]:text-sm text-muted-foreground">
                      A free account in about a minute. Keep your key safe;
                      it's the only way back into your adventure.
                    </p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                    <Ticket className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 pt-0.5">
                    <p className="text-xs min-[400px]:text-sm font-semibold">Come to the expo</p>
                    <p className="text-xs min-[400px]:text-sm text-muted-foreground">
                      Palmer Event Center, June 6–7. Grab a ticket and bring
                      your phone. Treasures are scattered through the booths
                      of 100+ LGBTQIA+ artists and makers.
                    </p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                    <Compass className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 pt-0.5">
                    <p className="text-xs min-[400px]:text-sm font-semibold">Follow the compass</p>
                    <p className="text-xs min-[400px]:text-sm text-muted-foreground">
                      Open the map or compass to find the closest treasure.
                      Mingle with vendors along the way. That's half the
                      fun.
                    </p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                    <ScanQrCode className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 pt-0.5">
                    <p className="text-xs min-[400px]:text-sm font-semibold">Claim your find</p>
                    <p className="text-xs min-[400px]:text-sm text-muted-foreground">
                      Scan the QR at the booth, share your story, and keep
                      exploring. Some treasures unlock prizes from the artist
                      who hid them.
                    </p>
                  </div>
                </li>
              </ol>

              <div className="space-y-2">
                <Button
                  size="lg"
                  className="w-full rounded-full font-semibold h-10 min-[400px]:h-11 text-sm min-[400px]:text-base"
                  onClick={() => setMode('signup')}
                >
                  <UserPlus className="h-4 w-4" />
                  Ready? Join the adventure
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="w-full rounded-full font-semibold h-10 min-[400px]:h-11 text-sm min-[400px]:text-base"
                >
                  <a
                    href={ticketUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Ticket className="h-4 w-4" />
                    Get a BOQM ticket
                    <ExternalLink className="h-3.5 w-3.5 opacity-70" />
                  </a>
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
