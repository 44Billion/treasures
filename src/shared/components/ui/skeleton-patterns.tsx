import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { RelayErrorFallback } from '@/components/RelayErrorFallback';
import { cn } from '@/shared/utils/utils';

// ============================================================================
// GEOCACHE CARD SKELETONS
// ============================================================================

interface GeocacheCardSkeletonProps {
  variant?: 'compact' | 'default' | 'detailed' | 'featured';
  className?: string;
}

export function GeocacheCardSkeleton({ 
  variant = 'default', 
  className 
}: GeocacheCardSkeletonProps) {
  if (variant === 'compact') {
    return (
      <Card className={cn('animate-pulse', className)}>
        <CardContent className="p-3">
          <div className="flex items-start gap-3">
            <Skeleton className="w-8 h-8 rounded-full shrink-0" />
            <div className="flex-1 min-w-0 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
              <div className="flex gap-1">
                <Skeleton className="h-5 w-8" />
                <Skeleton className="h-5 w-8" />
                <Skeleton className="h-5 w-12" />
              </div>
            </div>
            <Skeleton className="w-7 h-7 shrink-0" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (variant === 'detailed') {
    return (
      <Card className={cn('animate-pulse', className)}>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Skeleton className="w-12 h-12 rounded-full shrink-0" />
            <div className="flex-1 min-w-0 space-y-3">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-2/3" />
              <div className="flex gap-2">
                <Skeleton className="h-6 w-10" />
                <Skeleton className="h-6 w-10" />
                <Skeleton className="h-6 w-16" />
              </div>
              <div className="flex gap-3">
                <Skeleton className="h-4 w-8" />
                <Skeleton className="h-4 w-8" />
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <Skeleton className="w-8 h-8" />
              <Skeleton className="w-8 h-8" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (variant === 'featured') {
    return (
      <Card className={cn('animate-pulse', className)}>
        <CardContent className="p-3 sm:p-4">
          <div className="flex items-start gap-3 sm:gap-4">
            <Skeleton className="w-10 h-10 sm:w-12 sm:h-12 rounded-full shrink-0" />
            <div className="flex-1 min-w-0 space-y-2 sm:space-y-3">
              <div className="flex items-start justify-between gap-2">
                <Skeleton className="h-4 w-3/4" />
                <div className="flex gap-0.5 sm:gap-1 shrink-0">
                  <Skeleton className="w-6 h-6 sm:w-7 sm:h-7 rounded" />
                  <Skeleton className="w-6 h-6 sm:w-7 sm:h-7 rounded" />
                </div>
              </div>
              <Skeleton className="h-3 w-1/2" />
              <div className="hidden sm:block space-y-2">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-2/3" />
              </div>
              <div className="flex items-center justify-between">
                <div className="flex gap-1 sm:gap-1.5">
                  <Skeleton className="h-5 w-6 sm:w-8" />
                  <Skeleton className="h-5 w-6 sm:w-8" />
                  <Skeleton className="h-5 w-8 sm:w-12" />
                </div>
                <div className="flex gap-2 sm:gap-3">
                  <Skeleton className="h-4 w-4 sm:w-6" />
                  <Skeleton className="h-4 w-4 sm:w-6" />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Default variant
  return (
    <Card className={cn('animate-pulse', className)}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <Skeleton className="w-16 h-16 rounded-full shrink-0" />
          <Skeleton className="w-8 h-8" />
        </div>
        <Skeleton className="h-6 w-3/4" />
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-5 w-16" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 mb-4">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-2/3" />
        </div>
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <Skeleton className="h-6 w-10" />
            <Skeleton className="h-6 w-10" />
            <Skeleton className="h-6 w-16" />
          </div>
          <div className="flex gap-3">
            <Skeleton className="h-4 w-8" />
            <Skeleton className="h-4 w-8" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// GEOCACHE LIST SKELETONS
// ============================================================================

interface GeocacheListSkeletonProps {
  count?: number;
  variant?: 'compact' | 'default' | 'detailed' | 'featured';
  compact?: boolean;
  className?: string;
}

export function GeocacheListSkeleton({ 
  count = 6, 
  variant = 'default',
  compact = false,
  className 
}: GeocacheListSkeletonProps) {
  const skeletonVariant = compact ? 'compact' : variant;
  
  return (
    <div className={cn(
      compact ? "space-y-2" : 
      variant === 'featured' ? "grid gap-6 md:grid-cols-2 lg:grid-cols-3" :
      "grid md:grid-cols-2 lg:grid-cols-3 gap-4",
      className
    )}>
      {Array.from({ length: count }).map((_, i) => (
        <GeocacheCardSkeleton 
          key={i} 
          variant={skeletonVariant}
        />
      ))}
    </div>
  );
}

// ============================================================================
// PROGRESSIVE LOADING WRAPPER
// ============================================================================

interface ProgressiveLoadingProps {
  isLoading: boolean;
  hasData: boolean;
  skeletonCount?: number;
  skeletonVariant?: 'compact' | 'default' | 'detailed' | 'featured';
  compact?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function ProgressiveLoading({
  isLoading,
  hasData,
  skeletonCount = 6,
  skeletonVariant = 'default',
  compact = false,
  children,
  className
}: ProgressiveLoadingProps) {
  // Show skeleton only if loading and no data
  if (isLoading && !hasData) {
    return (
      <GeocacheListSkeleton 
        count={skeletonCount}
        variant={skeletonVariant}
        compact={compact}
        className={className}
      />
    );
  }

  // Show data (with optional loading overlay for refreshes)
  return (
    <div className={cn(isLoading && hasData && 'opacity-75 transition-opacity', className)}>
      {children}
    </div>
  );
}

// ============================================================================
// SMART LOADING STATE
// ============================================================================

interface SmartLoadingStateProps {
  isLoading: boolean;
  isError: boolean;
  hasData: boolean;
  data?: any[];
  error?: Error | null;
  onRetry?: () => void;
  skeletonCount?: number;
  skeletonVariant?: 'compact' | 'default' | 'detailed' | 'featured';
  compact?: boolean;
  emptyState?: React.ReactNode;
  errorState?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  /** Whether to show relay switcher for errors and empty states */
  showRelayFallback?: boolean;
  /** Whether the retry operation is in progress */
  isRetrying?: boolean;
}

export function SmartLoadingState({
  isLoading,
  isError,
  hasData,
  data,
  error,
  onRetry,
  skeletonCount = 6,
  skeletonVariant = 'default',
  compact = false,
  emptyState,
  errorState,
  children,
  className,
  showRelayFallback = true,
  isRetrying = false
}: SmartLoadingStateProps) {
  // Error state (with data fallback)
  if (isError && !hasData) {
    if (errorState) return <>{errorState}</>;
    
    if (showRelayFallback) {
      return (
        <RelayErrorFallback
          error={error}
          onRetry={onRetry}
          isRetrying={isRetrying}
          compact={compact}
          className={className}
        />
      );
    }
    
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <p className="text-sm font-medium text-red-600">Failed to load</p>
          <p className="text-xs text-muted-foreground mb-3">
            {error instanceof Error ? error.message : 'Network connection issue'}
          </p>
          {onRetry && (
            <button 
              onClick={onRetry}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              Try again
            </button>
          )}
        </div>
      </div>
    );
  }

  // Loading state (no data)
  if (isLoading && !hasData) {
    return (
      <GeocacheListSkeleton 
        count={skeletonCount}
        variant={skeletonVariant}
        compact={compact}
        className={className}
      />
    );
  }

  // Empty state - show when not loading, has attempted to load data, and no results
  if (!isLoading && hasData && (!data || data.length === 0)) {
    if (emptyState) return <>{emptyState}</>;
    
    if (showRelayFallback) {
      return (
        <RelayErrorFallback
          isEmpty={true}
          onRetry={onRetry}
          isRetrying={isRetrying}
          compact={compact}
          className={className}
          title="No Treasures Found"
          description="No geocaches were found. This might be due to relay connectivity issues or the current relay may not have any data."
        />
      );
    }
    
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center text-muted-foreground">
          <p>No geocaches found</p>
        </div>
      </div>
    );
  }

  // Data state (with optional loading overlay)
  return (
    <div className={cn(
      isLoading && hasData && 'opacity-75 transition-opacity duration-200',
      className
    )}>
      {children}
    </div>
  );
}