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
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:bottom-auto md:right-4 md:top-4 md:max-w-sm z-50 animate-in slide-in-from-bottom-4 md:slide-in-from-top-4 duration-500">
      <div className="flex items-center gap-2 rounded-lg border bg-background/95 backdrop-blur-sm shadow-lg px-4 py-2.5">
        <button
          onClick={handleUpdate}
          disabled={isUpdating}
          className="flex items-center gap-2 min-w-0 flex-1 disabled:cursor-not-allowed"
        >
          <Compass className={`h-5 w-5 shrink-0 text-primary ${isUpdating ? 'animate-spin' : ''}`} />
          <span className="text-sm font-medium text-foreground truncate">
            {isUpdating ? 'Updating...' : 'Update available — Click to refresh'}
          </span>
        </button>
        {!isUpdating && (
          <button
            onClick={handleDismiss}
            className="shrink-0 p-1 rounded-md hover:bg-accent transition-colors"
            aria-label="Dismiss update notification"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        )}
      </div>
    </div>
  );
}
