import { useTranslation } from "react-i18next";
import { HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface MysteriousMapProps {
  className?: string;
}

/**
 * Placeholder shown in place of the map for "unknown location" treasures
 * (caches published with no `g` geohash tag). Renders a deliberately
 * mysterious, foggy scene — reusing the hero's dotted treasure-map trails and
 * layering extra wavy mysticism on top — instead of leaking any coordinates.
 */
export function MysteriousMap({ className }: MysteriousMapProps) {
  const { t } = useTranslation();

  return (
    <div
      className={cn(
        "relative h-full w-full overflow-hidden",
        "bg-gradient-to-br from-indigo-950 via-slate-900 to-teal-900",
        "flex flex-col items-center justify-center text-center px-6",
        className,
      )}
      role="img"
      aria-label={t("mysteriousMap.title")}
    >
      {/* Drifting fog blobs */}
      <div
        aria-hidden
        className="absolute -left-16 -top-10 h-56 w-56 rounded-full bg-slate-400/10 blur-3xl"
      />
      <div
        aria-hidden
        className="absolute -right-10 bottom-0 h-64 w-64 rounded-full bg-indigo-400/10 blur-3xl"
      />
      <div
        aria-hidden
        className="absolute left-1/2 top-1/3 h-40 w-40 -translate-x-1/2 rounded-full bg-violet-400/10 blur-3xl"
      />

      {/* Dotted treasure-map trails (from the page hero) + extra wavy mysticism.
          Kept faint/transparent to match the hero's subtle treatment. */}
      <svg
        className="absolute inset-0 h-full w-full text-white pointer-events-none"
        viewBox="0 0 200 100"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        {/* Hero dotted trails — dashed wandering paths */}
        <g className="opacity-[0.08]">
          <path
            d="M -5,20 C 15,10 30,12 50,22 C 70,32 85,8 110,16 C 135,24 155,12 180,20 C 195,24 200,18 210,20"
            stroke="currentColor" strokeWidth="1.2" fill="none" strokeDasharray="4,3" strokeLinecap="round"
          />
          <path
            d="M -5,50 C 10,40 25,38 45,48 C 65,58 80,36 105,44 C 130,52 145,38 170,46 C 190,52 200,44 210,48"
            stroke="currentColor" strokeWidth="1" fill="none" strokeDasharray="3,4" strokeLinecap="round"
          />
          <path
            d="M -5,80 C 20,70 40,72 60,82 C 80,92 95,66 120,74 C 145,82 160,70 180,78 C 195,84 200,76 210,80"
            stroke="currentColor" strokeWidth="1.2" fill="none" strokeDasharray="4,3" strokeLinecap="round"
          />
          {/* Treasure-map X marks */}
          <g stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <line x1="137" y1="5" x2="143" y2="11" />
            <line x1="143" y1="5" x2="137" y2="11" />
            <line x1="42" y1="76" x2="48" y2="82" />
            <line x1="48" y1="76" x2="42" y2="82" />
          </g>
          <circle cx="50" cy="22" r="1.8" fill="none" stroke="currentColor" strokeWidth="0.8" />
          <circle cx="120" cy="74" r="1.8" fill="none" stroke="currentColor" strokeWidth="0.8" />
        </g>

        {/* Extra wavy mysticism — undulating swells */}
        <g className="opacity-[0.06]" stroke="currentColor" fill="none" strokeLinecap="round">
          <path d="M -5,35 Q 25,25 50,35 T 105,35 T 160,35 T 215,35" strokeWidth="0.7" />
          <path d="M -5,65 Q 25,75 50,65 T 105,65 T 160,65 T 215,65" strokeWidth="0.7" />
        </g>
      </svg>

      {/* Film-grain noise texture */}
      <svg
        className="absolute inset-0 h-full w-full pointer-events-none"
        style={{ opacity: 0.25 }}
        aria-hidden="true"
      >
        <filter id="mysterious-grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#mysterious-grain)" />
      </svg>

      <div className="relative z-10 flex flex-col items-center gap-3">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/20 backdrop-blur-sm">
          <HelpCircle className="h-9 w-9 text-white/90" />
        </div>
        <p className="text-base font-semibold text-white drop-shadow">
          {t("mysteriousMap.title")}
        </p>
        <p className="max-w-xs text-sm text-white/70">
          {t("mysteriousMap.description")}
        </p>
      </div>
    </div>
  );
}
