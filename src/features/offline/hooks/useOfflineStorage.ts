/**
 * React hooks for offline storage functionality
 */

import { useEffect, useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { NostrEvent } from '@nostrify/nostrify';
import { offlineStorage, CachedGeocache, CachedProfile } from '@/features/offline/utils/offlineStorage';
import { offlineSync, SyncStatus } from '@/features/offline/utils/offlineSync';

// Hook for offline sync status
export function useOfflineSync() {
  const [status, setStatus] = useState<SyncStatus>({
    isOnline: navigator.onLine,
    isConnected: false,
    connectionQuality: 'offline',
    isSyncing: false,
    lastSyncTime: null,
    pendingActions: 0,
    syncErrors: [],
    isInitialCheck: true,
  });

  useEffect(() => {
    // Get initial status
    offlineSync.getStatus().then(setStatus);

    // Subscribe to status changes
    const unsubscribe = offlineSync.addSyncListener(setStatus);

    return unsubscribe;
  }, []);

  const forceSync = useCallback(async () => {
    try {
      await offlineSync.forcSync();
    } catch (error) {
      console.error('Force sync failed:', error);
      throw error;
    }
  }, []);

  const queueAction = useCallback(async (
    type: Parameters<typeof offlineSync.queueAction>[0],
    data: Parameters<typeof offlineSync.queueAction>[1],
    maxRetries?: number
  ) => {
    return await offlineSync.queueAction(type, data, maxRetries);
  }, []);

  return {
    status,
    forceSync,
    queueAction,
  };
}

// Hook for offline geocache storage
export function useOfflineGeocaches() {
  const queryClient = useQueryClient();

  const { data: geocaches = [], isLoading } = useQuery({
    queryKey: ['offline-geocaches'],
    queryFn: () => offlineStorage.getAllGeocaches(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const storeGeocache = useMutation({
    mutationFn: async (geocache: CachedGeocache) => {
      await offlineStorage.storeGeocache(geocache);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['offline-geocaches'] });
    },
  });

  const getGeocache = useCallback(async (id: string) => {
    return await offlineStorage.getGeocache(id);
  }, []);

  const getGeocachesInBounds = useCallback(async (
    minLat: number,
    maxLat: number,
    minLng: number,
    maxLng: number
  ) => {
    return await offlineStorage.getGeocachesInBounds(minLat, maxLat, minLng, maxLng);
  }, []);

  return {
    geocaches,
    isLoading,
    storeGeocache: storeGeocache.mutate,
    getGeocache,
    getGeocachesInBounds,
    isStoring: storeGeocache.isPending,
  };
}

// Hook for offline profile storage
export function useOfflineProfiles() {
  const queryClient = useQueryClient();

  const storeProfile = useMutation({
    mutationFn: async (profile: CachedProfile) => {
      await offlineStorage.storeProfile(profile);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['offline-profiles'] });
    },
  });

  const getProfile = useCallback(async (pubkey: string) => {
    return await offlineStorage.getProfile(pubkey);
  }, []);

  return {
    storeProfile: storeProfile.mutate,
    getProfile,
    isStoring: storeProfile.isPending,
  };
}

// Hook for offline event storage
export function useOfflineEvents() {
  const queryClient = useQueryClient();

  const storeEvent = useMutation({
    mutationFn: async (event: NostrEvent) => {
      await offlineStorage.storeEvent(event);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['offline-events'] });
    },
  });

  const getEvent = useCallback(async (id: string) => {
    return await offlineStorage.getEvent(id);
  }, []);

  const getEventsByKind = useCallback(async (kind: number) => {
    return await offlineStorage.getEventsByKind(kind);
  }, []);

  return {
    storeEvent: storeEvent.mutate,
    getEvent,
    getEventsByKind,
    isStoring: storeEvent.isPending,
  };
}

// Hook for offline settings
export function useOfflineSettings() {
  const [settings, setSettings] = useState<Record<string, unknown>>({});

  const getSetting = useCallback(async (key: string) => {
    return await offlineStorage.getSetting(key);
  }, []);

  const setSetting = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: unknown }) => {
      await offlineStorage.setSetting(key, value);
      return { key, value };
    },
    onSuccess: ({ key, value }) => {
      setSettings(prev => ({ ...prev, [key]: value }));
    },
  });

  // Load initial settings
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const commonSettings = [
          'theme',
          'mapStyle',
          'units',
          'notifications',
          'offlineMode',
          'offlineOnly',
          'autoSync',
          'autoCacheMaps', // Add auto cache maps setting
          'storageConfig', // Add storage config
        ];

        const settingsData: Record<string, unknown> = {};
        for (const key of commonSettings) {
          const value = await getSetting(key);
          if (value !== undefined) {
            settingsData[key] = value;
          }
        }
        
        // Set default for autoCacheMaps if not set
        if (settingsData.autoCacheMaps === undefined) {
          settingsData.autoCacheMaps = true;
          setSetting.mutate({ key: 'autoCacheMaps', value: true });
        }
        
        setSettings(settingsData);
      } catch (error) {
        console.error('Failed to load settings:', error);
      }
    };

    loadSettings();
  }, [getSetting]);

  return {
    settings,
    getSetting,
    setSetting: setSetting.mutate,
    isSettingValue: setSetting.isPending,
  };
}

