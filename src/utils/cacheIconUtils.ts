import type { CacheType } from './cacheIcons.types';

/**
 * Get the SVG string for a cache type (used in map markers)
 * This matches the Lucide icons used in the UI
 */
export function getCacheIconSvg(type: string): string {
  const cacheType = type.toLowerCase() as CacheType;
  
  switch (cacheType) {
    case 'traditional':
      // Chest icon SVG
      return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M8 19a2 2 0 0 0 2-2V9a4 4 0 0 0-8 0v8a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a4 4 0 0 0-4-4H6"/>
        <path d="M2 11h20"/>
        <path d="M16 11v3"/>
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
      // Default to chest icon
      return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M8 19a2 2 0 0 0 2-2V9a4 4 0 0 0-8 0v8a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a4 4 0 0 0-4-4H6"/>
        <path d="M2 11h20"/>
        <path d="M16 11v3"/>
      </svg>`;
  }
}

/**
 * Get the color for a cache type (used in map markers)
 */
export function getCacheColor(type: string): string {
  const cacheType = type.toLowerCase() as CacheType;
  
  const colors = {
    traditional: '#299e5e', // Brand green (primary)
    multi: '#f59e0b',      // Amber-500
    mystery: '#8b5cf6',    // Purple-500
  };
  
  return colors[cacheType] || colors.traditional;
}

