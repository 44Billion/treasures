import React from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DesktopHeader } from '@/components/DesktopHeader';
import { FullPageLoading, ErrorState } from '@/components/ui/loading';

interface LoadPageProps {
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  isError: boolean;
  /** Whether there's data available to render */
  hasData: boolean;
  /** Error object or message */
  error?: Error | string | null;
  /** Function to retry loading */
  onRetry?: () => void;
  /** Children to render when data is loaded successfully */
  children: React.ReactNode;
}

/**
 * Default loading state handler for pages.
 * Handles loading, error, not found, and success states with standard layout.
 */
export function LoadPage({
  isLoading,
  isError,
  hasData,
  error = null,
  onRetry,
  children
}: LoadPageProps) {
  // Only show loading state when we have no data to display (optimization for instant pages)
  if (isLoading && !hasData) {
    return (
      <FullPageLoading 
        title="Loading..."
        description="Checking multiple relays for the best connection..."
      />
    );
  }

  // Show error with retry option if there was an error and no cached data
  if (isError && !hasData) {
    return (
      <div className="min-h-screen bg-muted/50 dark:bg-muted dark:bg-muted">
        <DesktopHeader />
        <div className="container mx-auto px-4 py-16">
          <ErrorState
            title="Connection Issue"
            description="Unable to load content. This might be a temporary network issue."
            error={error}
            primaryAction={
              onRetry ? (
                <Button onClick={onRetry} className="w-full">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Try Again
                </Button>
              ) : undefined
            }
            secondaryAction={
              <Link to="/" className="block">
                <Button variant="outline" className="w-full">Back to Home</Button>
              </Link>
            }
          />
        </div>
      </div>
    );
  }

  // Show not found state if no loading, no error, but also no data
  if (!isLoading && !isError && !hasData) {
    return (
      <div className="min-h-screen bg-muted/50 dark:bg-muted dark:bg-muted">
        <DesktopHeader />
        <div className="container mx-auto px-4 py-16">
          <ErrorState
            title="Content Not Found"
            description="This content may have been removed or doesn't exist."
            primaryAction={
              <Link to="/" className="block">
                <Button className="w-full">Back to Home</Button>
              </Link>
            }
            secondaryAction={
              onRetry ? (
                <Button onClick={onRetry} variant="outline" className="w-full">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Check Again
                </Button>
              ) : undefined
            }
          />
        </div>
      </div>
    );
  }

  // Render children with standard page layout when data is available
  return (
    <div className="min-h-screen bg-muted/30">
      <DesktopHeader />
      {children}
    </div>
  );
}