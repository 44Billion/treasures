/**
 * Unified Offline Store
 * Consolidates all offline data and sync operations
 */

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
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
  StoreActionResult 
} from './types';
import type { Geocache } from '@/types/geocache';
import type { GeocacheLog } from '@/types/geocache';
import { useConnectivity } from '@/features/offline/hooks/useConnectivity';
import { useOfflineStorage } from '@/features/offline/hooks/useOfflineStorage';
import { STORAGE_CONFIG } from '@/shared/config/storage';

/**
 * Unified offline store hook
 */
export function useOfflineStore(config: Partial<StoreConfig> = {}): OfflineStore {
  const baseStore = useBaseStore('offline', config);
  const { isOnline, isConnected, checkConnectivity } = useConnectivity();
  const { 
    saveGeocache, 
    saveLog, 
    removeGeocache, 
    removeLog,
    getAllGeocaches,
    getAllLogs,
    getStorageStats,
    clearAll
  } = useOfflineStorage();
  
  // Store state
  const [state, setState] = useState<OfflineStoreState>(() => ({
    ...baseStore.createBaseState(),
    isOnline: false,
    isConnected: false,
    offlineGeocaches: [],
    offlineLogs: {},
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

  // Update state helper - use useRef to make it stable
  const updateStateRef = useRef((updates: Partial<OfflineStoreState>) => {
    setState(prev => ({ ...prev, ...updates }));
  });
  const updateState = updateStateRef.current;

  // Update connectivity status
  useEffect(() => {
    updateState({ isOnline, isConnected });
  }, [isOnline, isConnected]); // Remove updateState dependency

  // Load offline data on mount
  useEffect(() => {
    const loadOfflineData = async () => {
      try {
        const [geocaches, logs, storageStats] = await Promise.all([
          getAllGeocaches(),
          getAllLogs(),
          getStorageStats(),
        ]);

        // Group logs by geocache ID
        const logsByGeocache: Record<string, GeocacheLog[]> = {};
        logs.forEach(log => {
          if (log.geocacheId) {
            if (!logsByGeocache[log.geocacheId]) {
              logsByGeocache[log.geocacheId] = [];
            }
            logsByGeocache[log.geocacheId].push(log);
          }
        });

        updateState({
          offlineGeocaches: geocaches,
          offlineLogs: logsByGeocache,
          storageInfo: {
            totalSize: storageStats.totalSize,
            availableSpace: storageStats.availableSpace,
            geocacheCount: geocaches.length,
            logCount: logs.length,
            lastCleanup: storageStats.lastCleanup,
          },
        });
      } catch (error) {
        baseStore.handleError(error, 'loadOfflineData');
      }
    };

    loadOfflineData();
  }, [getAllGeocaches, getAllLogs, getStorageStats, baseStore]); // Remove updateState dependency

  // Connectivity actions
  const setOnlineStatus = useCallback((online: boolean) => {
    updateState({ isOnline: online });
  }, []);

  const setConnectedStatus = useCallback((connected: boolean) => {
    updateState({ isConnected: connected });
  }, []);

  const checkConnectivityAction = useCallback(async (): Promise<boolean> => {
    const connected = await checkConnectivity();
    updateState({ isConnected: connected });
    return connected;
  }, [checkConnectivity]);

  // Offline data management
  const saveGeocacheOffline = useCallback(async (geocache: Geocache): Promise<StoreActionResult<void>> => {
    return baseStore.safeAsyncOperation(async () => {
      await saveGeocache(geocache);
      
      // Update local state
      updateState({
        offlineGeocaches: [...state.offlineGeocaches.filter(g => g.id !== geocache.id), geocache],
        storageInfo: {
          ...state.storageInfo,
          geocacheCount: state.storageInfo.geocacheCount + 1,
        },
      });
    }, 'saveGeocacheOffline');
  }, [baseStore, saveGeocache, state.offlineGeocaches, state.storageInfo]);

  const saveLogOffline = useCallback(async (log: GeocacheLog): Promise<StoreActionResult<void>> => {
    return baseStore.safeAsyncOperation(async () => {
      await saveLog(log);
      
      // Update local state
      const geocacheId = log.geocacheId;
      if (geocacheId) {
        const existingLogs = state.offlineLogs[geocacheId] || [];
        updateState({
          offlineLogs: {
            ...state.offlineLogs,
            [geocacheId]: [...existingLogs.filter(l => l.id !== log.id), log],
          },
          storageInfo: {
            ...state.storageInfo,
            logCount: state.storageInfo.logCount + 1,
          },
        });
      }
    }, 'saveLogOffline');
  }, [baseStore, saveLog, state.offlineLogs, state.storageInfo]);

  const removeOfflineGeocache = useCallback(async (id: string): Promise<StoreActionResult<void>> => {
    return baseStore.safeAsyncOperation(async () => {
      await removeGeocache(id);
      
      // Update local state
      updateState({
        offlineGeocaches: state.offlineGeocaches.filter(g => g.id !== id),
        storageInfo: {
          ...state.storageInfo,
          geocacheCount: Math.max(0, state.storageInfo.geocacheCount - 1),
        },
      });
    }, 'removeOfflineGeocache');
  }, [baseStore, removeGeocache, state.offlineGeocaches, state.storageInfo]);

  const removeOfflineLog = useCallback(async (id: string): Promise<StoreActionResult<void>> => {
    return baseStore.safeAsyncOperation(async () => {
      await removeLog(id);
      
      // Update local state - find and remove log from appropriate geocache
      const newOfflineLogs = { ...state.offlineLogs };
      let logRemoved = false;
      
      Object.keys(newOfflineLogs).forEach(geocacheId => {
        const originalLength = newOfflineLogs[geocacheId].length;
        newOfflineLogs[geocacheId] = newOfflineLogs[geocacheId].filter(l => l.id !== id);
        if (newOfflineLogs[geocacheId].length < originalLength) {
          logRemoved = true;
        }
      });
      
      if (logRemoved) {
        updateState({
          offlineLogs: newOfflineLogs,
          storageInfo: {
            ...state.storageInfo,
            logCount: Math.max(0, state.storageInfo.logCount - 1),
          },
        });
      }
    }, 'removeOfflineLog');
  }, [baseStore, removeLog, state.offlineLogs, state.storageInfo]);

  // Pending actions management
  const addPendingAction = useCallback((action: Omit<PendingAction, 'id' | 'timestamp' | 'retryCount'>) => {
    const pendingAction: PendingAction = {
      ...action,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      retryCount: 0,
    };
    
    updateState({
      pendingActions: [...state.pendingActions, pendingAction],
    });
  }, [state.pendingActions]);

  const removePendingAction = useCallback((id: string) => {
    updateState({
      pendingActions: state.pendingActions.filter(action => action.id !== id),
    });
  }, [state.pendingActions]);

  const syncPendingActions = useCallback(async (): Promise<StoreActionResult<void>> => {
    if (!isOnline || !isConnected || state.pendingActions.length === 0) {
      return baseStore.createSuccessResult(undefined);
    }

    return baseStore.safeAsyncOperation(async () => {
      const maxRetries = 3;
      const actionsToRetry: PendingAction[] = [];
      const completedActions: string[] = [];

      await batchOperations(
        state.pendingActions,
        async (action) => {
          try {
            // Simulate sync operation
            console.log(`Syncing pending action: ${action.type} ${action.entity}`, action.data);
            
            // Mark as completed
            completedActions.push(action.id);
          } catch (error) {
            console.warn(`Failed to sync action ${action.id}:`, error);
            
            if (action.retryCount < maxRetries) {
              actionsToRetry.push({
                ...action,
                retryCount: action.retryCount + 1,
              });
            } else {
              console.error(`Giving up on action ${action.id} after ${maxRetries} retries`);
              completedActions.push(action.id); // Remove failed actions too
            }
          }
        },
        2 // Batch size for sync operations
      );

      // Update pending actions
      const remainingActions = state.pendingActions
        .filter(action => !completedActions.includes(action.id))
        .map(action => {
          const retryAction = actionsToRetry.find(a => a.id === action.id);
          return retryAction || action;
        });

      updateState({ pendingActions: remainingActions });
    }, 'syncPendingActions');
  }, [isOnline, isConnected, state.pendingActions, baseStore]);

  // Storage management
  const getStorageInfoAction = useCallback(async (): Promise<StorageInfo> => {
    try {
      const stats = await getStorageStats();
      const storageInfo: StorageInfo = {
        totalSize: stats.totalSize,
        availableSpace: stats.availableSpace,
        geocacheCount: state.offlineGeocaches.length,
        logCount: Object.values(state.offlineLogs).reduce((sum, logs) => sum + logs.length, 0),
        lastCleanup: stats.lastCleanup,
      };
      
      updateState({ storageInfo });
      return storageInfo;
    } catch (error) {
      baseStore.handleError(error, 'getStorageInfo');
      return state.storageInfo;
    }
  }, [getStorageStats, state.offlineGeocaches, state.offlineLogs, state.storageInfo, baseStore]);

  const cleanupStorage = useCallback(async (): Promise<StoreActionResult<void>> => {
    return baseStore.safeAsyncOperation(async () => {
      // Remove old offline data based on storage config
      const cutoffDate = new Date(Date.now() - STORAGE_CONFIG.MAX_AGE_DAYS * 24 * 60 * 60 * 1000);
      
      // Filter out old geocaches
      const freshGeocaches = state.offlineGeocaches.filter(geocache => 
        new Date(geocache.createdAt) > cutoffDate
      );
      
      // Filter out old logs
      const freshLogs: Record<string, GeocacheLog[]> = {};
      Object.entries(state.offlineLogs).forEach(([geocacheId, logs]) => {
        const freshLogsForGeocache = logs.filter(log => 
          new Date(log.createdAt) > cutoffDate
        );
        if (freshLogsForGeocache.length > 0) {
          freshLogs[geocacheId] = freshLogsForGeocache;
        }
      });
      
      updateState({
        offlineGeocaches: freshGeocaches,
        offlineLogs: freshLogs,
        storageInfo: {
          ...state.storageInfo,
          geocacheCount: freshGeocaches.length,
          logCount: Object.values(freshLogs).reduce((sum, logs) => sum + logs.length, 0),
          lastCleanup: new Date(),
        },
      });
    }, 'cleanupStorage');
  }, [baseStore, state.offlineGeocaches, state.offlineLogs, state.storageInfo]);

  const clearOfflineData = useCallback(async (): Promise<StoreActionResult<void>> => {
    return baseStore.safeAsyncOperation(async () => {
      await clearAll();
      
      updateState({
        offlineGeocaches: [],
        offlineLogs: {},
        pendingActions: [],
        storageInfo: {
          totalSize: 0,
          availableSpace: 0,
          geocacheCount: 0,
          logCount: 0,
          lastCleanup: new Date(),
        },
      });
    }, 'clearOfflineData');
  }, [baseStore, clearAll]);

  // Background sync
  const backgroundSyncFn = useCallback(async () => {
    if (isOnline && isConnected) {
      await syncPendingActions();
      await getStorageInfoAction();
    }
  }, [isOnline, isConnected, syncPendingActions, getStorageInfoAction]);

  const startBackgroundSync = useCallback(() => {
    baseStore.startBackgroundSync(backgroundSyncFn);
    updateState({ syncStatus: baseStore.getSyncStatus() });
  }, [baseStore, backgroundSyncFn]);

  const stopBackgroundSync = useCallback(() => {
    baseStore.stopBackgroundSync();
    updateState({ syncStatus: baseStore.getSyncStatus() });
  }, [baseStore, updateState]);

  const triggerSync = useCallback(async (): Promise<StoreActionResult<void | unknown>> => {
    try {
      await backgroundSyncFn();
      return baseStore.createSuccessResult(undefined);
    } catch (error) {
      return baseStore.createErrorResult(baseStore.handleError(error, 'triggerSync'));
    }
  }, [backgroundSyncFn, baseStore]);

  // Configuration
  const updateConfig = useCallback((newConfig: Partial<StoreConfig>) => {
    baseStore.updateConfig(newConfig);
  }, [baseStore]);

  const getStats = useCallback(() => {
    return {
      ...baseStore.getCacheStats(),
      totalItems: state.offlineGeocaches.length + Object.values(state.offlineLogs).reduce((sum, logs) => sum + logs.length, 0),
    };
  }, [baseStore, state.offlineGeocaches, state.offlineLogs]);

  // Auto-start background sync
  useEffect(() => {
    if (baseStore.config.enableBackgroundSync) {
      startBackgroundSync();
    }
    return () => stopBackgroundSync();
  }, [baseStore.config.enableBackgroundSync]);

  // Auto-sync when coming online
  useEffect(() => {
    if (isOnline && isConnected && state.pendingActions.length > 0) {
      // Delay sync to avoid immediate network congestion
      const timer = setTimeout(() => {
        syncPendingActions();
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, [isOnline, isConnected, state.pendingActions.length, syncPendingActions]);

  // Memoized store object
  const store = useMemo((): OfflineStore => ({
    // State
    ...state,
    
    // Connectivity
    setOnlineStatus,
    setConnectedStatus,
    checkConnectivity: checkConnectivityAction,
    
    // Offline data management
    saveGeocacheOffline,
    saveLogOffline,
    removeOfflineGeocache,
    removeOfflineLog,
    
    // Sync operations
    syncPendingActions,
    addPendingAction,
    removePendingAction,
    
    // Storage management
    getStorageInfo: getStorageInfoAction,
    cleanupStorage,
    clearOfflineData,
    
    // Background sync
    startBackgroundSync,
    stopBackgroundSync,
    triggerSync,
    
    // Configuration
    updateConfig,
    getStats,
  }), [
    state,
    setOnlineStatus,
    setConnectedStatus,
    checkConnectivityAction,
    saveGeocacheOffline,
    saveLogOffline,
    removeOfflineGeocache,
    removeOfflineLog,
    syncPendingActions,
    addPendingAction,
    removePendingAction,
    getStorageInfoAction,
    cleanupStorage,
    clearOfflineData,
    startBackgroundSync,
    stopBackgroundSync,
    triggerSync,
    updateConfig,
    getStats,
  ]);

  return store;
}