/**
 * Unified hook for offline storage information
 */

import { useState, useCallback } from 'react';
import { offlineStorage } from '@/lib/offlineStorage';
import { getCacheEntryCount } from '@/lib/cacheUtils';
import { CACHE_NAMES } from '@/lib/cacheConstants';

export interface StorageInfo {
  used: number;
  quota: number;
  geocaches: number;
  profiles: number;
  events: number;
  mapTiles: number;
}

export function useOfflineStorageInfo() {
  const [storageInfo, setStorageInfo] = useState<StorageInfo>({
    used: 0,
    quota: 0,
    geocaches: 0,
    profiles: 0,
    events: 0,
    mapTiles: 0,
  });

  const [isLoading, setIsLoading] = useState(false);

  const refreshStorageInfo = useCallback(async () => {
    setIsLoading(true);
    try {
      // Get storage quota
      let used = 0;
      let quota = 0;
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        used = estimate.usage || 0;
        quota = estimate.quota || 0;
      }

      // Count cached items in parallel
      const [geocaches, mapTiles] = await Promise.all([
        offlineStorage.getAllGeocaches(),
        getCacheEntryCount(CACHE_NAMES.OSM_TILES),
      ]);

      setStorageInfo({
        used,
        quota,
        geocaches: geocaches.length,
        profiles: 0, // TODO: Implement profile counting
        events: 0, // TODO: Implement event counting
        mapTiles,
      });
    } catch (error) {
      console.error('Failed to load storage info:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    storageInfo,
    isLoading,
    refreshStorageInfo,
  };
}