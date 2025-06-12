/**
 * Utility functions for working with browser caches
 */

import { CACHE_NAMES, type CacheName } from '@/shared/config/cache';

/**
 * Check if a cache exists
 */
export async function cacheExists(cacheName: CacheName): Promise<boolean> {
  try {
    const cacheNames = await caches.keys();
    return cacheNames.includes(cacheName);
  } catch (error) {
    console.error('Failed to check cache existence:', error);
    return false;
  }
}

/**
 * Get the number of entries in a cache
 */
export async function getCacheEntryCount(cacheName: CacheName): Promise<number> {
  try {
    if (!(await cacheExists(cacheName))) {
      return 0;
    }
    
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    return keys.length;
  } catch (error) {
    console.error(`Failed to count entries in cache ${cacheName}:`, error);
    return 0;
  }
}

/**
 * Clear a cache if it exists
 */
export async function clearCache(cacheName: CacheName): Promise<boolean> {
  try {
    if (await cacheExists(cacheName)) {
      return await caches.delete(cacheName);
    }
    return true;
  } catch (error) {
    console.error(`Failed to clear cache ${cacheName}:`, error);
    return false;
  }
}

/**
 * Get all cache names and their entry counts
 */
export async function getAllCacheInfo(): Promise<Array<{ name: string; count: number; sampleUrls: string[] }>> {
  try {
    const cacheNames = await caches.keys();
    const cacheInfo: Array<{ name: string; count: number; sampleUrls: string[] }> = [];
    
    for (const cacheName of cacheNames) {
      const cache = await caches.open(cacheName);
      const keys = await cache.keys();
      const sampleUrls = keys.slice(0, 3).map(req => req.url);
      
      cacheInfo.push({
        name: cacheName,
        count: keys.length,
        sampleUrls,
      });
    }
    
    return cacheInfo;
  } catch (error) {
    console.error('Failed to get cache info:', error);
    return [];
  }
}

/**
 * Cache a single tile manually
 */
export async function cacheMapTile(tileUrl: string): Promise<boolean> {
  try {
    const response = await fetch(tileUrl);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAMES.OSM_TILES);
      await cache.put(tileUrl, response.clone());
      return true;
    }
    return false;
  } catch (error) {
    console.error('Failed to cache tile:', error);
    return false;
  }
}