import React from 'react';
import { LucideIcon, MapPin, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface LoadingStateProps {
  icon?: LucideIcon;
  title?: string;
  description?: string;
  showSpinner?: boolean;
  fullPage?: boolean;
  className?: string;
}

export function LoadingState({
  icon: Icon = MapPin,
  title = "Loading...",
  description,
  showSpinner = true,
  fullPage = false,
  className = ""
}: LoadingStateProps) {
  const content = (
    <div className={`text-center ${className}`}>
      {showSpinner ? (
        <Loader2 className="h-12 w-12 text-gray-400 mx-auto mb-4 animate-spin" />
      ) : (
        <Icon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
      )}
      <p className="text-gray-600 font-medium">{title}</p>
      {description && (
        <p className="text-sm text-gray-500 mt-2">{description}</p>
      )}
    </div>
  );

  if (fullPage) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
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
        {description && <p className="text-gray-600 mb-4">{description}</p>}
        
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
          <p className="text-xs text-gray-500 mt-4">
            Error: {error instanceof Error ? error.message : error}
          </p>
        )}
      </CardContent>
    </Card>
  );

  if (fullPage) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-16">
          {content}
        </div>
      </div>
    );
  }

  return content;
}