import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Download, Check, Smartphone } from 'lucide-react';
import { usePWAUpdate } from '@/shared/hooks/usePWAUpdate';
import { usePWAInstall } from '@/shared/hooks/usePWAInstall';

export function PWASettings() {
  const { 
    updateAvailable, 
    isUpdating, 
    needsRefresh, 
    checkingForUpdate,
    checkForUpdate, 
    applyUpdate, 
    reloadApp 
  } = usePWAUpdate();
  
  const { installable, installing, installed, install } = usePWAInstall();

  const handleCheckUpdate = () => {
    checkForUpdate();
  };

  const handleInstallUpdate = () => {
    applyUpdate();
  };

  const handleReload = () => {
    reloadApp();
  };

  const handleInstallApp = () => {
    install();
  };

  return (
    <div className="space-y-4">
      {/* App Installation */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Smartphone className="h-4 w-4" />
            <span className="font-medium">App Installation</span>
            {installed && (
              <Badge variant="secondary" className="text-xs">
                <Check className="h-3 w-3 mr-1" />
                Installed
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {installed 
              ? "App is installed on your device" 
              : installable 
                ? "Install the app for a better experience"
                : "App installation not available"
            }
          </p>
        </div>
        {installable && !installed && (
          <Button 
            onClick={handleInstallApp}
            disabled={installing}
            size="sm"
          >
            {installing ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            {installing ? 'Installing...' : 'Install App'}
          </Button>
        )}
      </div>

      {/* App Updates */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            <span className="font-medium">App Updates</span>
            {updateAvailable && (
              <Badge variant="default" className="text-xs">
                Update Available
              </Badge>
            )}
            {needsRefresh && (
              <Badge variant="secondary" className="text-xs">
                <Check className="h-3 w-3 mr-1" />
                Ready to Reload
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {needsRefresh 
              ? "Update installed, reload to apply changes"
              : updateAvailable 
                ? "A new version is available for download"
                : "Check for the latest app updates"
            }
          </p>
        </div>
        <div className="flex gap-2">
          {needsRefresh ? (
            <Button onClick={handleReload} size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Reload App
            </Button>
          ) : updateAvailable ? (
            <Button 
              onClick={handleInstallUpdate}
              disabled={isUpdating}
              size="sm"
            >
              {isUpdating ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              {isUpdating ? 'Installing...' : 'Install Update'}
            </Button>
          ) : (
            <Button 
              onClick={handleCheckUpdate}
              disabled={checkingForUpdate}
              variant="outline"
              size="sm"
            >
              {checkingForUpdate ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              {checkingForUpdate ? 'Checking...' : 'Check for Updates'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}