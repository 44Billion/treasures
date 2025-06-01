import React from 'react';
import { LucideIcon, MapPin, Loader2, Compass } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface LoadingStateProps {
  icon?: LucideIcon;
  title?: string;
  description?: string;
  showSpinner?: boolean;
  fullPage?: boolean;
  className?: string;
  transition?: boolean; // New prop to indicate this is a page transition loading
}

export function LoadingState({
  icon: Icon = MapPin,
  title = "Loading...",
  description,
  showSpinner = true,
  fullPage = false,
  className = "",
  transition = false
}: LoadingStateProps) {
  const content = (
    <div className={`text-center ${className}`}>
      {showSpinner ? (
        transition ? (
          <Compass className="h-12 w-12 text-muted-foreground mx-auto mb-4 animate-spin" />
        ) : (
          <Loader2 className="h-12 w-12 text-muted-foreground mx-auto mb-4 animate-spin" />
        )
      ) : (
        <Icon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
      )}
      <p className="text-foreground font-medium">{title}</p>
      {description && (
        <p className="text-sm text-muted-foreground mt-2">{description}</p>
      )}
    </div>
  );

  if (fullPage) {
    return (
      <div className="h-mobile-fit md:h-screen w-full bg-muted/30 flex items-center justify-center overflow-hidden">
        {content}
      </div>
    );
  }

  return content;
}

interface ErrorStateProps {
  icon?: LucideIcon;
  title?: string;
  description?: string;
  error?: Error | string | null;
  onRetry?: () => void;
  primaryAction?: React.ReactNode;
  secondaryAction?: React.ReactNode;
  fullPage?: boolean;
}

export function ErrorState({
  icon: Icon = MapPin,
  title = "Something went wrong",
  description,
  error,
  onRetry,
  primaryAction,
  secondaryAction,
  fullPage = false
}: ErrorStateProps) {
  const content = (
    <Card className="max-w-md mx-auto">
      <CardContent className="pt-6 text-center">
        <Icon className="h-12 w-12 text-red-400 mx-auto mb-4" />
        <p className="text-lg font-medium mb-2">{title}</p>
        {description && <p className="text-muted-foreground mb-4">{description}</p>}
        
        <div className="space-y-2">
          {primaryAction}
          {onRetry && !primaryAction && (
            <Button onClick={onRetry} className="w-full">
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