import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, Info, QrCode, ScanQrCode, Scroll, Search, Settings, BookOpen, Sparkles, Compass } from 'lucide-react';
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useTheme } from '@/hooks/useTheme';

interface ExploreMenuItemsProps {
  /** Whether to include the "Explore Map" link (omit when already on the map) */
  showMapLink?: boolean;
}

/**
 * Shared dropdown menu items for the Explore menu.
 * Used by both DesktopHeader and the Map page's floating nav.
 */
export function ExploreMenuItems({ showMapLink = true }: ExploreMenuItemsProps) {
  const { t } = useTranslation();
  const { user } = useCurrentUser();
  const { theme } = useTheme();
  const isAdventureTheme = theme === 'adventure';

  return (
    <>
      {showMapLink && (
        <DropdownMenuItem asChild>
          <Link to="/map">
            <Search className="h-4 w-4 mr-2" />
            {isAdventureTheme ? t('navigation.revealMap') : t('navigation.exploreMap')}
          </Link>
        </DropdownMenuItem>
      )}
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
        <Link to="/adventures">
          <Compass className="h-4 w-4 mr-2" />
          Adventures
        </Link>
      </DropdownMenuItem>
      <DropdownMenuItem asChild>
        <Link to="/texas-ren-fest">
          <Sparkles className="h-4 w-4 mr-2" />
          {t('navigation.texasRenFest')}
        </Link>
      </DropdownMenuItem>
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
    </>
  );
}
