/**
 * Offline settings component for managing offline functionality
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
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
import { useOfflineSync, useOfflineSettings, useOfflineMode } from '@/hooks/useOfflineStorage';
import { useConnectivity } from '@/hooks/useConnectivity';
import { useOfflineMapData } from '@/components/OfflineMap';
import { useOfflineStorageInfo } from '@/hooks/useOfflineStorageInfo';
import { useToast } from '@/hooks/useToast';
import { offlineStorage } from '@/lib/offlineStorage';

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
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {isOnline ? (
              <Wifi className="h-5 w-5 text-green-500" />
            ) : (
              <WifiOff className="h-5 w-5 text-red-500" />
            )}
            Connection Status
          </CardTitle>
          <CardDescription>
            Current network status and synchronization information
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Status</Label>
              <div className={`text-sm font-medium ${isConnected ? 'text-green-600' : 'text-red-600'}`}>
                {isConnected ? `Connected (${connectionQuality})` : 'Offline'}
              </div>
            </div>
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Last Sync</Label>
              <div className="text-sm">{formatLastSync(lastSyncTime)}</div>
            </div>
            {latency && (
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Latency</Label>
                <div className="text-sm">{latency}ms</div>
              </div>
            )}
          </div>

          {pendingActions > 0 && (
            <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-orange-600" />
                <span className="text-sm font-medium text-orange-800">
                  {pendingActions} action{pendingActions !== 1 ? 's' : ''} pending sync
                </span>
              </div>
              <Badge variant="secondary">{pendingActions}</Badge>
            </div>
          )}

          {syncErrors.length > 0 && (
            <div className="p-3 bg-red-50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <span className="text-sm font-medium text-red-800">Sync Errors</span>
              </div>
              <div className="space-y-1">
                {syncErrors.slice(0, 2).map((error, index) => (
                  <div key={index} className="text-xs text-red-700 bg-red-100 p-2 rounded">
                    {error}
                  </div>
                ))}
                {syncErrors.length > 2 && (
                  <div className="text-xs text-red-600">
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
        </CardContent>
      </Card>

      {/* Storage Usage */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardDrive className="h-5 w-5" />
            Storage Usage
          </CardTitle>
          <CardDescription>
            Local storage usage for offline functionality
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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

          <Separator />

          <div className="space-y-3">
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
            
            <Button
              variant="outline"
              onClick={refreshStorageInfo}
              className="w-full"
              size="sm"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh Storage Info
            </Button>
          </div>

          <Button
            variant="destructive"
            onClick={handleClearOfflineData}
            disabled={isClearing}
            className="w-full"
          >
            {isClearing ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Clearing...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4 mr-2" />
                Clear All Offline Data
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Offline Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Offline Preferences</CardTitle>
          <CardDescription>
            Configure how the app behaves when offline
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="auto-sync">Auto Sync</Label>
              <div className="text-sm text-muted-foreground">
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
              <div className="text-sm text-muted-foreground">
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
              <div className="text-sm text-muted-foreground">
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
              <div className="text-sm text-muted-foreground">
                Automatically download map tiles when viewing maps and using "Near Me"
              </div>
            </div>
            <Switch
              id="cache-maps"
              checked={settings.autoCacheMaps as boolean ?? true}
              onCheckedChange={(checked) => setSetting({ key: 'autoCacheMaps', value: checked })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Help & Information */}
      <Card>
        <CardHeader>
          <CardTitle>About Offline Mode</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg mb-4">
            <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="text-amber-800 text-xs">
              <strong>Note:</strong> Offline support is experimental and may not work perfectly in all situations.
            </div>
          </div>
          <p>
            Offline mode allows you to use Treasures without an internet connection. 
            The app automatically caches geocaches, profiles, and map data as you browse.
          </p>
          <p>
            When offline, you can:
          </p>
          <ul className="list-disc list-inside space-y-1 ml-4">
            <li>View cached geocaches and their details</li>
            <li>Browse cached map areas</li>
            <li>Create logs and geocaches (synced when online)</li>
            <li>Access your saved/bookmarked caches</li>
          </ul>
          <p>
            All changes made while offline will be automatically synchronized 
            when your connection is restored.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}