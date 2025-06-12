/**
 * Offline status indicator component
 */

import { Wifi, WifiOff } from 'lucide-react';
import { useOfflineMode, useOfflineSettings } from '@/features/offline/hooks/useOfflineStorage';
import { cn } from '@/shared/utils/utils';

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
  const { isConnected, isInitialCheck } = useOfflineMode();
  const { settings } = useOfflineSettings();
  
  // Check if user has enabled offline-only mode
  const isOfflineOnly = settings.offlineOnly as boolean ?? false;
  
  // Show offline if not connected OR if user has enabled offline-only mode
  const showOffline = !isConnected || isOfflineOnly;

  // Don't render anything during initial connectivity check to prevent flickering
  if (isInitialCheck) {
    return null;
  }

  if (compact) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        {showOffline ? (
          <WifiOff className="h-4 w-4 text-muted-foreground" />
        ) : (
          <Wifi className="h-4 w-4 text-primary" />
        )}
      </div>
    );
  }

  if (!showDetails) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        {showOffline ? (
          <WifiOff className="h-4 w-4 text-muted-foreground" />
        ) : (
          <Wifi className="h-4 w-4 text-primary" />
        )}
        <span className={cn('text-sm font-medium', showOffline ? 'text-muted-foreground' : 'text-primary')}>
          {showOffline ? 'Offline' : 'Online'}
        </span>
      </div>
    );
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {showOffline ? (
        <WifiOff className="h-4 w-4 text-muted-foreground" />
      ) : (
        <Wifi className="h-4 w-4 text-primary" />
      )}
      <span className={cn('text-sm font-medium', showOffline ? 'text-muted-foreground' : 'text-primary')}>
        {showOffline ? 'Offline' : 'Online'}
      </span>
    </div>
  );
}

// Compact version for headers/toolbars
export function OfflineStatusBadge({ className }: { className?: string }) {
  return <OfflineIndicator compact className={className} />;
}

// Simple icon-only version
export function OfflineStatusIcon({ className }: { className?: string }) {
  const { isConnected, isInitialCheck } = useOfflineMode();
  const { settings } = useOfflineSettings();
  
  // Check if user has enabled offline-only mode
  const isOfflineOnly = settings.offlineOnly as boolean ?? false;
  
  // Show offline if not connected OR if user has enabled offline-only mode
  const showOffline = !isConnected || isOfflineOnly;

  // Don't render anything during initial connectivity check to prevent flickering
  if (isInitialCheck) {
    return null;
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {showOffline ? (
        <WifiOff className="h-4 w-4 text-muted-foreground" />
      ) : (
        <Wifi className="h-4 w-4 text-primary" />
      )}
    </div>
  );
}