import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MoreVertical, Share2, MapPin, Bookmark, BookmarkCheck, BookmarkX } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { ShareDialog } from '@/components/ShareDialog';
import { useSavedCaches } from '@/hooks/useSavedCaches';
import { useToast } from '@/hooks/useToast';
import { CompassSpinner } from '@/components/ui/loading';
import type { Geocache } from '@/types/geocache';

interface CacheMenuProps {
  geocache: Geocache;
  variant?: 'default' | 'compact';
  className?: string;
}

export function CacheMenu({ geocache, variant = 'default', className }: CacheMenuProps) {
  const { t } = useTranslation();
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const {
    isCacheSaved,
    isCacheSavedOffline,
    toggleSaveCache,
    isNostrEnabled,
  } = useSavedCaches();

  const naddr = `${30001}:${geocache.pubkey}:${geocache.dTag}`;
  const isSaved = isCacheSaved(geocache.id, geocache.dTag, geocache.pubkey);
  const isOffline = isCacheSavedOffline(naddr);

  const handleViewOnMap = () => {
    const mapUrl = `/map?lat=${geocache.location.lat}&lng=${geocache.location.lng}&zoom=16&highlight=${geocache.dTag}&tab=map`;
    navigate(mapUrl);
    setDropdownOpen(false); // Close dropdown after action
  };

  const handleShare = () => {
    setShareDialogOpen(true);
    setDropdownOpen(false); // Close dropdown after action
  };

  const handleToggleSave = async () => {
    if (!isNostrEnabled) {
      toast({
        title: 'Login required',
        description: 'Please log in with your Nostr account to save caches.',
        variant: 'destructive',
      });
      setDropdownOpen(false);
      return;
    }

    setIsSaving(true);

    try {
      await toggleSaveCache(geocache);

      toast({
        title: isSaved
          ? 'Cache removed from saved list'
          : 'Cache saved for later',
        description: isOffline
          ? `"${geocache.name}" has been saved to your device and will be synced when you're back online.`
          : isSaved
          ? `"${geocache.name}" has been removed from your saved caches.`
          : `"${geocache.name}" has been saved to your Nostr profile.`,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to save cache. Please try again.';
      toast({
        title: 'Error saving cache',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
      setDropdownOpen(false);
    }
  };

  const getSaveIcon = () => {
    if (isSaving) {
      return <CompassSpinner size={16} variant="component" />;
    }
    if (isOffline) {
      return <BookmarkX className="h-4 w-4 mr-2" />;
    }
    if (isSaved) {
      return <BookmarkCheck className="h-4 w-4 mr-2" />;
    }
    return <Bookmark className="h-4 w-4 mr-2" />;
  };

  const getSaveLabel = () => {
    if (isSaving) {
      return 'Saving...';
    }
    if (isOffline) {
      return 'Saved Offline';
    }
    if (isSaved) {
      return 'Remove from Saved';
    }
    return 'Save for Later';
  };

  const buttonSize = variant === 'compact' ? 'sm' : 'icon';
  const iconSize = variant === 'compact' ? 'h-3 w-3' : 'h-4 w-4';

  return (
    <>
      <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen} modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size={buttonSize}
            className={className}
            onClick={(e) => {
              e.stopPropagation(); // Prevent triggering parent click handlers
            }}
          >
            <MoreVertical className={iconSize} />
            <span className="sr-only">{t('geocacheCard.moreOptions')}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-48"
          side="bottom"
          sideOffset={8}
          avoidCollisions={true}
          collisionPadding={{ bottom: 80 }} // Account for mobile nav bar (64px) + padding
          onCloseAutoFocus={(e) => {
            // Prevent focus trap issues on mobile
            e.preventDefault();
          }}
        >
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              handleToggleSave();
            }}
            onSelect={(e) => {
              // Prevent default select behavior that might interfere with scroll
              e.preventDefault();
              handleToggleSave();
            }}
            disabled={isSaving}
          >
            {getSaveIcon()}
            {getSaveLabel()}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              handleViewOnMap();
            }}
            onSelect={(e) => {
              // Prevent default select behavior that might interfere with scroll
              e.preventDefault();
              handleViewOnMap();
            }}
          >
            <MapPin className="h-4 w-4 mr-2" />
            {t('geocacheCard.viewOnMap')}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              handleShare();
            }}
            onSelect={(e) => {
              // Prevent default select behavior that might interfere with scroll
              e.preventDefault();
              handleShare();
            }}
          >
            <Share2 className="h-4 w-4 mr-2" />
            {t('geocacheCard.share')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ShareDialog
        open={shareDialogOpen}
        onOpenChange={setShareDialogOpen}
        geocache={geocache}
      />
    </>
  );
}