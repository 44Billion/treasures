import React from 'react';
import ErrorBoundary from './ErrorBoundary';

interface CompactErrorBoundaryProps {
  children: React.ReactNode;
  message?: string;
}

// Compact error boundary for smaller components
export function CompactErrorBoundary({ 
  children, 
  message = "Something went wrong" 
}: CompactErrorBoundaryProps) {
  const fallback = (
    <div className="m-4 p-4 border border-red-200 rounded-md bg-red-50 dark:border-red-800 dark:bg-red-900/20">
      <div className="flex items-center">
        <span className="text-sm text-red-800 dark:text-red-200">{message}</span>
      </div>
    </div>
  );
  
  return (
    <ErrorBoundary fallback={fallback}>
      {children}
    </ErrorBoundary>
  );
}