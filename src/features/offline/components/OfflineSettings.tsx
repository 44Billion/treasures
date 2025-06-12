/**
 * Offline settings component for managing offline functionality
 */

import { useState, useEffect } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Switch } from '@/shared/components/ui/switch';
import { Label } from '@/shared/components/ui/label';
import { Badge } from '@/shared/components/ui/badge';
import { Progress } from '@/shared/components/ui/progress';
import { Separator } from '@/shared/components/ui/separator';
import { 
  Trash2, 
  RefreshCw, 
  HardDrive, 
  Wifi, 
  WifiOff,
  MapPin,
  Database,
  Clock,
  AlertCircle
} from 'lucide-react';
import { useOfflineSync, useOfflineSettings, useOfflineMode } from '@/features/offline/hooks/useOfflineStorage';
import { useConnectivity } from '@/features/offline/hooks/useConnectivity';
import { useOfflineMapData } from '@/features/map/components/OfflineMap';
import { useOfflineStorageInfo } from '@/features/offline/hooks/useOfflineStorageInfo';
import { useToast } from '@/shared/hooks/useToast';
import { offlineStorage } from '@/features/offline/utils/offlineStorage';

export function OfflineSettings() {
  const { status, forceSync } = useOfflineSync();
  const { settings, setSetting } = useOfflineSettings();
  const { isOnline, isConnected, connectionQuality, pendingActions, lastSyncTime, syncErrors, latency } = useOfflineMode();
  const { forceCheck } = useConnectivity();
  const { clearCachedMapData } = useOfflineMapData();
  const { storageInfo, refreshStorageInfo } = useOfflineStorageInfo();
  const { toast } = useToast();

  const [isClearing, setIsClearing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);

  useEffect(() => {
    refreshStorageInfo();
  }, [refreshStorageInfo]);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatLastSync = (timestamp: number | null) => {
    if (!timestamp) return 'Never';
    
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const handleForceSync = async () => {
    setIsSyncing(true);
    try {
      await forceSync();
      toast({
        title: 'Sync completed',
        description: 'All pending changes have been synchronized.',
      });
    } catch (error) {
      toast({
        title: 'Sync failed',
        description: 'Failed to synchronize pending changes.',
        variant: 'destructive',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleTestConnection = async () => {
    setIsTestingConnection(true);
    try {
      const result = await forceCheck();
      toast({
        title: 'Connection test completed',
        description: result.isConnected 
          ? `Connected with ${result.connectionQuality} quality (${result.latency}ms)`
          : 'No internet connection detected',
        variant: result.isConnected ? 'default' : 'destructive',
      });
    } catch (error) {
      toast({
        title: 'Connection test failed',
        description: 'Unable to test connection',
        variant: 'destructive',
      });
    } finally {
      setIsTestingConnection(false);
    }
  };

  const handleClearOfflineData = async () => {
    setIsClearing(true);
    try {
      // Clear offline storage
      await offlineStorage.clearOldData(0); // Clear all data
      
      // Clear map tiles
      await clearCachedMapData();
      
      // Clear other caches
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
      }

      // Reload storage info
      await refreshStorageInfo();

      toast({
        title: 'Offline data cleared',
        description: 'All cached data has been removed.',
      });
    } catch (error) {
      toast({
        title: 'Clear failed',
        description: 'Failed to clear offline data.',
        variant: 'destructive',
      });
    } finally {
      setIsClearing(false);
    }
  };

  const storageUsagePercent = storageInfo.quota > 0 
    ? (storageInfo.used / storageInfo.quota) * 100 
    : 0;

  return (
    <div className="space-y-6">
      {/* Connection Status */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          {isOnline ? (
            <Wifi className="h-4 w-4 text-green-500" />
          ) : (
            <WifiOff className="h-4 w-4 text-red-500" />
          )}
          <h3 className="font-medium">Connection Status</h3>
        </div>
        
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <Label className="text-xs font-medium text-muted-foreground">Status</Label>
            <div className={`font-medium ${isConnected ? 'text-green-600' : 'text-red-600'}`}>
              {isConnected ? `Connected (${connectionQuality})` : 'Offline'}
            </div>
          </div>
          <div>
            <Label className="text-xs font-medium text-muted-foreground">Last Sync</Label>
            <div className="text-sm">{formatLastSync(lastSyncTime)}</div>
          </div>
          {latency && (
            <div>
              <Label className="text-xs font-medium text-muted-foreground">Latency</Label>
              <div className="text-sm">{latency}ms</div>
            </div>
          )}
        </div>

        {pendingActions > 0 && (
          <div className="flex items-center justify-between p-3 bg-orange-50 dark:bg-orange-950/20 rounded-lg border border-orange-200 dark:border-orange-800">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-orange-600" />
              <span className="text-sm font-medium text-orange-800 dark:text-orange-200">
                {pendingActions} action{pendingActions !== 1 ? 's' : ''} pending sync
              </span>
            </div>
            <Badge variant="secondary">{pendingActions}</Badge>
          </div>
        )}

        {syncErrors.length > 0 && (
          <div className="p-3 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-800">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <span className="text-sm font-medium text-red-800 dark:text-red-200">Sync Errors</span>
            </div>
            <div className="space-y-1">
              {syncErrors.slice(0, 2).map((error, index) => (
                <div key={index} className="text-xs text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-900/30 p-2 rounded">
                  {error}
                </div>
              ))}
              {syncErrors.length > 2 && (
                <div className="text-xs text-red-600 dark:text-red-400">
                  +{syncErrors.length - 2} more errors
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <Button
            onClick={handleTestConnection}
            disabled={isTestingConnection}
            variant="outline"
            size="sm"
            className="flex-1"
          >
            {isTestingConnection ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Testing...
              </>
            ) : (
              <>
                <Wifi className="h-4 w-4 mr-2" />
                Test Connection
              </>
            )}
          </Button>
          
          {isConnected && (
            <Button
              onClick={handleForceSync}
              disabled={isSyncing}
              size="sm"
              className="flex-1"
            >
              {isSyncing ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Sync Now
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      <Separator />

      {/* Storage Usage */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <HardDrive className="h-4 w-4" />
          <h3 className="font-medium">Storage Usage</h3>
        </div>
        
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span>Used Storage</span>
            <span>{formatBytes(storageInfo.used)} / {formatBytes(storageInfo.quota)}</span>
          </div>
          <Progress value={storageUsagePercent} className="h-2" />
          <div className="text-xs text-muted-foreground mt-1">
            {storageUsagePercent.toFixed(1)}% of available storage
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-blue-500" />
              <span>Geocaches</span>
            </div>
            <Badge variant="secondary">{storageInfo.geocaches}</Badge>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-green-500" />
              <span>Map Tiles</span>
            </div>
            <Badge variant="secondary">{storageInfo.mapTiles}</Badge>
          </div>
        </div>
        
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={refreshStorageInfo}
            size="sm"
            className="flex-1"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh Info
          </Button>
          
          <Button
            variant="destructive"
            onClick={handleClearOfflineData}
            disabled={isClearing}
            size="sm"
            className="flex-1"
          >
            {isClearing ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Clearing...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4 mr-2" />
                Clear Data
              </>
            )}
          </Button>
        </div>
      </div>

      <Separator />

      {/* Offline Preferences */}
      <div className="space-y-4">
        <h3 className="font-medium">Offline Preferences</h3>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="auto-sync">Auto Sync</Label>
              <div className="text-xs text-muted-foreground">
                Automatically sync when connection is restored
              </div>
            </div>
            <Switch
              id="auto-sync"
              checked={settings.autoSync as boolean ?? true}
              onCheckedChange={(checked) => setSetting({ key: 'autoSync', value: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="offline-mode">Prefer Offline Mode</Label>
              <div className="text-xs text-muted-foreground">
                Use cached data when available, even when online
              </div>
            </div>
            <Switch
              id="offline-mode"
              checked={settings.offlineMode as boolean ?? false}
              onCheckedChange={(checked) => setSetting({ key: 'offlineMode', value: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="offline-only">Offline Only Mode</Label>
              <div className="text-xs text-muted-foreground">
                Force app to work offline and show offline status
              </div>
            </div>
            <Switch
              id="offline-only"
              checked={settings.offlineOnly as boolean ?? false}
              onCheckedChange={(checked) => setSetting({ key: 'offlineOnly', value: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="cache-maps">Auto-cache Map Areas</Label>
              <div className="text-xs text-muted-foreground">
                Automatically download map tiles when viewing maps
              </div>
            </div>
            <Switch
              id="cache-maps"
              checked={settings.autoCacheMaps as boolean ?? true}
              onCheckedChange={(checked) => setSetting({ key: 'autoCacheMaps', value: checked })}
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* Help & Information */}
      <div className="space-y-3">
        <h3 className="font-medium">About Offline Mode</h3>
        
        <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
          <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
          <div className="text-amber-800 dark:text-amber-200 text-xs">
            <strong>Note:</strong> Offline support is experimental and may not work perfectly in all situations.
          </div>
        </div>
        
        <div className="text-sm text-muted-foreground space-y-2">
          <p>
            Offline mode allows you to use Treasures without an internet connection. 
            The app automatically caches geocaches, profiles, and map data as you browse.
          </p>
          <p>When offline, you can:</p>
          <ul className="list-disc list-inside space-y-1 ml-4 text-xs">
            <li>View cached geocaches and their details</li>
            <li>Browse cached map areas</li>
            <li>Create logs and geocaches (synced when online)</li>
            <li>Access your saved/bookmarked caches</li>
          </ul>
          <p className="text-xs">
            All changes made while offline will be automatically synchronized 
            when your connection is restored.
          </p>
        </div>
      </div>
    </div>
  );
}