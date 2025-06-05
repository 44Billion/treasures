import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

// ============================================================================
// GEOCACHE CARD SKELETONS
// ============================================================================

interface GeocacheCardSkeletonProps {
  variant?: 'compact' | 'default' | 'detailed';
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
  variant?: 'compact' | 'default' | 'detailed';
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
      compact ? "space-y-2" : "grid md:grid-cols-2 lg:grid-cols-3 gap-4",
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
// MAP SIDEBAR SKELETON
// ============================================================================

export function MapSidebarSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('space-y-4', className)}>
      {/* Search and filters skeleton */}
      <div className="space-y-3">
        <Skeleton className="h-10 w-full" />
        <div className="flex gap-2">
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 flex-1" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-8 flex-1" />
          <Skeleton className="h-8 w-20" />
        </div>
      </div>
      
      {/* Results header skeleton */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-6 w-6" />
      </div>
      
      {/* Compact geocache list skeleton */}
      <GeocacheListSkeleton 
        count={8} 
        variant="compact" 
        compact={true}
      />
    </div>
  );
}

// ============================================================================
// HOME PAGE SKELETON
// ============================================================================

export function HomePageGeocachesSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('space-y-6', className)}>
      {/* Section header skeleton */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-20" />
        </div>
      </div>
      
      {/* Geocache grid skeleton */}
      <GeocacheListSkeleton count={3} />
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
  skeletonVariant?: 'compact' | 'default' | 'detailed';
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
  skeletonVariant?: 'compact' | 'default' | 'detailed';
  compact?: boolean;
  emptyState?: React.ReactNode;
  errorState?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
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
  className
}: SmartLoadingStateProps) {
  // Error state (with data fallback)
  if (isError && !hasData) {
    if (errorState) return <>{errorState}</>;
    
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

  // Empty state
  if (!isLoading && hasData && data?.length === 0) {
    if (emptyState) return <>{emptyState}</>;
    
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