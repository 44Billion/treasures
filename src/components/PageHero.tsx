import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { HeroGallery } from "./HeroGallery";

interface PageHeroProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  children?: ReactNode;
}

/**
 * Full-page background with rotating hero photos, theme-aware color overlay,
 * film grain, and dotted trail SVG.
 */
export function PageHero({ icon: Icon, title, description, children }: PageHeroProps) {
  return (
    <div className="min-h-screen relative">
      {/* Rotating photo gallery + grain (reuses home hero component) */}
      <HeroGallery />

      {/* Theme-aware color overlay — sits on top of gallery's own dark gradient */}
      <div className="absolute inset-0 bg-primary/60 dark:bg-[#0a1510]/70 adventure:bg-amber-100/70 adventure:dark:bg-stone-900/80 z-[1]" />

      {/* Dotted trail SVG */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none opacity-[0.1] adventure:opacity-[0.15] z-[2]"
        viewBox="0 0 200 100"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        <path
          d="M -5,20 C 15,10 30,12 50,22 C 70,32 85,8 110,16 C 135,24 155,12 180,20 C 195,24 200,18 210,20"
          stroke="currentColor" strokeWidth="1.2" fill="none" strokeDasharray="4,3" strokeLinecap="round"
          className="text-white adventure:text-amber-800"
        />
        <path
          d="M -5,50 C 10,40 25,38 45,48 C 65,58 80,36 105,44 C 130,52 145,38 170,46 C 190,52 200,44 210,48"
          stroke="currentColor" strokeWidth="1" fill="none" strokeDasharray="3,4" strokeLinecap="round"
          className="text-white adventure:text-amber-800"
        />
        <path
          d="M -5,80 C 20,70 40,72 60,82 C 80,92 95,66 120,74 C 145,82 160,70 180,78 C 195,84 200,76 210,80"
          stroke="currentColor" strokeWidth="1.2" fill="none" strokeDasharray="4,3" strokeLinecap="round"
          className="text-white adventure:text-amber-800"
        />
        <g stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-white adventure:text-amber-800">
          <line x1="137" y1="5" x2="143" y2="11" />
          <line x1="143" y1="5" x2="137" y2="11" />
          <line x1="42" y1="76" x2="48" y2="82" />
          <line x1="48" y1="76" x2="42" y2="82" />
        </g>
        <circle cx="50" cy="22" r="1.8" fill="none" stroke="currentColor" strokeWidth="0.8" className="text-white adventure:text-amber-800" />
        <circle cx="120" cy="74" r="1.8" fill="none" stroke="currentColor" strokeWidth="0.8" className="text-white adventure:text-amber-800" />
      </svg>

      {/* All page content */}
      <div className="relative z-10">
        {/* Title area */}
        <div className="container mx-auto px-4 pt-10 pb-8 md:pt-12 md:pb-10 max-w-md text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-white/20 adventure:bg-stone-700/20 backdrop-blur-sm mb-4">
            <Icon className="h-6 w-6 text-white adventure:text-stone-800" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-white adventure:text-stone-800">{title}</h1>
          {description && (
            <p className="text-white/80 adventure:text-stone-600 mt-2 text-sm md:text-base">{description}</p>
          )}
        </div>

        {children}
      </div>
    </div>
  );
}
