import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { HeroBackground } from "./HeroBackground";
import { useTheme } from "@/hooks/useTheme";

interface PageHeroProps {
  icon?: LucideIcon;
  title: ReactNode;
  description?: string;
  children?: ReactNode;
}

/**
 * Full-page background with rotating hero photos, theme-aware color overlay,
 * film grain, and dotted trail SVG.
 */
export function PageHero({ icon: Icon, title, description, children }: PageHeroProps) {
  const { resolvedTheme } = useTheme();
  const isDitto = resolvedTheme === 'ditto';

  return (
    <div className="relative">
      {/* Fixed background layers — pinned to viewport, content scrolls over them */}
      <HeroBackground />

      {/* All page content — scrolls over the fixed background */}
      <div className="relative z-10">
        {/* Title area */}
        <div className="container mx-auto px-4 pt-10 pb-8 md:pt-12 md:pb-10 max-w-md text-center">
          {Icon && (
            <div className={`inline-flex items-center justify-center w-12 h-12 rounded-full backdrop-blur-sm mb-4 ${isDitto ? 'bg-primary/20' : 'bg-white/20 adventure:bg-stone-700/20'}`}>
              <Icon className={`h-6 w-6 ${isDitto ? 'text-foreground' : 'text-white adventure:text-stone-800'}`} />
            </div>
          )}
          <h1 className={`text-2xl md:text-3xl font-bold ${isDitto ? 'text-foreground' : 'text-white adventure:text-stone-800'}`}>{title}</h1>
          {description && (
            <p className={`mt-2 text-sm md:text-base ${isDitto ? 'text-muted-foreground' : 'text-white/80 adventure:text-stone-600'}`}>{description}</p>
          )}
        </div>

        {children}
      </div>
    </div>
  );
}
