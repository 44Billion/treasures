/**
 * React hooks for offline storage functionality
 */

import { useEffect, useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { NostrEvent } from '@nostrify/nostrify';
import { offlineStorage, CachedGeocache, CachedProfile } from '@/lib/offlineStorage';
import { offlineSync, SyncStatus } from '@/lib/offlineSync';

// Hook for offline sync status
export function useOfflineSync() {
  const [status, setStatus] = useState<SyncStatus>({
    isOnline: navigator.onLine,
    isSyncing: false,
    lastSyncTime: null,
    pendingActions: 0,
    syncErrors: [],
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
          'autoSync',
        ];

        const settingsData: Record<string, unknown> = {};
        for (const key of commonSettings) {
          const value = await getSetting(key);
          if (value !== undefined) {
            settingsData[key] = value;
          }
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
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const { status } = useOfflineSync();

  useEffect(() => {
    // Consider app offline if not connected or connection quality is offline
    setIsOfflineMode(!status.isConnected || status.connectionQuality === 'offline');
  }, [status.isConnected, status.connectionQuality]);

  return {
    isOfflineMode,
    isOnline: status.isOnline,
    isConnected: status.isConnected,
    connectionQuality: status.connectionQuality,
    isSyncing: status.isSyncing,
    pendingActions: status.pendingActions,
    lastSyncTime: status.lastSyncTime,
    syncErrors: status.syncErrors,
    latency: status.latency,
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