import { HeroGallery } from "./HeroGallery";
import { useTheme } from "@/hooks/useTheme";
import { useActiveProfileTheme } from "@/hooks/useActiveProfileTheme";

/**
 * Fixed full-viewport background with rotating hero photos (or ditto bg image),
 * theme-aware color overlay, and dotted trail SVG.
 *
 * Used by PageHero for content pages and can be dropped into any page that
 * needs the same treatment (e.g. Profile when the ditto theme is active).
 */
export function HeroBackground() {
  const { resolvedTheme } = useTheme();
  const { profileTheme } = useActiveProfileTheme();
  const isDitto = resolvedTheme === 'ditto';
  const dittoBg = isDitto ? profileTheme?.background : undefined;

  return (
    <div className="fixed inset-0 z-0">
      {dittoBg ? (
        <img
          src={dittoBg.url}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <HeroGallery />
      )}

      {/* Theme-aware color overlay */}
      <div className={`absolute inset-0 ${isDitto ? 'bg-background/60' : 'bg-primary/60 dark:bg-[#0a1510]/70 adventure:bg-amber-100/70 adventure:dark:bg-stone-900/80'}`} />

      {/* Dotted trail SVG */}
      <svg
        className={`absolute inset-0 w-full h-full pointer-events-none ${isDitto ? 'opacity-[0.12]' : 'opacity-[0.1] adventure:opacity-[0.15]'}`}
        viewBox="0 0 200 100"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        <path
          d="M -5,20 C 15,10 30,12 50,22 C 70,32 85,8 110,16 C 135,24 155,12 180,20 C 195,24 200,18 210,20"
          stroke="currentColor" strokeWidth="1.2" fill="none" strokeDasharray="4,3" strokeLinecap="round"
          className={isDitto ? 'text-foreground' : 'text-white adventure:text-amber-800'}
        />
        <path
          d="M -5,50 C 10,40 25,38 45,48 C 65,58 80,36 105,44 C 130,52 145,38 170,46 C 190,52 200,44 210,48"
          stroke="currentColor" strokeWidth="1" fill="none" strokeDasharray="3,4" strokeLinecap="round"
          className={isDitto ? 'text-foreground' : 'text-white adventure:text-amber-800'}
        />
        <path
          d="M -5,80 C 20,70 40,72 60,82 C 80,92 95,66 120,74 C 145,82 160,70 180,78 C 195,84 200,76 210,80"
          stroke="currentColor" strokeWidth="1.2" fill="none" strokeDasharray="4,3" strokeLinecap="round"
          className={isDitto ? 'text-foreground' : 'text-white adventure:text-amber-800'}
        />
        <g stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className={isDitto ? 'text-foreground' : 'text-white adventure:text-amber-800'}>
          <line x1="137" y1="5" x2="143" y2="11" />
          <line x1="143" y1="5" x2="137" y2="11" />
          <line x1="42" y1="76" x2="48" y2="82" />
          <line x1="48" y1="76" x2="42" y2="82" />
        </g>
        <circle cx="50" cy="22" r="1.8" fill="none" stroke="currentColor" strokeWidth="0.8" className={isDitto ? 'text-foreground' : 'text-white adventure:text-amber-800'} />
        <circle cx="120" cy="74" r="1.8" fill="none" stroke="currentColor" strokeWidth="0.8" className={isDitto ? 'text-foreground' : 'text-white adventure:text-amber-800'} />
      </svg>
    </div>
  );
}
