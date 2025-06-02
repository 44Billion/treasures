/**
 * Offline status indicator component
 */

import { useState } from 'react';
import { Wifi, WifiOff, RefreshCw, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useOfflineSync, useOfflineMode } from '@/hooks/useOfflineStorage';
import { cn } from '@/lib/utils';

interface OfflineIndicatorProps {
  className?: string;
  compact?: boolean;
  showDetails?: boolean;
}

export function OfflineIndicator({ 
  className, 
  compact = false, 
  showDetails = true 
}: OfflineIndicatorProps) {
  const { status, forceSync } = useOfflineSync();
  const { 
    isOfflineMode, 
    isOnline, 
    isConnected, 
    connectionQuality, 
    isSyncing, 
    pendingActions, 
    lastSyncTime, 
    syncErrors,
    latency 
  } = useOfflineMode();
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

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
    try {
      await forceSync();
    } catch (error) {
      console.error('Force sync failed:', error);
    }
  };

  if (compact) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        {isConnected ? (
          connectionQuality === 'good' ? (
            <Wifi className="h-4 w-4 text-green-500" />
          ) : (
            <Wifi className="h-4 w-4 text-yellow-500" />
          )
        ) : (
          <WifiOff className="h-4 w-4 text-red-500" />
        )}
        {pendingActions > 0 && (
          <Badge variant="secondary" className="text-xs">
            {pendingActions}
          </Badge>
        )}
      </div>
    );
  }

  const StatusIcon = () => {
    if (isSyncing) {
      return <RefreshCw className="h-4 w-4 animate-spin text-blue-500" />;
    }
    if (!isConnected) {
      return <WifiOff className="h-4 w-4 text-red-500" />;
    }
    if (syncErrors.length > 0) {
      return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    }
    if (pendingActions > 0) {
      return <Clock className="h-4 w-4 text-orange-500" />;
    }
    if (connectionQuality === 'poor') {
      return <Wifi className="h-4 w-4 text-yellow-500" />;
    }
    return <CheckCircle className="h-4 w-4 text-green-500" />;
  };

  const getStatusText = () => {
    if (isSyncing) return 'Syncing...';
    if (!isConnected) return 'Offline';
    if (syncErrors.length > 0) return 'Sync errors';
    if (pendingActions > 0) return `${pendingActions} pending`;
    if (connectionQuality === 'poor') return 'Poor connection';
    return 'Connected';
  };

  const getStatusColor = () => {
    if (isSyncing) return 'text-blue-600';
    if (!isConnected) return 'text-red-600';
    if (syncErrors.length > 0) return 'text-yellow-600';
    if (pendingActions > 0) return 'text-orange-600';
    if (connectionQuality === 'poor') return 'text-yellow-600';
    return 'text-green-600';
  };

  if (!showDetails) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <StatusIcon />
        <span className={cn('text-sm font-medium', getStatusColor())}>
          {getStatusText()}
        </span>
      </div>
    );
  }

  return (
    <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn('flex items-center gap-2 h-8', className)}
        >
          <StatusIcon />
          <span className={cn('text-sm font-medium', getStatusColor())}>
            {getStatusText()}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <Card className="border-0 shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <StatusIcon />
              Connection Status
            </CardTitle>
            <CardDescription>
              {isConnected 
                ? `Connected to the internet${connectionQuality === 'poor' ? ' (poor connection)' : ''}` 
                : 'Working offline'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="font-medium text-muted-foreground">Status</div>
                <div className={getStatusColor()}>{getStatusText()}</div>
              </div>
              <div>
                <div className="font-medium text-muted-foreground">Last Sync</div>
                <div>{formatLastSync(lastSyncTime)}</div>
              </div>
              {latency && (
                <>
                  <div>
                    <div className="font-medium text-muted-foreground">Latency</div>
                    <div>{latency}ms</div>
                  </div>
                  <div>
                    <div className="font-medium text-muted-foreground">Quality</div>
                    <div className={connectionQuality === 'good' ? 'text-green-600' : 'text-yellow-600'}>
                      {connectionQuality}
                    </div>
                  </div>
                </>
              )}
            </div>

            {pendingActions > 0 && (
              <div className="space-y-2">
                <div className="font-medium text-sm">Pending Actions</div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {pendingActions} action{pendingActions !== 1 ? 's' : ''} waiting to sync
                  </span>
                  <Badge variant="secondary">{pendingActions}</Badge>
                </div>
              </div>
            )}

            {syncErrors.length > 0 && (
              <div className="space-y-2">
                <div className="font-medium text-sm text-yellow-600">Sync Errors</div>
                <div className="space-y-1">
                  {syncErrors.slice(0, 3).map((error, index) => (
                    <div key={index} className="text-xs text-muted-foreground bg-yellow-50 p-2 rounded">
                      {error}
                    </div>
                  ))}
                  {syncErrors.length > 3 && (
                    <div className="text-xs text-muted-foreground">
                      +{syncErrors.length - 3} more errors
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              {isConnected && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleForceSync}
                  disabled={isSyncing}
                  className="flex-1"
                >
                  {isSyncing ? (
                    <>
                      <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                      Syncing...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-3 w-3 mr-1" />
                      Sync Now
                    </>
                  )}
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIsPopoverOpen(false)}
                className="flex-1"
              >
                Close
              </Button>
            </div>

            <div className="text-xs text-muted-foreground">
              {isOfflineMode ? (
                'App is working offline. Changes will sync when connection is restored.'
              ) : (
                'App is online and syncing automatically.'
              )}
            </div>
          </CardContent>
        </Card>
      </PopoverContent>
    </Popover>
  );
}

// Compact version for headers/toolbars
export function OfflineStatusBadge({ className }: { className?: string }) {
  return <OfflineIndicator compact className={className} />;
}

// Simple icon-only version
export function OfflineStatusIcon({ className }: { className?: string }) {
  return <OfflineIndicator compact showDetails={false} className={className} />;
}