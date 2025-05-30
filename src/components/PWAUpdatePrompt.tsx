import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RefreshCw } from 'lucide-react';

export function PWAUpdatePrompt() {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    // Check for service worker updates
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        setUpdateAvailable(true);
      });
    }
  }, []);

  const handleUpdate = () => {
    window.location.reload();
  };

  if (updateAvailable) {
    return (
      <Alert className="fixed bottom-20 left-2 right-2 z-50 md:bottom-4 md:left-auto md:right-4 md:max-w-sm shadow-lg border-green-200 bg-green-50">
        <RefreshCw className="h-4 w-4 text-green-600" />
        <AlertDescription>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <span className="text-sm font-medium text-green-800">New version available!</span>
            <Button 
              size="sm" 
              onClick={handleUpdate} 
              className="shrink-0 w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white"
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Update
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  // Install prompt is now handled on a dedicated page
  return null;
}