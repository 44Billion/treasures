import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  ArrowRight,
  BadgeCheck,
  Calendar,
  Clock,
  Compass,
  ExternalLink,
  Gift,
  Heart,
  MapPin,
  Ticket,
  Trophy,
} from "lucide-react";

import { BOQMWelcomeOverlay } from "@/components/BOQMWelcomeOverlay";
import { AustinTreasuresMap } from "@/components/AustinTreasuresMap";
import { DesktopHeader } from "@/components/DesktopHeader";
import { PageHero } from "@/components/PageHero";
import { Button } from "@/components/ui/button";
import { MAP_STYLES } from "@/config/mapStyles";
import { BOQM_NADDR } from "@/lib/constants";
import { useCurrentUser } from "@/hooks/useCurrentUser";

/** Palmer Event Center, Austin TX */
const VENUE = {
  name: "Palmer Event Center (Hall 1)",
  address: "900 Barton Springs Dr., Austin, TX 78704",
  lat: 30.260833,
  lng: -97.7525,
};

/**
 * Austin event runs Saturday June 6th, 2026, 12pm – 6pm Central.
 * America/Chicago is UTC-5 on that date (CDT), so doors open at 17:00 UTC.
 */
const EVENT_START_ISO = "2026-06-06T17:00:00Z";

/** Human-readable date line shown in hero + welcome overlay. */
const EVENT_DATE_LINE = "Saturday, June 6, 2026 · 12:00 PM CT";

/** Eventeny ticket URL. Centralized so the welcome overlay and the inline
 *  ticket button stay in sync if the listing changes. */
const TICKET_URL = "https://www.eventeny.com/events/ticket/?id=25617";

/** sessionStorage key for the welcome overlay dismissal flag. Per-tab so
 *  printed event QRs scanned by sequential visitors each get the overlay,
 *  but a single visitor browsing around won't see it twice. */
const WELCOME_DISMISS_KEY = "boqmWelcomeDismissed";

interface Remaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  done: boolean;
}

function getRemaining(target: number): Remaining {
  const diff = target - Date.now();
  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, done: true };
  }
  const totalSeconds = Math.floor(diff / 1000);
  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
    done: false,
  };
}

function useCountdown(isoTarget: string): Remaining {
  const targetMs = useMemo(() => new Date(isoTarget).getTime(), [isoTarget]);
  const [remaining, setRemaining] = useState(() => getRemaining(targetMs));

  useEffect(() => {
    const id = window.setInterval(() => {
      setRemaining(getRemaining(targetMs));
    }, 1000);
    return () => window.clearInterval(id);
  }, [targetMs]);

  return remaining;
}

/** Rainbow palette used for flags, ribbons, and accents. */
const FLAG_COLORS = [
  "#ff595e", // red
  "#ff924c", // orange
  "#ffca3a", // yellow
  "#8ac926", // green
  "#1982c4", // blue
  "#6a4c93", // violet
];

/**
 * Triangular pennant bunting that drapes across a horizontal span.
 * Hangs from a thin string with a gentle sway.
 */
