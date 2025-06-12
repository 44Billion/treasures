import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RefreshCw, X, Download } from 'lucide-react';
import { usePWAUpdate } from '@/shared/hooks/usePWAUpdate';

export function PWAUpdateNotification() {
  const [dismissed, setDismissed] = useState(false);
  const { updateAvailable, isUpdating, needsRefresh, applyUpdate, reloadApp } = usePWAUpdate();

  const handleUpdate = () => {
    applyUpdate();
  };

  const handleDismiss = () => {
    setDismissed(true);
  };

  const handleReload = () => {
    reloadApp();
  };

  // Reset dismissed state when new update becomes available
  if (updateAvailable && dismissed) {
    setDismissed(false);
  }

  // Show reload prompt after update is applied
  if (needsRefresh) {
    return (
      <div className="fixed bottom-4 right-4 z-50 max-w-sm">
        <Card className="shadow-lg border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-green-900 dark:text-green-100">
              Update Ready
            </CardTitle>
            <CardDescription className="text-green-700 dark:text-green-300">
              The app has been updated. Reload to use the new version.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <Button
              size="sm"
              onClick={handleReload}
              className="w-full bg-green-600 hover:bg-green-700 dark:bg-green-600 dark:hover:bg-green-500"
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Reload App
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

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
              disabled={isUpdating}
              className="flex-1 bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500"
            >
              {isUpdating ? (
                <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <Download className="h-3 w-3 mr-1" />
              )}
              {isUpdating ? 'Installing...' : 'Install Update'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleDismiss}
              disabled={isUpdating}
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