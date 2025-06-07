import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RefreshCw, X } from 'lucide-react';

export function PWAUpdateNotification() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const handleServiceWorkerUpdate = async () => {
      try {
        const registration = await navigator.serviceWorker.ready;
        
        // Check for waiting worker immediately
        if (registration.waiting) {
          setWaitingWorker(registration.waiting);
          setUpdateAvailable(true);
        }

        // Listen for new service worker installations
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              setWaitingWorker(newWorker);
              setUpdateAvailable(true);
              setDismissed(false); // Reset dismissed state for new updates
            }
          });
        });
      } catch (error) {
        console.error('Service worker setup failed:', error);
      }
    };

    // Listen for controller changes (when update is applied)
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      window.location.reload();
    });

    handleServiceWorkerUpdate();
  }, []);

  const handleUpdate = () => {
    if (waitingWorker) {
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });
      setUpdateAvailable(false);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
  };

  if (!updateAvailable || dismissed) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm">
      <Card className="shadow-lg border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base text-blue-900 dark:text-blue-100">
              Update Available
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDismiss}
              className="h-6 w-6 p-0 text-blue-700 hover:text-blue-900 dark:text-blue-300 dark:hover:text-blue-100"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <CardDescription className="text-blue-700 dark:text-blue-300">
            A new version of Treasures is ready to install.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleUpdate}
              className="flex-1 bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500"
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Update Now
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleDismiss}
              className="flex-1 border-blue-300 text-blue-700 hover:bg-blue-100 dark:border-blue-600 dark:text-blue-300 dark:hover:bg-blue-900"
            >
              Later
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}