function RibbonBunting({
  count = 14,
  className = "",
  flip = false,
}: {
  count?: number;
  className?: string;
  flip?: boolean;
}) {
  const flags = Array.from({ length: count }, (_, i) => ({
    color: FLAG_COLORS[i % FLAG_COLORS.length],
    delay: `${(i % 4) * 0.4}s`,
  }));

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none select-none ${className}`}
      style={{ transform: flip ? "scaleY(-1)" : undefined }}
    >
      <svg
        viewBox="0 0 1000 80"
        preserveAspectRatio="none"
        className="w-full h-full"
      >
        {/* Single clean drape — both ends anchored at the same height (y=6)
            with a gentle sag through the middle (peak sag y≈34). */}
        <path
          d="M 0,6 Q 500,52 1000,6"
          stroke="rgba(255,255,255,0.55)"
          strokeWidth="1.5"
          fill="none"
        />
        {flags.map((f, i) => {
          // distribute flags along the quadratic Bezier
          const t = (i + 0.5) / count;
          const x = t * 1000;
          // y on quadratic Bezier from (0,6) via control (500,52) to (1000,6)
          // y(t) = (1-t)^2 * 6 + 2(1-t)t * 52 + t^2 * 6
          const y = (1 - t) * (1 - t) * 6 + 2 * (1 - t) * t * 52 + t * t * 6;
          return (
            <g
              key={i}
              transform={`translate(${x}, ${y})`}
              style={{
                transformOrigin: `${x}px ${y}px`,
                animation: `bunting-sway 4.5s ease-in-out ${f.delay} infinite`,
              }}
            >
              <circle cx="0" cy="0" r="1.5" fill="rgba(255,255,255,0.7)" />
              <polygon
                points="-14,2 14,2 0,40"
                fill={f.color}
                stroke="rgba(0,0,0,0.18)"
                strokeWidth="0.75"
                style={{ filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.35))" }}
              />
              <polygon
                points="-10,4 -2,4 -6,22"
                fill="rgba(255,255,255,0.18)"
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/** Compact 5-flag bunting used as a section divider. */
function MiniBunting({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none select-none flex justify-center my-6 ${className}`}
    >
      <svg viewBox="0 0 200 36" className="w-40 h-8">
        <path
          d="M 4,4 Q 100,20 196,4"
          stroke="rgba(255,255,255,0.55)"
          strokeWidth="1.2"
          fill="none"
        />
        {FLAG_COLORS.slice(0, 5).map((c, i) => {
          const t = (i + 0.5) / 5;
          const x = 4 + t * 192;
          const y = t < 0.5 ? 4 + 16 * (2 * t) : 4 + 16 * (1 - 2 * (t - 0.5));
          return (
            <g key={i} transform={`translate(${x}, ${y})`}>
              <polygon
                points="-6,1 6,1 0,16"
                fill={c}
                stroke="rgba(0,0,0,0.2)"
                strokeWidth="0.5"
                style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.3))" }}
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/**
 * Gentle, continuous confetti rain across the whole viewport.
 * Fixed overlay below page content (z-[3]) and above the rainbow tint (z-[1]).
 * Uses inline keyframes so no tailwind config changes are needed.
 */
function ConfettiRain({ count = 36 }: { count?: number }) {
  // Deterministic-ish pseudo-random based on index — no flicker between renders
  const pieces = Array.from({ length: count }, (_, i) => {
    const rand = (seed: number) => {
      const x = Math.sin(i * 9973 + seed * 31) * 10000;
      return x - Math.floor(x);
    };
    const color = FLAG_COLORS[i % FLAG_COLORS.length];
    const left = rand(1) * 100; // %
    const size = 5 + rand(2) * 6; // 5–11px
    const duration = 9 + rand(3) * 7; // 9–16s
    const delay = -rand(4) * 16; // negative so they start mid-flight
    const sway = 8 + rand(5) * 14; // px sway amplitude
    const rotate = rand(6) * 360;
    const isCircle = rand(7) > 0.6;
    return { color, left, size, duration, delay, sway, rotate, isCircle, i };
  });

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[3] overflow-hidden"
    >
      <style>{`
        @keyframes boqmConfettiFall {
          0%   { transform: translate3d(0, -10vh, 0) rotate(0deg); opacity: 0; }
          8%   { opacity: 1; }
          92%  { opacity: 1; }
          100% { transform: translate3d(var(--sway), 110vh, 0) rotate(var(--end-rot)); opacity: 0; }
        }
      `}</style>
      {pieces.map((p) => (
        <span
          key={p.i}
          style={{
            position: "absolute",
            left: `${p.left}%`,
            top: 0,
            width: `${p.size}px`,
            height: `${p.size * (p.isCircle ? 1 : 1.6)}px`,
            background: p.color,
            borderRadius: p.isCircle ? "50%" : "2px",
            opacity: 0.85,
            boxShadow: "0 1px 2px rgba(0,0,0,0.2)",
            ["--sway" as never]: `${p.sway}px`,
            ["--end-rot" as never]: `${p.rotate}deg`,
            animation: `boqmConfettiFall ${p.duration}s linear ${p.delay}s infinite`,
            willChange: "transform, opacity",
          }}
        />
      ))}
    </div>
  );
}

function CountdownCell({ value, label }: { value: number; label: string }) {
  const padded = value.toString().padStart(2, "0");
  return (
    <div className="relative flex flex-col items-center min-w-[60px] md:min-w-[88px]">
      {/* warm golden halo behind the digit */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 w-[180%] h-[180%] rounded-full blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, rgba(255,210,110,0.95), rgba(255,180,70,0.6) 45%, rgba(255,170,60,0.15) 75%, rgba(255,170,60,0) 92%)",
        }}
      />
      <span
        key={padded}
        className="relative font-extrabold tabular-nums leading-none text-5xl md:text-7xl bg-clip-text text-transparent animate-[countdownTick_400ms_ease-out]"
        style={{
          backgroundImage:
            "linear-gradient(90deg, #f4a8ac 0%, #f4b97c 22%, #f0d878 42%, #a8d49a 60%, #8fb8d8 80%, #b8a6d0 100%)",
          filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.5))",
        }}
      >
        {padded}
      </span>
      <span className="relative mt-2 text-[10px] md:text-xs uppercase tracking-[0.22em] font-semibold text-white/95 [text-shadow:0_1px_3px_rgba(0,0,0,0.65)]">
        {label}
      </span>
    </div>
  );
}

