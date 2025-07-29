import React from 'react';
import { Compass, HelpCircle } from 'lucide-react';
import type { CacheType, CacheIconProps } from './cacheIcons.types';
import { Chest, sizeClasses, colorClasses, adventureIconStyle } from '@/features/geocache/constants/cacheIconConstants';

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

