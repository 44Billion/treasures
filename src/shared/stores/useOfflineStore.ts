/**
 * Unified Offline Store
 * Consolidates all offline data and sync operations
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import { 
  useBaseStore, 
  batchOperations 
} from './baseStore';
import type { 
  OfflineStore, 
  OfflineStoreState, 
  PendingAction,
  StorageInfo,
  StoreConfig, 
  StoreActionResult,
  OfflineBookmark
} from './types';
import type { Geocache } from '@/types/geocache';
import type { GeocacheLog } from '@/types/geocache';
import { useConnectivity } from '@/features/offline/hooks/useConnectivity';
import { useOfflineStorage } from '@/features/offline/hooks/useOfflineStorage';
import { STORAGE_CONFIG } from '@/shared/config/storage';
import { NIP_GC_KINDS } from '@/features/geocache/utils/nip-gc';

/**
 * Unified offline store hook
 */
export function useOfflineStore(config: Partial<StoreConfig> = {}): OfflineStore {
  const baseStore = useBaseStore('offline', config);
  const { isOnline, isConnected, forceCheck } = useConnectivity();
  const checkConnectivity = forceCheck;
  const { 
    saveGeocache, 
    saveLog, 
    removeGeocache, 
    removeLog,
    getAllGeocaches,
    getAllLogs,
    getStorageStats,
    clearAll,
    saveBookmark,
    removeBookmark,
    getAllBookmarks
  } = useOfflineStorage();
  
  // Type guard to ensure we have proper Geocache objects
  const isValidGeocache = useCallback((obj: any): obj is Geocache => {
    return obj && typeof obj === 'object' && 'id' in obj && 'dTag' in obj && 'name' in obj;
  }, []);
  
  // Type guard to ensure we have proper GeocacheLog objects
  const isValidLog = useCallback((obj: any): obj is GeocacheLog => {
    return obj && typeof obj === 'object' && 'id' in obj && 'geocacheId' in obj && 'type' in obj;
  }, []);
  
  // Helper to convert NostrEvent to Geocache
  const convertNostrEventToGeocache = useCallback((event: any): Geocache | null => {
    if (isValidGeocache(event)) {
      return event as Geocache;
    }
    return null;
  }, [isValidGeocache]);
  
  // Helper to convert NostrEvent to GeocacheLog
  const convertNostrEventToLog = useCallback((event: any): GeocacheLog | null => {
    if (isValidLog(event)) {
      return event as GeocacheLog;
    }
    return null;
  }, [isValidLog]);


  
  const [state, setState] = useState<OfflineStoreState>(() => ({
    ...baseStore.createBaseState(),
    isOnline: false,
    isConnected: false,
    autoCacheMapAreas: false,
    offlineGeocaches: [],
    offlineLogs: {},
    offlineBookmarks: [],
    pendingActions: [],
    storageInfo: {
      totalSize: 0,
      availableSpace: 0,
      geocacheCount: 0,
      logCount: 0,
      lastCleanup: null,
    },
    syncStatus: baseStore.getSyncStatus(),
  }));

  useEffect(() => {
    setState(prev => ({ 
      ...prev, 
      isOnline: isOnline, 
      isConnected: isConnected 
    }));
  }, [isOnline, isConnected]);

  useEffect(() => {
    const loadOfflineData = async () => {
      try {
        const [geocaches, logs, storageStats, bookmarks] = await Promise.all([
          getAllGeocaches(),
          getAllLogs(),
          getStorageStats(),
          getAllBookmarks()
        ]);

        const logsByGeocache: Record<string, GeocacheLog[]> = {};
        logs.forEach(log => {
          if (isValidLog(log) && log.geocacheId) {
            if (!logsByGeocache[log.geocacheId]) {
              logsByGeocache[log.geocacheId] = [];
            }
            logsByGeocache[log.geocacheId]!.push(log);
          }
        });

        const validGeocaches = geocaches
          .map(convertNostrEventToGeocache)
          .filter((g): g is Geocache => g !== null);
        const validLogs = logs
          .map(convertNostrEventToLog)
          .filter((l): l is GeocacheLog => l !== null);

        setState(prev => ({
          ...prev,
          offlineGeocaches: validGeocaches,
          offlineLogs: logsByGeocache,
          offlineBookmarks: bookmarks,
          storageInfo: {
            ...prev.storageInfo,
            totalSize: storageStats.totalSize,
            availableSpace: storageStats.availableSpace,
            geocacheCount: validGeocaches.length,
            logCount: validLogs.length,
            lastCleanup: storageStats.lastCleanup,
          },
        }));
      } catch (error) {
        baseStore.handleError(error, 'loadOfflineData');
      }
    };

    loadOfflineData();
  }, [getAllGeocaches, getAllLogs, getStorageStats, getAllBookmarks, baseStore, convertNostrEventToGeocache, convertNostrEventToLog, isValidLog]);

  const setAutoCacheMapAreas = useCallback((autoCache: boolean) => {
    setState(prev => ({ ...prev, autoCacheMapAreas: autoCache }));
  }, []);

  const setOnlineStatus = useCallback((online: boolean) => {
    setState(prev => ({ ...prev, isOnline: online }));
  }, []);

  const setConnectedStatus = useCallback((connected: boolean) => {
    setState(prev => ({ ...prev, isConnected: connected, isOnline: connected }));
  }, []);

  const checkConnectivityAction = useCallback(async (): Promise<boolean> => {
    const status = await checkConnectivity();
    const connected = status.isConnected;
    setState(prev => ({ ...prev, isConnected: connected }));
    return connected;
  }, [checkConnectivity]);

  const saveGeocacheOffline = useCallback(async (geocache: Geocache): Promise<StoreActionResult<void>> => {
    return baseStore.safeAsyncOperation(async () => {
      await saveGeocache(geocache);
      setState(prev => ({
        ...prev,
        offlineGeocaches: [...prev.offlineGeocaches.filter(g => g.id !== geocache.id), geocache],
        storageInfo: {
          ...prev.storageInfo,
          geocacheCount: prev.storageInfo.geocacheCount + 1,
        },
      }));
    }, 'saveGeocacheOffline');
  }, [baseStore, saveGeocache]);

  const saveLogOffline = useCallback(async (log: GeocacheLog): Promise<StoreActionResult<void>> => {
    return baseStore.safeAsyncOperation(async () => {
      await saveLog(log);
      setState(prev => {
        const geocacheId = log.geocacheId;
        if (!geocacheId) return prev;
        const existingLogs = prev.offlineLogs[geocacheId] || [];
        return {
          ...prev,
          offlineLogs: {
            ...prev.offlineLogs,
            [geocacheId]: [...existingLogs.filter(l => l.id !== log.id), log],
          },
          storageInfo: {
            ...prev.storageInfo,
            logCount: prev.storageInfo.logCount + 1,
          },
        };
      });
    }, 'saveLogOffline');
  }, [baseStore, saveLog]);

  const saveBookmarkOffline = useCallback(async (geocache: Geocache): Promise<StoreActionResult<void>> => {
    return baseStore.safeAsyncOperation(async () => {
      const naddr = `${geocache.kind || NIP_GC_KINDS.GEOCACHE}:${geocache.pubkey}:${geocache.dTag}`;
      const bookmark: OfflineBookmark = { naddr, geocache, source: 'manual' };
      await saveBookmark(bookmark);
      setState(prev => ({
        ...prev,
        offlineBookmarks: [...prev.offlineBookmarks.filter(b => b.naddr !== naddr), bookmark],
      }));
    }, 'saveBookmarkOffline');
  }, [baseStore, saveBookmark]);

  const removeOfflineGeocache = useCallback(async (id: string): Promise<StoreActionResult<void>> => {
    return baseStore.safeAsyncOperation(async () => {
      await removeGeocache(id);
      setState(prev => ({
        ...prev,
        offlineGeocaches: prev.offlineGeocaches.filter(g => g.id !== id),
        storageInfo: {
          ...prev.storageInfo,
          geocacheCount: Math.max(0, prev.storageInfo.geocacheCount - 1),
        },
      }));
    }, 'removeOfflineGeocache');
  }, [baseStore, removeGeocache]);

  const removeOfflineLog = useCallback(async (id: string): Promise<StoreActionResult<void>> => {
    return baseStore.safeAsyncOperation(async () => {
      await removeLog(id);
      setState(prev => {
        const newOfflineLogs = { ...prev.offlineLogs };
        let logRemoved = false;
        Object.keys(newOfflineLogs).forEach(geocacheId => {
          const originalLength = newOfflineLogs[geocacheId]?.length || 0;
          newOfflineLogs[geocacheId] = (newOfflineLogs[geocacheId] || []).filter(l => l.id !== id);
          if (newOfflineLogs[geocacheId].length < originalLength) {
            logRemoved = true;
          }
        });
        if (logRemoved) {
          return {
            ...prev,
            offlineLogs: newOfflineLogs,
            storageInfo: {
              ...prev.storageInfo,
              logCount: Math.max(0, prev.storageInfo.logCount - 1),
            },
          };
        }
        return prev;
      });
    }, 'removeOfflineLog');
  }, [baseStore, removeLog]);

  const removeOfflineBookmark = useCallback(async (naddr: string): Promise<StoreActionResult<void>> => {
    return baseStore.safeAsyncOperation(async () => {
      await removeBookmark(naddr);
      setState(prev => ({
        ...prev,
        offlineBookmarks: prev.offlineBookmarks.filter(b => b.naddr !== naddr),
      }));
    }, 'removeOfflineBookmark');
  }, [baseStore, removeBookmark]);

  const addPendingAction = useCallback((action: Omit<PendingAction, 'id' | 'timestamp' | 'retryCount'>) => {
    const pendingAction: PendingAction = {
      ...action,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      retryCount: 0,
    };
    setState(prev => ({
      ...prev,
      pendingActions: [...prev.pendingActions, pendingAction],
    }));
  }, []);

  const removePendingAction = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      pendingActions: prev.pendingActions.filter(action => action.id !== id),
    }));
  }, []);

  const syncPendingActions = useCallback(async (): Promise<StoreActionResult<void>> => {
    if (!isOnline || !isConnected) {
      return baseStore.createSuccessResult(undefined);
    }

    return baseStore.safeAsyncOperation(async () => {
      let pendingActions: PendingAction[] = [];
      setState(prev => {
        pendingActions = prev.pendingActions;
        return prev;
      });

      if (pendingActions.length === 0) return;

      const maxRetries = 3;
      const actionsToRetry: PendingAction[] = [];
      const completedActions: string[] = [];

      await batchOperations(
        pendingActions,
        async (action) => {
          try {
            console.log(`Syncing pending action: ${action.type} ${action.entity}`, action.data);
            completedActions.push(action.id);
          } catch (error) {
            console.warn(`Failed to sync action ${action.id}:`, error);
            if (action.retryCount < maxRetries) {
              actionsToRetry.push({ ...action, retryCount: action.retryCount + 1 });
            } else {
              console.error(`Giving up on action ${action.id} after ${maxRetries} retries`);
              completedActions.push(action.id);
            }
          }
        },
        2
      );

      setState(prev => ({
        ...prev,
        pendingActions: prev.pendingActions
          .filter(action => !completedActions.includes(action.id))
          .map(action => actionsToRetry.find(a => a.id === action.id) || action),
      }));
    }, 'syncPendingActions');
  }, [isOnline, isConnected, baseStore]);

  const getStorageInfoAction = useCallback(async (): Promise<StorageInfo> => {
    try {
      const stats = await getStorageStats();
      let storageInfo: StorageInfo;
      setState(prev => {
        storageInfo = {
          totalSize: stats.totalSize,
          availableSpace: stats.availableSpace,
          geocacheCount: prev.offlineGeocaches.length,
          logCount: Object.values(prev.offlineLogs).reduce((sum, logs) => sum + logs.length, 0),
          lastCleanup: stats.lastCleanup,
        };
        return { ...prev, storageInfo };
      });
      return storageInfo!;
    } catch (error) {
      baseStore.handleError(error, 'getStorageInfo');
      return state.storageInfo;
    }
  }, [getStorageStats, baseStore, state.storageInfo]);

  const cleanupStorage = useCallback(async (): Promise<StoreActionResult<void>> => {
    return baseStore.safeAsyncOperation(async () => {
      const cutoffDate = new Date(Date.now() - STORAGE_CONFIG.MAX_AGE_DAYS * 24 * 60 * 60 * 1000);
      setState(prev => {
        const freshGeocaches = prev.offlineGeocaches.filter(geocache => new Date(geocache.created_at * 1000) > cutoffDate);
        const freshLogs: Record<string, GeocacheLog[]> = {};
        Object.entries(prev.offlineLogs).forEach(([geocacheId, logs]) => {
          const freshLogsForGeocache = logs.filter(log => new Date(log.created_at * 1000) > cutoffDate);
          if (freshLogsForGeocache.length > 0) {
            freshLogs[geocacheId] = freshLogsForGeocache;
          }
        });
        return {
          ...prev,
          offlineGeocaches: freshGeocaches,
          offlineLogs: freshLogs,
          storageInfo: {
            ...prev.storageInfo,
            geocacheCount: freshGeocaches.length,
            logCount: Object.values(freshLogs).reduce((sum, logs) => sum + logs.length, 0),
            lastCleanup: new Date(),
          },
        };
      });
    }, 'cleanupStorage');
  }, [baseStore]);

  const clearOfflineData = useCallback(async (): Promise<StoreActionResult<void>> => {
    return baseStore.safeAsyncOperation(async () => {
      await clearAll();
      setState(prev => ({
        ...prev,
        offlineGeocaches: [],
        offlineLogs: {},
        offlineBookmarks: [],
        pendingActions: [],
        storageInfo: {
          totalSize: 0,
          availableSpace: 0,
          geocacheCount: 0,
          logCount: 0,
          lastCleanup: new Date(),
        },
      }));
    }, 'clearOfflineData');
  }, [baseStore, clearAll]);

  const clearOfflineBookmarks = useCallback(async (): Promise<StoreActionResult<void>> => {
    return baseStore.safeAsyncOperation(async () => {
      // In the future, we might want to clear the bookmarks from storage here
      // For now, we just clear them from the state
      setState(prev => ({
        ...prev,
        offlineBookmarks: [],
      }));
    }, 'clearOfflineBookmarks');
  }, [baseStore]);

  const backgroundSyncFn = useCallback(async () => {
    if (isOnline && isConnected) {
      await syncPendingActions();
      await getStorageInfoAction();
    }
  }, [isOnline, isConnected, syncPendingActions, getStorageInfoAction]);

  const startBackgroundSync = useCallback(() => {
    baseStore.startBackgroundSync(backgroundSyncFn);
    setState(prev => ({ ...prev, syncStatus: baseStore.getSyncStatus() }));
  }, [baseStore, backgroundSyncFn]);

  const stopBackgroundSync = useCallback(() => {
    baseStore.stopBackgroundSync();
    setState(prev => ({ ...prev, syncStatus: baseStore.getSyncStatus() }));
  }, [baseStore]);

  const triggerSync = useCallback(async (): Promise<StoreActionResult<void>> => {
    try {
      await backgroundSyncFn();
      return baseStore.createSuccessResult(undefined);
    } catch (error) {
      return baseStore.createErrorResult(baseStore.handleError(error, 'triggerSync')) as StoreActionResult<void>;
    }
  }, [backgroundSyncFn, baseStore]);

  const updateConfig = useCallback((newConfig: Partial<StoreConfig>) => {
    baseStore.updateConfig(newConfig);
  }, [baseStore]);

  const getStats = useCallback(() => {
    return {
      ...baseStore.getCacheStats(),
      totalItems: state.offlineGeocaches.length + Object.values(state.offlineLogs).reduce((sum, logs) => sum + logs.length, 0),
    };
  }, [baseStore, state.offlineGeocaches, state.offlineLogs]);

  // Background sync removed - no auto-start

  useEffect(() => {
    if (isOnline && isConnected && state.pendingActions.length > 0) {
      const timer = setTimeout(() => {
        syncPendingActions();
      }, 2000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [isOnline, isConnected, state.pendingActions.length, syncPendingActions]);

  const store = useMemo((): OfflineStore => ({
    ...state,
    setAutoCacheMapAreas,
    setOnlineStatus,
    setConnectedStatus,
    checkConnectivity: checkConnectivityAction,
    saveGeocacheOffline,
    saveLogOffline,
    saveBookmarkOffline,
    removeOfflineGeocache,
    removeOfflineLog,
    removeOfflineBookmark,
    syncPendingActions,
    addPendingAction,
    removePendingAction,
    getStorageInfo: getStorageInfoAction,
    cleanupStorage,
    clearOfflineData,
    clearOfflineBookmarks,
    startBackgroundSync,
    stopBackgroundSync,
    triggerSync,
    updateConfig,
    getStats,
  }), [
    state,
    setAutoCacheMapAreas,
    setOnlineStatus,
    setConnectedStatus,
    checkConnectivityAction,
    saveGeocacheOffline,
    saveLogOffline,
    saveBookmarkOffline,
    removeOfflineGeocache,
    removeOfflineLog,
    removeOfflineBookmark,
    syncPendingActions,
    addPendingAction,
    removePendingAction,
    getStorageInfoAction,
    cleanupStorage,
    clearOfflineData,
    clearOfflineBookmarks,
    startBackgroundSync,
    stopBackgroundSync,
    triggerSync,
    updateConfig,
    getStats,
  ]);

  return store;
}