/** Custom pin so the marker actually renders (Leaflet default icons need a manual setup). */
const venuePin = L.divIcon({
  className: "boqm-venue-pin",
  html: `<div style="
    width: 28px; height: 28px;
    border-radius: 50% 50% 50% 0;
    transform: rotate(-45deg);
    background: linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary)/.7));
    border: 2px solid white;
    box-shadow: 0 2px 6px rgba(0,0,0,0.35);
  "></div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 28],
  popupAnchor: [0, -26],
});

export default function BOQM() {
  const remaining = useCountdown(EVENT_START_ISO);
  const tile = MAP_STYLES.original;
  const { user } = useCurrentUser();

  // Welcome overlay state. Logged-out visitors landing on this page (often via
  // a printed event QR or BOQM social link) see a celebratory rainbow welcome
  // with the live countdown and Join / Log in / Get-ticket CTAs. Dismissal is
  // remembered in sessionStorage so the same browser tab doesn't keep showing
  // it, but a fresh tab / refresh / new visitor on the same device will see
  // it again — which is the right behavior for shared / printed QR codes.
  const [welcomeDismissed, setWelcomeDismissed] = useState(() => {
    try {
      return sessionStorage.getItem(WELCOME_DISMISS_KEY) === "1";
    } catch {
      return false;
    }
  });

  // Latch so the overlay stays mounted through the full signup flow. Signup
  // logs the user in BEFORE the profile step (so the kind 0 metadata can be
  // signed), which would otherwise flip `!user` to false and unmount the
  // overlay mid-flow — taking the profile setup with it. The overlay closes
  // itself via onAuthComplete / onDismiss instead.
  const [welcomeOpen, setWelcomeOpen] = useState(false);

  // Open the latch once when a logged-out visitor lands on the page and
  // hasn't dismissed in this session. Don't close it when `user` becomes
  // truthy — the overlay's own callbacks own that lifecycle.
  useEffect(() => {
    if (!user && !welcomeDismissed && !welcomeOpen) {
      setWelcomeOpen(true);
    }
  }, [user, welcomeDismissed, welcomeOpen]);

  const handleWelcomeDismiss = () => {
    try {
      sessionStorage.setItem(WELCOME_DISMISS_KEY, "1");
    } catch {
      // sessionStorage may be unavailable in private mode; in-memory state
      // still keeps the overlay closed for this mount.
    }
    setWelcomeDismissed(true);
    setWelcomeOpen(false);
  };

  // Re-open the welcome overlay from the inline CTA. Clears the
  // sessionStorage dismissal so the latch effect can re-trigger naturally,
  // and also opens the latch immediately for the current render.
  const handleStartQuest = () => {
    try {
      sessionStorage.removeItem(WELCOME_DISMISS_KEY);
    } catch {
      // Ignore — in-memory state below still re-opens the overlay.
    }
    setWelcomeDismissed(false);
    setWelcomeOpen(true);
  };

  const heroTitle = (
    <span className="relative block pt-20 md:pt-24">
      {/* Faded emblem behind the hero text */}
      <img
        src="/icon.svg"
        alt=""
        aria-hidden="true"
        className="pointer-events-none select-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-[10%] w-72 h-72 md:w-[28rem] md:h-[28rem] opacity-[0.22]"
        style={{
          filter: "drop-shadow(0 6px 18px rgba(0,0,0,0.45))",
        }}
      />
      <span className="relative">
        <span
          className="block text-4xl md:text-6xl font-extrabold leading-[1.05] tracking-tight bg-clip-text text-transparent"
          style={{
            backgroundImage:
              "linear-gradient(180deg, #ffffff 0%, #fff5d6 40%, #ffe093 75%, #ffc764 100%)",
            filter:
              "drop-shadow(0 2px 3px rgba(0,0,0,0.55)) drop-shadow(0 6px 18px rgba(255,170,60,0.45))",
          }}
        >
          A treasure adventure at
        </span>
        <span
          className="block mt-1 md:mt-2 text-4xl md:text-6xl font-extrabold leading-[1.05] tracking-tight bg-clip-text text-transparent"
          style={{
            backgroundImage:
              "linear-gradient(90deg, #f4a8ac 0%, #f4b97c 22%, #f0d878 42%, #a8d49a 60%, #8fb8d8 80%, #b8a6d0 100%)",
            filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.5))",
          }}
        >
          BOQM Austin
        </span>
        {/* Tagline sits inside the relative title area so it overlaps the
            faded emblem image rather than rendering below it. */}
        <span className="block mt-4 md:mt-5 text-sm md:text-base font-medium text-white max-w-xl mx-auto [text-shadow:0_1px_3px_rgba(0,0,0,0.55)]">
          Two days of 100+ LGBTQIA+ artists, makers, and small businesses,
          plus a real-world treasure adventure scattered throughout the expo.
        </span>
      </span>
    </span>
  );

  return (
    <>
      <style>{`
        @keyframes boqm-live-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(255, 62, 165, 0.55); }
          50% { box-shadow: 0 0 0 8px rgba(255, 62, 165, 0); }
        }
        @keyframes boqm-live-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.7); }
        }
      `}</style>

      {/* Logged-out welcome overlay. Driven by the `welcomeOpen` latch
          rather than `!user` so the overlay survives the login that happens
          mid-flow during signup, keeping the profile step on screen. */}
      {welcomeOpen && (
        <BOQMWelcomeOverlay
          countdown={remaining}
          dateLine={EVENT_DATE_LINE}
          ticketUrl={TICKET_URL}
          onAuthComplete={handleWelcomeDismiss}
          onDismiss={handleWelcomeDismiss}
        />
      )}

      <DesktopHeader />

      {/* Rainbow gradient overlays — sit above HeroBackground (z-0) and below PageHero content (z-10).
          Two layers blended differently to counteract the primary-green overlay baked into HeroBackground. */}
      <div
        aria-hidden="true"
        className="fixed inset-0 z-[1] pointer-events-none opacity-50"
        style={{
          background:
            "linear-gradient(135deg, #ff595e 0%, #ff924c 18%, #ffca3a 36%, #8ac926 54%, #1982c4 75%, #6a4c93 100%)",
          mixBlendMode: "screen",
        }}
      />
      <div
        aria-hidden="true"
        className="fixed inset-0 z-[1] pointer-events-none opacity-25"
        style={{
          background:
            "linear-gradient(135deg, #ff595e 0%, #ff924c 18%, #ffca3a 36%, #8ac926 54%, #1982c4 75%, #6a4c93 100%)",
          mixBlendMode: "overlay",
        }}
      />

      {/* Gentle confetti rain — sits above bg tints, below page content */}
      <ConfettiRain count={36} />

      <PageHero title={heroTitle}>
        {/* Top-edge pennant bunting — drapes across the hero, just under the header */}
        <RibbonBunting
          count={16}
          className="absolute inset-x-0 -top-2 md:top-0 h-14 md:h-20 z-[5]"
        />

        <div className="container mx-auto px-4 max-w-3xl pb-12 -mt-4 md:-mt-6">

          {/* ── Countdown ────────────────────────────────────────── */}
          <div className="mb-10">
            <div className="flex items-center justify-center gap-2 mb-4 text-xs md:text-sm font-medium uppercase tracking-[0.22em] text-white/85 [text-shadow:0_1px_3px_rgba(0,0,0,0.5)]">
              <Clock className="h-3.5 w-3.5" />
              {remaining.done ? "The adventure is on!" : "Adventure begins in"}
            </div>
            <div className="flex items-center justify-center gap-3 md:gap-6">
              <CountdownCell value={remaining.days} label="Days" />
              <CountdownCell value={remaining.hours} label="Hours" />
              <CountdownCell value={remaining.minutes} label="Minutes" />
              <CountdownCell value={remaining.seconds} label="Seconds" />
            </div>
            <p className="text-center text-xs text-white/80 mt-4 [text-shadow:0_1px_3px_rgba(0,0,0,0.5)]">
              {EVENT_DATE_LINE}
            </p>
          </div>

          <MiniBunting />

          {/* ── Live Adventure ───────────────────────────────────── */}
          <div className="rounded-xl border-2 border-primary/50 bg-card/95 backdrop-blur-sm mb-8 p-6 md:p-8 text-center shadow-lg">
            {/* Live indicator — the BOQM adventure is on now */}
            <div className="mb-4 flex justify-center">
              <span
                className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs md:text-sm font-bold uppercase tracking-[0.22em] text-white"
                style={{
                  background:
                    "linear-gradient(135deg, #ff1a4d 0%, #ff3ea5 100%)",
                  animation: "boqm-live-pulse 2.2s ease-in-out infinite",
                }}
              >
                <span
                  aria-hidden="true"
                  className="inline-block h-2.5 w-2.5 rounded-full bg-white"
                  style={{ animation: "boqm-live-dot 1.2s ease-in-out infinite" }}
                />
                Live Now
              </span>
            </div>
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/15 mb-3">
              <Compass className="h-6 w-6 text-primary" />
            </div>
            <h2 className="text-xl md:text-2xl font-bold text-foreground mb-2">
              The adventure is on!
            </h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Treasures are hidden throughout the expo right now. Open the
              adventure, grab the official map, and start finding them.
            </p>

            {/* Primary CTA — head into the live adventure */}
            <div className="flex justify-center mt-5">
              <Button asChild size="lg">
                <Link to={`/adventure/${BOQM_NADDR}`}>
                  <Compass className="h-4 w-4 mr-2" />
                  Start the Adventure
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Link>
              </Button>
            </div>

            {/* ── Prizes ───────────────────────────────────────────
                Vertical stack: a small Grand Prize callout sits on top,
                then the centerpiece Door Prize "Treasures Bucks" voucher.
                The voucher is gated on having a Treasures account, so we
                swap the footer between an "eligible" confirmation badge
                (logged in) and a soft signup prompt (logged out). */}
            <div className="mt-6 max-w-xl mx-auto flex flex-col gap-4">

              {/* Grand Prize — small, single line, no card chrome to keep
                  visual weight on the voucher below. */}
              <div className="flex items-center justify-center gap-2 text-xs md:text-sm text-foreground">
                <Trophy className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <span className="uppercase tracking-widest font-semibold text-amber-700 dark:text-amber-300">
                  Grand Prizes
                </span>
                <span className="text-muted-foreground">
                  for the weekend's best treasure finders
                </span>
              </div>

              {/* Door Prize voucher — designed as a "Treasures Bucks" coupon:
                  rainbow-tinted background, dashed border, perforated edge,
                  Treasures logo, denomination-style headline. Larger and
                  more decorated than the Grand Prize line so it pulls focus. */}
              <div className="relative rounded-2xl border-2 border-dashed border-primary/50 bg-gradient-to-br from-amber-50 via-rose-50 to-violet-50 dark:from-amber-500/10 dark:via-rose-500/10 dark:to-violet-500/10 p-5 md:p-6 shadow-md overflow-hidden">
                {/* Faded Treasures emblem in the background, like a watermark
                    on a real banknote. */}
                <img
                  src="/icon.svg"
                  alt=""
                  aria-hidden="true"
                  className="pointer-events-none select-none absolute -right-6 -bottom-6 w-40 h-40 opacity-[0.12] rotate-[-12deg]"
                />

                {/* Perforated coupon edges — left/right serrations. */}
                <div
                  aria-hidden="true"
                  className="absolute left-0 inset-y-3 w-1.5 rounded-r-full bg-[radial-gradient(circle_at_left,_hsl(var(--background))_3px,_transparent_3.5px)] bg-[length:6px_8px] bg-repeat-y"
                />
                <div
                  aria-hidden="true"
                  className="absolute right-0 inset-y-3 w-1.5 rounded-l-full bg-[radial-gradient(circle_at_right,_hsl(var(--background))_3px,_transparent_3.5px)] bg-[length:6px_8px] bg-repeat-y"
                />

                <div className="relative flex items-start gap-4">
                  {/* Logo medallion */}
                  <div className="flex-shrink-0 w-14 h-14 md:w-16 md:h-16 rounded-full bg-white shadow-inner border border-primary/30 flex items-center justify-center">
                    <img
                      src="/icon.svg"
                      alt="Treasures"
                      className="w-10 h-10 md:w-12 md:h-12"
                    />
                  </div>

                  <div className="flex-1 text-left">
                    <div className="flex items-center gap-2 mb-1">
                      <Gift className="h-4 w-4 text-primary" />
                      <span className="text-base md:text-lg font-extrabold uppercase tracking-[0.18em] text-primary">
                        Door Prize Voucher
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Show this Treasures account at the door &amp; receive your
                      1st treasure. Purchase your BOQM ticket with code{" "}
                      <span className="font-semibold text-foreground">TREASURES</span>{" "}
                      for 20% off entrance (or let them know at the door), and
                      continue the adventure inside!
                    </p>
                  </div>
                </div>

                {/* Eligibility footer */}
                <div className="relative mt-4 pt-4 border-t border-dashed border-primary/30">
                  {user ? (
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/40 px-3 py-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                      <BadgeCheck className="h-4 w-4" />
                      You're eligible. Claim your prize and discount at the door.
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">
                        Sign up for Treasures
                      </span>{" "}
                      to unlock the door prize and door discount.
                    </p>
                  )}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap justify-center gap-2 mt-5">
              {/* Logged-out visitors get the CTA that re-opens the welcome
                  overlay. Logged-in visitors get an inline Austin treasures
                  map instead (rendered below this row). The ticket button
                  lives in the Event Details → Admission block now, since
                  it's most relevant alongside pricing/parking info. */}
              {!user && (
                <Button onClick={handleStartQuest}>
                  <Compass className="h-4 w-4 mr-2" />
                  Start your Quest
                </Button>
              )}
            </div>

            {/* Logged-in warm-up: an inline map of existing treasures around
                Austin so visitors can explore alongside the official BOQM
                adventure. The map component carries its own
                "Ready to adventure now?" copy. */}
            {user && <AustinTreasuresMap />}

            {/* Logged-out visitors keep the original disclaimer footer on
                the card. Logged-in visitors see the same copy inside the
                map component instead, paired with the warm-up invitation. */}
            {!user && (
              <p className="text-[11px] text-muted-foreground/80 mt-4 max-w-md mx-auto">
                No purchase necessary. Treasures is free, open to everyone,
                and available to play anytime, anywhere.
              </p>
            )}
          </div>

          {/* ── Event Details + Map ──────────────────────────────── */}
          <div className="rounded-xl border bg-card/95 backdrop-blur-sm mb-8 overflow-hidden shadow-lg">
            <div className="grid md:grid-cols-2">

              {/* Details */}
              <div className="p-5 md:p-6 space-y-5">
                <div>
                  <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground mb-2">
                    <Calendar className="h-3.5 w-3.5" />
                    When
                  </div>
                  <ul className="text-sm text-foreground space-y-1">
                    <li><span className="font-medium">Sat, June 6, 2026</span> · 12 – 6 PM</li>
                    <li><span className="font-medium">Sun, June 7, 2026</span> · 12 – 5 PM</li>
                  </ul>
                </div>

                <div>
                  <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground mb-2">
                    <MapPin className="h-3.5 w-3.5" />
                    Where
                  </div>
                  <p className="text-sm font-medium text-foreground">{VENUE.name}</p>
                  <p className="text-sm text-muted-foreground">{VENUE.address}</p>
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${VENUE.lat},${VENUE.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 mt-1.5"
                  >
                    Get directions
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>

                <div>
                  <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground mb-2">
                    <Ticket className="h-3.5 w-3.5" />
                    Admission
                  </div>
                  <ul className="text-sm text-foreground space-y-1">
                    <li>$10 general · <span className="text-muted-foreground">free for 17 & under</span></li>
                    <li className="text-xs text-muted-foreground">Parking in Palmer garage: $12</li>
                    <li className="text-xs text-muted-foreground">Tickets also available at the door</li>
                  </ul>
                  <Button variant="outline" size="sm" asChild className="mt-3">
                    <a
                      href={TICKET_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Ticket className="h-4 w-4 mr-2" />
                      Get BOQM Ticket
                    </a>
                  </Button>
                </div>
              </div>

              {/* Map */}
              <div className="h-64 md:h-auto md:min-h-[320px] relative bg-muted">
                <MapContainer
                  center={[VENUE.lat, VENUE.lng]}
                  zoom={15}
                  scrollWheelZoom={false}
                  className="w-full h-full"
                  style={{ minHeight: "100%" }}
                >
                  <TileLayer attribution={tile.attribution} url={tile.url} />
                  <Marker position={[VENUE.lat, VENUE.lng]} icon={venuePin}>
                    <Popup>
                      <div className="text-sm">
                        <div className="font-medium">{VENUE.name}</div>
                        <div className="text-muted-foreground">{VENUE.address}</div>
                      </div>
                    </Popup>
                  </Marker>
                </MapContainer>
              </div>
            </div>
          </div>

          <MiniBunting />

          {/* ── Cross-promo: What is Treasures / BOQM ────────────── */}
          <div className="grid md:grid-cols-2 gap-4 mb-8">

            {/* Treasures */}
            <div className="rounded-xl border bg-card/95 backdrop-blur-sm p-5 md:p-6 shadow-lg">
              <div className="flex items-center gap-2 mb-2">
                <img src="/icon.svg" alt="" className="h-6 w-6" />
                <h3 className="text-lg font-semibold text-foreground">What is Treasures?</h3>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed mb-3">
                A free, open geocaching app where anyone can hide and find treasures
                in the real world. Built on Nostr, with no accounts, no ads, and no
                corporate gatekeepers. Just adventures.
              </p>
              <Button variant="outline" size="sm" asChild>
                <Link to="/about">Learn more</Link>
              </Button>
            </div>

            {/* BOQM */}
            <div className="rounded-xl border bg-card/95 backdrop-blur-sm p-5 md:p-6 shadow-lg">
              <div className="flex items-center gap-2 mb-2">
                <Heart className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-semibold text-foreground">What is BOQM?</h3>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed mb-3">
                The Big Ole Queer Market is a twice-yearly indoor expo in Austin
                spotlighting 100+ LGBTQIA+ artists and small businesses. Vendor-first,
                accessible, and unapologetically queer.
              </p>
              <Button variant="outline" size="sm" asChild>
                <a
                  href="https://bigolequeermarket.com/austin"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  bigolequeermarket.com
                </a>
              </Button>
            </div>
          </div>

        </div>
      </PageHero>
    </>
  );
}
