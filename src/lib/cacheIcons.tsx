import React from 'react';
import { Package, Compass, HelpCircle } from 'lucide-react';

export type CacheType = 'traditional' | 'multi' | 'mystery';

export interface CacheIconProps {
  type: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * Get the appropriate Lucide icon component for a cache type
 * This ensures consistency between map markers and UI cards
 */
export function getCacheIcon(type: string, size: 'sm' | 'md' | 'lg' = 'md', className?: string): React.ReactNode {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-5 w-5", 
    lg: "h-8 w-8"
  };
  
  const colorClasses = {
    traditional: "text-emerald-600",
    multi: "text-amber-600", 
    mystery: "text-purple-600"
  };
  
  const cacheType = type.toLowerCase() as CacheType;
  const iconClass = `${sizeClasses[size]} ${colorClasses[cacheType] || colorClasses.traditional} ${className || ''}`.trim();
  
  const iconProps = {
    className: iconClass,
    strokeWidth: 2.5
  };
  
  switch (cacheType) {
    case 'traditional':
      return <Package {...iconProps} />;
    case 'multi':
      return <Compass {...iconProps} />;
    case 'mystery':
      return <HelpCircle {...iconProps} />;
    default:
      return <Package {...iconProps} />;
  }
}

/**
 * Get the SVG string for a cache type (used in map markers)
 * This matches the Lucide icons used in the UI
 */
export function getCacheIconSvg(type: string): string {
  const cacheType = type.toLowerCase() as CacheType;
  
  switch (cacheType) {
    case 'traditional':
      // Package icon SVG
      return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="m7.5 4.27 9 5.15"/>
        <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/>
        <path d="m3.3 7 8.7 5 8.7-5"/>
        <path d="M12 22V12"/>
      </svg>`;
    case 'multi':
      // Compass icon SVG
      return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <polygon points="16.24,7.76 14.12,14.12 7.76,16.24 9.88,9.88"/>
      </svg>`;
    case 'mystery':
      // HelpCircle icon SVG
      return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
        <path d="M12 17h.01"/>
      </svg>`;
    default:
      // Default to package icon
      return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="m7.5 4.27 9 5.15"/>
        <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/>
        <path d="m3.3 7 8.7 5 8.7-5"/>
        <path d="M12 22V12"/>
      </svg>`;
  }
}

/**
 * Get the color for a cache type (used in map markers)
 */
export function getCacheColor(type: string): string {
  const cacheType = type.toLowerCase() as CacheType;
  
  const colors = {
    traditional: '#10b981', // Emerald-500
    multi: '#f59e0b',      // Amber-500
    mystery: '#8b5cf6',    // Purple-500
  };
  
  return colors[cacheType] || colors.traditional;
}