// Hook for checking if app is in offline mode
export function useOfflineMode() {
  const [isOfflineMode, setIsOfflineMode] = useState(!navigator.onLine);
  const { status } = useOfflineSync();
  const { settings } = useOfflineSettings();

  useEffect(() => {
    // Don't update state during initial connectivity check to prevent flickering
    if (status.isInitialCheck) {
      return;
    }

    // Check if user has enabled offline-only mode
    const isOfflineOnly = settings.offlineOnly as boolean ?? false;
    
    // Consider app offline if:
    // 1. User has enabled offline-only mode, OR
    // 2. Not connected or connection quality is offline
    const offline = isOfflineOnly || !status.isConnected || status.connectionQuality === 'offline';
    setIsOfflineMode(offline);
  }, [status.isConnected, status.connectionQuality, status.isInitialCheck, settings.offlineOnly]);

  // Also listen to browser online/offline events for immediate feedback
  useEffect(() => {
    const handleOnline = () => {
      // Don't immediately set to online - let connectivity checker verify
      console.log('Browser reports online, checking actual connectivity...');
    };
    const handleOffline = () => {
      console.log('Browser reports offline');
      setIsOfflineMode(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Check if user has enabled offline-only mode
  const isOfflineOnly = settings.offlineOnly as boolean ?? false;

  return {
    isOfflineMode,
    // When offline-only mode is enabled, always report as offline
    isOnline: isOfflineOnly ? false : (status.isOnline && navigator.onLine),
    isConnected: isOfflineOnly ? false : (status.isConnected && navigator.onLine),
    connectionQuality: isOfflineOnly ? 'offline' : status.connectionQuality,
    isSyncing: status.isSyncing,
    pendingActions: status.pendingActions,
    lastSyncTime: status.lastSyncTime,
    syncErrors: status.syncErrors,
    latency: status.latency,
    isInitialCheck: status.isInitialCheck,
  };
}

// Hook for offline-first data fetching
export function useOfflineFirst<T>(
  queryKey: string[],
  onlineFetcher: () => Promise<T>,
  offlineFetcher: () => Promise<T | null>,
  options: {
    staleTime?: number;
    cacheTime?: number;
    fallbackToOffline?: boolean;
    requireGoodConnection?: boolean;
  } = {}
) {
  const { isConnected, connectionQuality } = useOfflineMode();
  const {
    staleTime = 5 * 60 * 1000, // 5 minutes
    cacheTime = 30 * 60 * 1000, // 30 minutes
    fallbackToOffline = true,
    requireGoodConnection = false,
  } = options;

  const shouldUseOnline = isConnected && 
    (!requireGoodConnection || connectionQuality === 'good');

  return useQuery({
    queryKey: [...queryKey, shouldUseOnline ? 'online' : 'offline', connectionQuality],
    queryFn: async () => {
      if (shouldUseOnline) {
        try {
          return await onlineFetcher();
        } catch (error) {
          if (fallbackToOffline) {
            console.warn('Online fetch failed, falling back to offline data:', error);
            const offlineData = await offlineFetcher();
            if (offlineData !== null) {
              return offlineData;
            }
          }
          throw error;
        }
      } else {
        const offlineData = await offlineFetcher();
        if (offlineData === null) {
          throw new Error('No offline data available');
        }
        return offlineData;
      }
    },
    staleTime,
    gcTime: cacheTime,
    retry: shouldUseOnline ? 3 : 0,
  });
}

// Hook that provides the interface expected by useOfflineStore
export function useOfflineStorage() {
  const saveGeocache = useCallback(async (geocache: any) => {
    const cachedGeocache = {
      id: geocache.id,
      event: geocache,
      lastUpdated: Date.now(),
      coordinates: geocache.coordinates,
      difficulty: geocache.difficulty,
      terrain: geocache.terrain,
      type: geocache.type,
    };
    await offlineStorage.storeGeocache(cachedGeocache);
  }, []);

  const saveLog = useCallback(async (log: any) => {
    // For now, store logs as events since we don't have a specific log storage
    await offlineStorage.storeEvent(log);
  }, []);

  const removeGeocache = useCallback(async (id: string) => {
    await offlineStorage.removeGeocache(id);
  }, []);

  const removeLog = useCallback(async (id: string) => {
    await offlineStorage.removeEvent(id);
  }, []);

  const getAllGeocaches = useCallback(async () => {
    const cached = await offlineStorage.getAllGeocaches();
    return cached.map(c => c.event);
  }, []);

  const getAllLogs = useCallback(async () => {
    // Get all events that are logs (kind 1063 or similar)
    const events = await offlineStorage.getEventsByKind(1063);
    return events;
  }, []);

  const getStorageStats = useCallback(async () => {
    // Basic storage stats
    const geocaches = await offlineStorage.getAllGeocaches();
    const logs = await getAllLogs();
    
    return {
      totalSize: (geocaches.length + logs.length) * 1024, // Rough estimate
      availableSpace: 100 * 1024 * 1024, // 100MB estimate
      lastCleanup: null,
    };
  }, [getAllLogs]);

  const clearAll = useCallback(async () => {
    // Clear all data - this would need to be implemented in offlineStorage
    console.warn('clearAll not fully implemented yet');
  }, []);

  return {
    saveGeocache,
    saveLog,
    removeGeocache,
    removeLog,
    getAllGeocaches,
    getAllLogs,
    getStorageStats,
    clearAll,
  };
}