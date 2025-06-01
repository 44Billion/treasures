import React from 'react';
import { Compass } from 'lucide-react';

interface CompassLoadingProps {
  title?: string;
  description?: string;
  fullPage?: boolean;
  className?: string;
}

export function CompassLoading({
  title = "Loading...",
  description,
  fullPage = false,
  className = ""
}: CompassLoadingProps) {
  const content = (
    <div className={`text-center ${className}`}>
      <Compass className="h-12 w-12 text-green-600 mx-auto mb-4 animate-spin" />
      <p className="text-foreground font-medium">{title}</p>
      {description && (
        <p className="text-sm text-muted-foreground mt-2">{description}</p>
      )}
    </div>
  );

  if (fullPage) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center">
        {content}
      </div>
    );
  }

  return content;
}

// Small compass loader for inline use
export function CompassSpinner({ className = "", size = 20 }: { className?: string; size?: number }) {
  return (
    <Compass 
      className={`animate-spin text-green-600 ${className}`} 
      style={{ width: size, height: size }} 
    />
  );
}