import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Search, Plus, Info, ChevronDown, Compass, QrCode, ScanQrCode, Scroll, Settings, BookOpen, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LoginArea } from '@/components/auth/LoginArea';
import { useTheme } from "@/shared/hooks/useTheme";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import { useCurrentUser } from '@/features/auth/hooks/useCurrentUser';

interface DesktopHeaderProps {
  variant?: 'default' | 'map';
}

export function DesktopHeader({ variant = 'default' }: DesktopHeaderProps) {
  const { t } = useTranslation();
  const { user } = useCurrentUser();
  const { theme } = useTheme();
  const isAdventureTheme = theme === 'adventure';

  // Map page has different styling needs due to layout constraints
  const baseClasses = variant === 'map'
    ? "hidden lg:block border-b sticky top-0 z-50"
    : "border-b sticky top-0 z-50 hidden md:block";

  const adventureClasses = isAdventureTheme
    ? "bg-adventure-nav border-adventure-nav text-stone-200"
    : "bg-background/80 backdrop-blur-sm md:bg-background md:backdrop-blur-none border-border";

  const headerClasses = `${baseClasses} ${adventureClasses}`;

  return (
    <header className={headerClasses}>
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img
              src="/icon.svg"
              alt={t('navigation.appName')}
              className={`h-12 w-12 transition-all duration-200 ${isAdventureTheme ? 'sepia' : ''}`}
            />
            <h1 className={`text-2xl font-bold m-0 leading-none ${isAdventureTheme ? 'text-stone-200' : 'text-foreground'}`}>{t('navigation.appName')}</h1>
          </Link>

          <nav className="flex items-center gap-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size={isAdventureTheme ? "default" : "sm"} className={isAdventureTheme ? "text-md text-stone-200" : ""}>
                  <Compass className="h-4 w-4 mr-2" />
                  {t('navigation.explore')} <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link to="/map">
                    <Search className="h-4 w-4 mr-2" />
                    {isAdventureTheme ? t('navigation.revealMap') : t('navigation.exploreMap')}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/texas-ren-fest">
                    <Sparkles className="h-4 w-4 mr-2" />
                    {t('navigation.texasRenFest')}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/claim">
                    {isAdventureTheme ? <Scroll className="h-4 w-4 mr-2" /> : <ScanQrCode className="h-4 w-4 mr-2" />}
                    {isAdventureTheme ? t('navigation.claimArtifact') : t('navigation.claimTreasure')}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/generate-qr">
                    <QrCode className="h-4 w-4 mr-2" />
                    {t('navigation.generateQrCode')}
                  </Link>
                </DropdownMenuItem>
                {user && (
                  <DropdownMenuItem asChild>
                    <Link to="/create">
                      <Plus className="h-4 w-4 mr-2" />
                      {isAdventureTheme ? t('navigation.concealGeocache') : t('navigation.hideGeocache')}
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <a href="/blog">
                    <BookOpen className="h-4 w-4 mr-2" />
                    {t('navigation.blog')}
                  </a>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/settings">
                    <Settings className="h-4 w-4 mr-2" />
                    {t('navigation.appSettings')}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/about">
                    <Info className="h-4 w-4 mr-2" />
                    {t('navigation.about')}
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <LoginArea />
          </nav>
        </div>
      </div>
    </header>
  );
}
