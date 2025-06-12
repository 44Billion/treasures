import React from 'react';
import { LucideIcon, MapPin, Compass, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/shared/utils/utils';
import { useTheme } from 'next-themes';

// ============================================================================
// COMPASS SPINNER - Base component for all loading states
// ============================================================================

interface CompassSpinnerProps {
  size?: number | 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'page' | 'component';
  className?: string;
}

export function CompassSpinner({ 
  size = 'md', 
  variant = 'component',
  className = '' 
}: CompassSpinnerProps) {
  // Size mapping
  const sizeClasses = typeof size === 'number' 
    ? { width: `${size}px`, height: `${size}px` }
    : {
        sm: 'h-4 w-4',
        md: 'h-6 w-6', 
        lg: 'h-8 w-8',
        xl: 'h-12 w-12'
      }[size];

  // Use green for page loads (like the old compass-loading.tsx), grey for components
  const { theme } = useTheme();
  const isAdventureTheme = theme === 'adventure';
  const colorClass = variant === 'page' ? isAdventureTheme ? 'text-stone-600' : 'text-green-600' : 'text-muted-foreground';

  return (
    <Compass 
      className={cn('animate-spin', colorClass, typeof size === 'string' ? sizeClasses : '', className)}
      style={typeof size === 'number' ? sizeClasses as React.CSSProperties : undefined}
    />
  );
}

// ============================================================================
// LOADING STATE - Main loading component with text
// ============================================================================

interface LoadingStateProps {
  title?: string;
  description?: string;
  variant?: 'page' | 'component';
  size?: 'sm' | 'md' | 'lg';
  fullPage?: boolean;
  className?: string;
  icon?: LucideIcon;
  showSpinner?: boolean;
}

export function LoadingState({
  title = "Loading...",
  description,
  variant = 'component',
  size = 'md',
  fullPage = false,
  className = "",
  icon: Icon,
  showSpinner = true
}: LoadingStateProps) {
  const sizeMap = {
    sm: { spinner: 'md', text: 'text-sm', desc: 'text-xs' },
    md: { spinner: 'lg', text: 'text-base', desc: 'text-sm' },
    lg: { spinner: 'xl', text: 'text-lg', desc: 'text-base' }
  };

  const sizes = sizeMap[size];

  const content = (
    <div className={cn('text-center', className)}>
      {showSpinner ? (
        <CompassSpinner 
          size={sizes.spinner as 'md' | 'lg' | 'xl'} 
          variant={variant}
          className="mx-auto mb-4" 
        />
      ) : Icon ? (
        <Icon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
      ) : null}
      
      <p className={cn('text-foreground font-medium', sizes.text)}>{title}</p>
      {description && (
        <p className={cn('text-muted-foreground mt-2', sizes.desc)}>{description}</p>
      )}
    </div>
  );

  if (fullPage) {
    return (
      <div className="fixed inset-0 z-50 bg-muted/30 flex items-center justify-center overflow-hidden">
        {content}
      </div>
    );
  }

  return content;
}

// ============================================================================
// INLINE LOADING - For buttons and inline elements
// ============================================================================

interface InlineLoadingProps {
  text?: string;
  variant?: 'page' | 'component';
  size?: number | 'sm' | 'md' | 'lg';
  className?: string;
}

export function InlineLoading({ 
  text, 
  variant = 'component',
  size = 'sm',
  className 
}: InlineLoadingProps) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <CompassSpinner size={size} variant={variant} />
      {text && <span className="text-sm">{text}</span>}
    </div>
  );
}

// ============================================================================
// ERROR STATE - For error handling
// ============================================================================

interface ErrorStateProps {
  icon?: LucideIcon;
  title?: string;
  description?: string;
  error?: Error | string | null;
  onRetry?: () => void;
  primaryAction?: React.ReactNode;
  secondaryAction?: React.ReactNode;
  fullPage?: boolean;
  className?: string;
}

export function ErrorState({
  icon: Icon = MapPin,
  title = "Something went wrong",
  description,
  error,
  onRetry,
  primaryAction,
  secondaryAction,
  fullPage = false,
  className
}: ErrorStateProps) {
  const content = (
    <Card className={cn('max-w-md mx-auto', className)}>
      <CardContent className="pt-6 text-center">
        <Icon className="h-12 w-12 text-red-400 mx-auto mb-4" />
        <p className="text-lg font-medium mb-2">{title}</p>
        {description && <p className="text-muted-foreground mb-4">{description}</p>}
        
        <div className="space-y-2">
          {primaryAction}
          {onRetry && !primaryAction && (
            <Button onClick={onRetry} className="w-full">
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          )}
          {secondaryAction}
        </div>
        
        {error && (
          <p className="text-xs text-muted-foreground mt-4">
            Error: {error instanceof Error ? error.message : error}
          </p>
        )}
      </CardContent>
    </Card>
  );

  if (fullPage) {
    return (
      <div className="h-mobile-fit md:h-screen w-full bg-muted/30 overflow-hidden">
        <div className="container mx-auto px-4 py-16 h-full flex items-center justify-center">
          {content}
        </div>
      </div>
    );
  }

  return content;
}

// ============================================================================
// CONVENIENCE EXPORTS - Pre-configured common patterns
// ============================================================================

// Page loading (green compass)
export const PageLoading = (props: Omit<LoadingStateProps, 'variant'>) => (
  <LoadingState {...props} variant="page" />
);

// Component loading (grey compass for inline states)
export const ComponentLoading = (props: Omit<LoadingStateProps, 'variant'>) => (
  <LoadingState {...props} variant="component" />
);

// Full page loading (green compass)
export const FullPageLoading = (props: Omit<LoadingStateProps, 'variant' | 'fullPage'>) => (
  <LoadingState {...props} variant="page" fullPage />
);

// Button loading (grey compass for inline states)
export const ButtonLoading = (props: Omit<InlineLoadingProps, 'variant'>) => (
  <InlineLoading {...props} variant="component" />
);

// Status loading (grey compass for inline states)
export const StatusLoading = (props: Omit<InlineLoadingProps, 'variant'>) => (
  <InlineLoading {...props} variant="component" />
);

// ============================================================================
// LEGACY COMPATIBILITY - For gradual migration
// ============================================================================

// CompassLoading compatibility
export function CompassLoading(props: {
  title?: string;
  description?: string;
  fullPage?: boolean;
  className?: string;
}) {
  return <LoadingState {...props} variant="page" />;
}

// LoadingSpinner compatibility  
export function LoadingSpinner(props: {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  return <CompassSpinner {...props} variant="component" />;
}