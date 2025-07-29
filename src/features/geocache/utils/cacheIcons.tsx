import React from 'react';
import { Compass, HelpCircle } from 'lucide-react';
import { chest as chestPaths } from '@lucide/lab';
import { useTheme } from 'next-themes';
import type { CacheType, CacheIconProps } from './cacheIcons.types';

// Create a proper React component for the chest icon
const Chest = React.forwardRef<SVGSVGElement, React.SVGProps<SVGSVGElement>>(
  ({ className, strokeWidth = 2, ...props }, ref) => (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      {chestPaths.map(([element, props], index) => 
        React.createElement(element, { key: props.key || index, ...props })
      )}
    </svg>
  )
);

Chest.displayName = "Chest";

// Move constants outside the component to avoid Fast Refresh issues
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

const adventureIconStyle: React.CSSProperties = {
  background: `url('/parchment-50.jpg'), #5f7292`,
  backgroundBlendMode: 'darken',
  backgroundSize: '50px 50px, auto',
  border: '2px solid #4a5a6b',
  borderRadius: '6px',
  width: '100%',
  height: '100%',
  color: '#FFFFFF',
  boxShadow: '0 2px 4px rgba(63, 74, 90, 0.3)',
  transition: 'all 0.2s ease',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
};

/**
 * CacheIcon component for rendering cache type icons
 * This ensures consistency between map markers and UI cards
 */
export function CacheIcon({ type, size = 'md', className, theme }: CacheIconProps): React.ReactNode {
  const isAdventureTheme = theme === 'adventure';
  const cacheType = type.toLowerCase() as CacheType;
  
  if (isAdventureTheme) {
    const iconProps = {
      className: `${sizeClasses[size]} ${className || ''}`.trim(),
      strokeWidth: 2.5,
      style: { color: '#FFFFFF' }
    };
    
    const IconComponent = (() => {
      switch (cacheType) {
        case 'traditional':
          return <Chest {...iconProps} />;
        case 'multi':
          return <Compass {...iconProps} />;
        case 'mystery':
          return <HelpCircle {...iconProps} />;
        default:
          return <Chest {...iconProps} />;
      }
    })();
    
    return (
      <div 
        style={adventureIconStyle}
        className="adventure-cache-icon"
      >
        {IconComponent}
      </div>
    );
  }
  
  const iconClass = `${sizeClasses[size]} ${colorClasses[cacheType] || colorClasses.traditional} ${className || ''}`.trim();
  
  const iconProps = {
    className: iconClass,
    strokeWidth: 2.5
  };
  
  switch (cacheType) {
    case 'traditional':
      return <Chest {...iconProps} />;
    case 'multi':
      return <Compass {...iconProps} />;
    case 'mystery':
      return <HelpCircle {...iconProps} />;
    default:
      return <Chest {...iconProps} />;
  }
}

/**
 * Hook-based cache icon component that uses the current theme
 */
export function useCacheIcon(type: string, size: 'sm' | 'md' | 'lg' = 'md', className?: string): React.ReactNode {
  const { theme } = useTheme();
  return <CacheIcon type={type} size={size} className={className} theme={theme} />;
}