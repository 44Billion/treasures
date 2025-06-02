/**
 * Offline status indicator component
 */

import { Wifi, WifiOff } from 'lucide-react';
import { useOfflineMode, useOfflineSettings } from '@/hooks/useOfflineStorage';
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
  const { isConnected } = useOfflineMode();
  const { settings } = useOfflineSettings();
  
  // Check if user has enabled offline-only mode
  const isOfflineOnly = settings.offlineOnly as boolean ?? false;
  
  // Show offline if not connected OR if user has enabled offline-only mode
  const showOffline = !isConnected || isOfflineOnly;

  if (compact) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        {showOffline ? (
          <WifiOff className="h-4 w-4 text-gray-500" />
        ) : (
          <Wifi className="h-4 w-4 text-green-500" />
        )}
      </div>
    );
  }

  if (!showDetails) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        {showOffline ? (
          <WifiOff className="h-4 w-4 text-gray-500" />
        ) : (
          <Wifi className="h-4 w-4 text-green-500" />
        )}
        <span className={cn('text-sm font-medium', showOffline ? 'text-gray-500' : 'text-green-600')}>
          {showOffline ? 'Offline' : 'Online'}
        </span>
      </div>
    );
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {showOffline ? (
        <WifiOff className="h-4 w-4 text-gray-500" />
      ) : (
        <Wifi className="h-4 w-4 text-green-500" />
      )}
      <span className={cn('text-sm font-medium', showOffline ? 'text-gray-500' : 'text-green-600')}>
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
  return <OfflineIndicator compact showDetails={false} className={className} />;
}