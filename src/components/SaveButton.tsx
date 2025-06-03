import { useState } from 'react';
import { Bookmark, BookmarkCheck } from 'lucide-react';
import { CompassSpinner } from '@/components/ui/loading';
import { Button } from '@/components/ui/button';
import { useSavedCaches } from '@/hooks/useSavedCaches';
import { useToast } from '@/hooks/useToast';
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
  size = 'sm', 
  showText = true,
  className 
}: SaveButtonProps) {
  const { isCacheSaved, toggleSaveCache, isNostrEnabled } = useSavedCaches();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const isSaved = isCacheSaved(geocache.id, geocache.dTag, geocache.pubkey);

  const handleToggleSave = async (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent navigation if button is inside a Link
    e.stopPropagation(); // Prevent event bubbling
    
    if (!isNostrEnabled) {
      toast({
        title: 'Login required',
        description: 'Please log in with your Nostr account to save caches.',
        variant: 'destructive',
      });
      return;
    }
    
    setIsLoading(true);
    
    try {
      await toggleSaveCache(geocache);
      
      toast({
        title: isSaved ? 'Cache removed from saved list' : 'Cache saved for later',
        description: isSaved 
          ? `"${geocache.name}" has been removed from your saved caches. It may take a moment for all relays to process the removal.`
          : `"${geocache.name}" has been saved to your Nostr profile.`,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save cache. Please try again.';
      toast({
        title: 'Error saving cache',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
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
      title={isSaved ? 'Remove from saved caches' : 'Save for later'}
    >
      {isLoading ? (
        <CompassSpinner size={16} variant="component" />
      ) : isSaved ? (
        <BookmarkCheck className="h-4 w-4" />
      ) : (
        <Bookmark className="h-4 w-4" />
      )}
      {showText && size !== 'icon' && (
        <span className="ml-2">
          {isLoading ? 'Saving...' : isSaved ? 'Saved' : 'Save'}
        </span>
      )}
    </Button>
  );
}