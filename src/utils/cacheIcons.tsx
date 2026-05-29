import React from 'react';
import { Compass, HelpCircle, Palette } from 'lucide-react';
import type { CacheType, CacheIconProps } from './cacheIcons.types';
import { Chest, sizeClasses, colorClasses, adventureIconStyle, mojaveIconStyle, MOJAVE_AMBER } from '@/config/cacheIconConstants';

/**
 * CacheIcon component for rendering cache type icons
 * This ensures consistency between map markers and UI cards
 *
 * When `isArt` is true, the per-type glyph is swapped for a `Palette`
 * glyph — mirroring the map marker behavior in `cacheMapIcons.ts` — so a
 * treasure tagged with the `art` modifier reads visibly as "art" wherever
 * its icon appears (cards, lists, etc.). The cache type's color is
 * preserved so the type is still legible at a glance.
 */
export function CacheIcon({ type, size = 'md', className, theme, isArt = false }: CacheIconProps): React.ReactNode {
  const isAdventureTheme = theme === 'adventure';
  const isMojaveTheme = theme === 'mojave';
  const cacheType = type.toLowerCase() as CacheType;

  if (isAdventureTheme) {
    const iconProps = {
      className: `${sizeClasses[size]} ${className || ''}`.trim(),
      strokeWidth: 2.5,
      style: { color: '#FFFFFF' }
    };

    const IconComponent = (() => {
      if (isArt) return <Palette {...iconProps} />;
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

  if (isMojaveTheme) {
    // Pip-Boy CRT: amber outline glyph on a dark terminal panel.
    const iconProps = {
      className: `${sizeClasses[size]} ${className || ''}`.trim(),
      strokeWidth: 2,
      style: { color: MOJAVE_AMBER }
    };

    const IconComponent = (() => {
      if (isArt) return <Palette {...iconProps} />;
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
        style={mojaveIconStyle}
        className="mojave-cache-icon"
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

  if (isArt) {
    return <Palette {...iconProps} />;
  }

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

