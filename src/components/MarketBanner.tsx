/**
 * Promotional banner for the Big Ole Queer Market (BOQM) x Treasures event.
 *
 * Shown on the Home page to point visitors at the /boqm landing page, which
 * carries the live adventure CTA, venue map, ticket links, and door-prize
 * voucher for the Austin event (Sat June 6 & Sun June 7, 2026).
 *
 * The banner follows the festive rainbow styling of the BOQM page rather than
 * the muted `bg-primary/5` callout used elsewhere, so it reads as a special
 * event invite. Honors the `adventure:` theme prefix for visual consistency.
 */

import { ArrowRight, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

export interface MarketBannerProps {
  className?: string;
}

export function MarketBanner({ className }: MarketBannerProps) {
  return (
    <Link
      to="/boqm"
      className={cn(
        "group relative block overflow-hidden border-y border-white/20",
        "bg-[linear-gradient(90deg,#e40303_0%,#ff8c00_20%,#ffed00_40%,#008026_60%,#004dff_80%,#750787_100%)]",
        "px-4 py-4 text-center transition-opacity hover:opacity-95",
        className,
      )}
      role="banner"
      aria-label="Big Ole Queer Market x Treasures — this weekend in Austin"
    >
      {/* Center scrim — darkens only the middle so the text stays readable
          while the full rainbow shows at the edges. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_120%_at_center,rgba(0,0,0,0.45)_0%,rgba(0,0,0,0.25)_45%,transparent_75%)]"
      />

      <div className="relative flex flex-col items-center justify-center gap-2 [text-shadow:0_1px_4px_rgba(0,0,0,0.6)]">
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Sparkles className="h-6 w-6 shrink-0 text-white drop-shadow" />
          <span className="inline-flex items-center gap-1 rounded-full bg-black/40 px-2.5 py-1 text-xs font-extrabold uppercase tracking-wide text-white backdrop-blur-sm">
            This Weekend
          </span>
          <p className="text-lg font-extrabold text-white sm:text-2xl">
            Big Ole Queer Market × Treasures
          </p>
        </div>

        <p className="text-sm font-semibold text-white/95 sm:text-base">
          June 6–7 · Palmer Event Center, Austin · live treasure adventure inside
        </p>

        <span className="mt-1 inline-flex items-center gap-1.5 text-sm font-extrabold text-white sm:text-base">
          Explore the event
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  );
}
