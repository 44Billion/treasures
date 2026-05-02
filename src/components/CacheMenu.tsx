import { useState, useRef, useCallback } from 'react';
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
import { useSavedCaches } from '@/hooks/useSavedCaches';
import { useToast } from '@/hooks/useToast';
import { CompassSpinner } from '@/components/ui/loading';
import { geocacheToNaddr } from '@/utils/naddr';
import { hapticLight } from '@/utils/haptics';
import type { Geocache } from '@/types/geocache';

interface CacheMenuProps {
  geocache: Geocache;
  variant?: 'default' | 'compact';
  className?: string;
}

export function CacheMenu({ geocache, variant = 'default', className }: CacheMenuProps) {
  const { t } = useTranslation();
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

  // Track touch movement to distinguish scroll gestures from taps.
  // On mobile, a scroll that starts on the trigger button would otherwise
  // open the dropdown menu via Radix's pointerdown handler.
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);
  const wasScrolling = useRef(false);
  const SCROLL_THRESHOLD = 8; // pixels of movement before treating as scroll

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartPos.current = { x: touch.clientX, y: touch.clientY };
    wasScrolling.current = false;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStartPos.current) return;
    const touch = e.touches[0];
    const dx = Math.abs(touch.clientX - touchStartPos.current.x);
    const dy = Math.abs(touch.clientY - touchStartPos.current.y);
    if (dx > SCROLL_THRESHOLD || dy > SCROLL_THRESHOLD) {
      wasScrolling.current = true;
    }
  }, []);

  const handleOpenChange = useCallback((open: boolean) => {
    // Prevent opening the menu if the user was scrolling
    if (open && wasScrolling.current) {
      wasScrolling.current = false;
      touchStartPos.current = null;
      return;
    }
    touchStartPos.current = null;
    setDropdownOpen(open);
  }, []);

  const handleViewOnMap = () => {
    const mapUrl = `/map?lat=${geocache.location.lat}&lng=${geocache.location.lng}&zoom=16&highlight=${geocache.dTag}&tab=map`;
    navigate(mapUrl);
    setDropdownOpen(false); // Close dropdown after action
  };

  const handleShare = async () => {
    setDropdownOpen(false);
    const naddr = geocacheToNaddr(geocache.pubkey, geocache.dTag, geocache.relays, geocache.kind);
    const shareUrl = `${window.location.origin}/${naddr}`;
    hapticLight();
    if ('share' in navigator && navigator.share) {
      try {
        await navigator.share({
          title: geocache.name,
          text: t('shareDialog.shareText', { name: geocache.name }),
          url: shareUrl,
        });
      } catch {
        // User cancelled — no-op
      }
    } else {
      try {
        await navigator.clipboard.writeText(shareUrl);
      } catch {
        const textArea = document.createElement('textarea');
        textArea.value = shareUrl;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      toast({ title: t('common.copyLink') });
    }
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
          ? 'Treasure removed from saved list'
          : 'Treasure saved for later',
        description: isOffline
          ? `"${geocache.name}" has been saved to your device and will be synced when you're back online.`
          : isSaved
          ? `"${geocache.name}" has been removed from your saved treasures.`
          : `"${geocache.name}" has been saved to your Nostr profile.`,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to save treasure. Please try again.';
      toast({
        title: 'Error saving treasure',
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
      <DropdownMenu open={dropdownOpen} onOpenChange={handleOpenChange} modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size={buttonSize}
            className={className}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
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
    </>
  );
}