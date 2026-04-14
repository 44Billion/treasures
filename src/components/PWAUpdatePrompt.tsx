import { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Compass, X } from 'lucide-react';

/**
 * Component that prompts users to update when a new service worker is available
 */
export function PWAUpdatePrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const {
    offlineReady: [offlineReady],
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, registration) {
      console.log('[PWA] Service worker registered:', swUrl);

      // Check for updates periodically (every hour)
      if (registration) {
        const intervalId = setInterval(async () => {
          try {
            await registration.update();
          } catch (error) {
            // Registration may no longer be valid, clear the interval
            console.warn('[PWA] Failed to check for updates:', error);
            clearInterval(intervalId);
          }
        }, 60 * 60 * 1000);
      }
    },
    onRegisterError(error) {
      console.error('[PWA] Service worker registration error:', error);
    },
  });

  useEffect(() => {
    if (offlineReady) {
      console.log('[PWA] App ready to work offline');
    }
  }, [offlineReady]);

  useEffect(() => {
    if (needRefresh) {
      setShowPrompt(true);
    }
  }, [needRefresh]);

  const handleUpdate = () => {
    setIsUpdating(true);
    updateServiceWorker(true);
  };

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowPrompt(false);
  };

  if (!showPrompt) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 md:top-4 md:right-4 md:bottom-auto md:left-auto md:translate-x-0 z-50 animate-in slide-in-from-bottom-4 md:slide-in-from-top-4 duration-500 max-w-full">
      <div className="relative group">
        <button
          onClick={handleUpdate}
          disabled={isUpdating}
          className={`relative flex items-center gap-2 px-4 py-2.5 ${!isUpdating ? 'pr-10' : ''} bg-gradient-to-r from-primary/5 to-primary/10 dark:from-primary/20 dark:to-primary/30 border-2 border-primary dark:border-primary rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:hover:scale-100 max-w-full truncate`}
        >
          <Compass className={`h-5 w-5 text-primary dark:text-primary ${isUpdating ? 'animate-spin' : 'group-hover:rotate-12 transition-transform duration-300'}`} />
          <span className="text-sm font-medium whitespace-nowrap max-w-full truncate text-foreground dark:text-foreground">
            {isUpdating ? 'Updating...' : 'Update available — Click to refresh'}
          </span>
        </button>
        {!isUpdating && (
          <button
            onClick={handleDismiss}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-primary/15 dark:hover:bg-primary/25 transition-colors duration-200"
            aria-label="Dismiss update notification"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        )}
      </div>
    </div>
  );
}
