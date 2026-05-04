import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Compass, X } from 'lucide-react';

/**
 * Component that prompts users to update when a new service worker is available
 */
export function PWAUpdatePrompt() {
  const { t } = useTranslation();
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
    <div
      className="fixed left-4 right-4 md:left-auto md:bottom-auto md:right-4 md:top-4 md:max-w-sm z-50 animate-in slide-in-from-bottom-4 md:slide-in-from-top-4 duration-500"
      style={{
        // On mobile, lift above the bottom nav (~3rem) + FAB notch (~1rem) +
        // safe-area inset. Desktop uses md:top-4 and this bottom value is
        // harmless (overridden by md:bottom-auto above).
        bottom: 'calc(3rem + 1rem + env(safe-area-inset-bottom, 0px) + 0.5rem)',
      }}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-2 rounded-lg border bg-background/95 backdrop-blur-sm shadow-lg px-4 py-2.5">
        <button
          onClick={handleUpdate}
          disabled={isUpdating}
          className="flex items-center gap-2 min-w-0 flex-1 min-h-11 disabled:cursor-not-allowed"
        >
          <Compass className={`h-5 w-5 shrink-0 text-primary ${isUpdating ? 'animate-spin' : ''}`} />
          <span className="text-sm font-medium text-foreground truncate text-left">
            {isUpdating ? t('pwaUpdate.updating') : t('pwaUpdate.available')}
          </span>
        </button>
        {!isUpdating && (
          <button
            onClick={handleDismiss}
            className="shrink-0 p-2 -m-1 rounded-md hover:bg-accent transition-colors min-h-11 min-w-11 flex items-center justify-center"
            aria-label={t('pwaUpdate.dismiss')}
          >
            <X className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}
