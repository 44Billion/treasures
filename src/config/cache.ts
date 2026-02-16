/**
 * Cache names used throughout the application
 * These should match the cache names in vite.config.ts
 */

export const CACHE_NAMES = {
  OSM_TILES: 'osm-tiles', // This matches the service worker cache name in vite.config.ts
  IMAGES: 'images',
} as const;

export type CacheName = typeof CACHE_NAMES[keyof typeof CACHE_NAMES];