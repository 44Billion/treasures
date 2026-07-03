import React from 'react';
import { Compass, HelpCircle, Palette, PiggyBank } from 'lucide-react';
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
 *
 * When `isPiggy` is true (Lightning Piggy `client` tag), the glyph is
 * swapped for a `PiggyBank` glyph instead — again mirroring the map
 * marker. It takes precedence over `isArt`. In the default theme the
 * glyph renders pink (`text-pink-500`) on the caller's normal backdrop.
 */
export function CacheIcon({ type, size = 'md', className, theme, isArt = false, isPiggy = false }: CacheIconProps): React.ReactNode {
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
      if (isPiggy) return <PiggyBank {...iconProps} />;
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
      if (isPiggy) return <PiggyBank {...iconProps} />;
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

  // Lightning Piggy treasures render a pink pig glyph on the caller's
  // normal icon backdrop (the map marker is where the full pink
  // background treatment lives — see `cacheMapIcons.ts`).
  if (isPiggy) {
    const piggyClass = `${sizeClasses[size]} text-pink-500 ${className || ''}`.trim();
    return <PiggyBank className={piggyClass} strokeWidth={2.5} />;
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

