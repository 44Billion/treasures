/**
 * Cache-related constants for the application
 */

// Cache types
export const CACHE_TYPES = {
  TRADITIONAL: 'traditional',
  MULTI: 'multi',
  MYSTERY: 'mystery',
  VIRTUAL: 'virtual',
  EVENT: 'event',
} as const;

// Cache sizes
export const CACHE_SIZES = {
  MICRO: 'micro',
  SMALL: 'small', 
  REGULAR: 'regular',
  LARGE: 'large',
  VIRTUAL: 'virtual',
} as const;

// Difficulty and terrain ratings
export const DIFFICULTY_LEVELS = [1, 2, 3, 4, 5] as const;
export const TERRAIN_LEVELS = [1, 2, 3, 4, 5] as const;

// Cache status
export const CACHE_STATUS = {
  ACTIVE: 'active',
  DISABLED: 'disabled',
  ARCHIVED: 'archived',
} as const;

// Log types
export const LOG_TYPES = {
  FOUND: 'found',
  NOT_FOUND: 'not-found',
  NOTE: 'note',
  MAINTENANCE: 'maintenance',
  DISABLED: 'disabled',
  ENABLED: 'enabled',
} as const;

export type CacheType = typeof CACHE_TYPES[keyof typeof CACHE_TYPES];
export type CacheSize = typeof CACHE_SIZES[keyof typeof CACHE_SIZES];
export type CacheStatus = typeof CACHE_STATUS[keyof typeof CACHE_STATUS];
export type LogType = typeof LOG_TYPES[keyof typeof LOG_TYPES];