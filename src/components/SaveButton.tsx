import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bookmark, BookmarkCheck } from 'lucide-react';
import { CompassSpinner } from '@/components/ui/loading';
import { Button } from '@/components/ui/button';
import { useSavedCaches } from '@/hooks/useSavedCaches';
import { useToast } from '@/hooks/useToast';
import { hapticLight } from '@/utils/haptics';
import type { Geocache } from '@/types/geocache';

interface SaveButtonProps {
  geocache: Geocache;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  showText?: boolean;
  className?: string;
}

export function SaveButton({
  geocache,
  variant = 'outline',
  size = 'icon',
  className,
}: SaveButtonProps) {
  const { t } = useTranslation();
  const { isCacheSaved, toggleSaveCache, isNostrEnabled } = useSavedCaches();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const isSaved = isCacheSaved(geocache.id, geocache.dTag, geocache.pubkey);

  const label = isSaved
    ? t('saveButton.remove', 'Remove from saved')
    : t('saveButton.save', 'Save for later');

  const handleToggleSave = async (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent navigation if button is inside a Link
    e.stopPropagation(); // Prevent event bubbling

    if (!isNostrEnabled) {
      toast({
        title: t('saveButton.loginRequired.title', 'Login required'),
        description: t(
          'saveButton.loginRequired.description',
          'Please log in with your Nostr account to save caches.'
        ),
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    hapticLight();

    // If the publish takes longer than a few seconds the user gets a nudge so
    // they don't think the app is hung. The original toast still follows on
    // success/failure.
    const slowPublishTimer = window.setTimeout(() => {
      toast({
        title: t('saveButton.slowPublish.title', 'Still publishing…'),
        description: t(
          'saveButton.slowPublish.description',
          'Relays are slow to respond. Hang tight.'
        ),
      });
    }, 5000);

    try {
      await toggleSaveCache(geocache);

      toast({
        title: isSaved
          ? t('saveButton.removed.title', 'Treasure removed from saved list')
          : t('saveButton.saved.title', 'Treasure saved for later'),
        description: isSaved
          ? t('saveButton.removed.description', {
              name: geocache.name,
              defaultValue: '"{{name}}" has been removed from your saved treasures.',
            })
          : t('saveButton.saved.description', {
              name: geocache.name,
              defaultValue: '"{{name}}" has been saved to your Nostr profile.',
            }),
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : t('saveButton.error.description', 'Failed to save treasure. Please try again.');
      toast({
        title: t('saveButton.error.title', 'Error saving treasure'),
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      window.clearTimeout(slowPublishTimer);
      setIsLoading(false);
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleToggleSave}
      disabled={isLoading}
      className={className}
      title={label}
      aria-label={label}
      aria-pressed={isSaved}
      aria-busy={isLoading}
    >
      {isLoading ? (
        <CompassSpinner size={16} variant="component" />
      ) : isSaved ? (
        <BookmarkCheck className="h-4 w-4" aria-hidden="true" />
      ) : (
        <Bookmark className="h-4 w-4" aria-hidden="true" />
      )}
    </Button>
  );
}
