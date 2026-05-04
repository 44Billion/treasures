import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Compass } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LoginArea } from '@/components/auth/LoginArea';
import { ExploreMenuItems } from '@/components/ExploreMenuItems';
import { useTheme } from "@/hooks/useTheme";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface DesktopHeaderProps {
  variant?: 'default' | 'map' | 'hero';
}

export function DesktopHeader({ variant = 'default' }: DesktopHeaderProps) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const isAdventureTheme = theme === 'adventure';
  const isDittoTheme = theme === 'ditto';
  const isMojaveTheme = theme === 'mojave';
  const isHero = variant === 'hero';

  // Map page has different styling needs due to layout constraints
  const baseClasses = variant === 'map'
    ? "hidden lg:block border-b sticky top-0 z-50"
    : isHero
      ? "border-b hidden lg:block relative z-50"
      : "border-b sticky top-0 z-50 hidden lg:block";

  const heroClasses = isHero
    ? "bg-transparent border-transparent text-white relative z-50"
    : "";

  const themeClasses = isHero
    ? ""
    : isAdventureTheme
      ? "bg-adventure-nav border-adventure-nav text-stone-200"
      : isDittoTheme
        ? "bg-card border-border text-foreground"
        : "bg-background/80 backdrop-blur-sm md:bg-background md:backdrop-blur-none border-border";

  const headerClasses = `${baseClasses} ${themeClasses} ${heroClasses}`;

  return (
    <header className={headerClasses}>
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            {/* Brand icon hidden on the hero variant (Home) — the page renders
                a large centered logo just below the header, so repeating a
                small mark in the upper-left is noise. Keep the wordmark. */}
            {!isHero && (
              <img
                src="/icon.svg"
                alt={t('navigation.appName')}
                className={`h-12 w-12 transition-all duration-200 ${isAdventureTheme ? 'sepia' : isMojaveTheme ? 'mojave-logo' : isDittoTheme ? 'ditto-logo' : ''}`}
              />
            )}
            <h1 className={`text-2xl font-bold m-0 leading-none ${isHero ? 'text-white' : isAdventureTheme ? 'text-stone-200' : 'text-foreground'}`}>{t('navigation.appName')}</h1>

          </Link>

          <nav className="flex items-center gap-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size={isAdventureTheme ? "default" : "sm"} className={isHero ? "text-white hover:bg-white/15 hover:text-white" : isAdventureTheme ? "text-md text-stone-200" : isDittoTheme ? "text-foreground" : ""}>
                  <Compass className="h-4 w-4 mr-2" />
                  {t('navigation.explore')} <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <ExploreMenuItems showMapLink />
              </DropdownMenuContent>
            </DropdownMenu>

            <LoginArea />
          </nav>
        </div>
      </div>
    </header>
  );
}
