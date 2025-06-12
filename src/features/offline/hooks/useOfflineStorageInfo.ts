/**
 * Unified hook for offline storage information
 */

import { useState, useCallback } from 'react';
import { offlineStorage } from '@/features/offline/utils/offlineStorage';
import { getCacheEntryCount } from '@/shared/utils/cacheUtils';
import { CACHE_NAMES } from '@/shared/config/cache';
import { getStorageConfig } from '@/shared/config/storage';

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
      // Get configured storage limit
      const config = await getStorageConfig();
      const configuredQuota = config.maxStorageSize;
      
      // Get actual storage usage
      let used = 0;
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        used = estimate.usage || 0;
      }

      // Count cached items in parallel
      const [geocaches, mapTiles] = await Promise.all([
        offlineStorage.getAllGeocaches(),
        getCacheEntryCount(CACHE_NAMES.OSM_TILES),
      ]);

      setStorageInfo({
        used,
        quota: configuredQuota, // Use configured limit instead of browser quota
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