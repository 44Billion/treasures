/**
 * Unified Store Provider
 * Provides all stores through React context
 */

import React, { createContext, useContext, useMemo } from 'react';
import type { 
  UnifiedStores, 
  StoreProviderProps, 
  GeocacheStore,
  LogStore,
  AuthorStore,
  OfflineStore,
  StoreConfig 
} from './types';
import { useGeocacheStore } from './useGeocacheStore';
import { useLogStore } from './useLogStore';
import { useAuthorStore } from './useAuthorStore';
import { useOfflineStore } from './useOfflineStore';
import { DEFAULT_STORE_CONFIG } from './baseStore';

// Ensure React is available before creating contexts
if (typeof createContext !== 'function') {
  throw new Error('React is not properly loaded. Please ensure React is available before importing this module.');
}

// Create contexts for each store
const GeocacheStoreContext = createContext<GeocacheStore | null>(null);
const LogStoreContext = createContext<LogStore | null>(null);
const AuthorStoreContext = createContext<AuthorStore | null>(null);
const OfflineStoreContext = createContext<OfflineStore | null>(null);
const UnifiedStoresContext = createContext<UnifiedStores | null>(null);

// Stable empty config object to prevent re-renders
const EMPTY_CONFIG = {};

/**
 * Store Provider Component
 */
export function StoreProvider({ children, config = EMPTY_CONFIG }: StoreProviderProps) {
  const storeConfig: StoreConfig = useMemo(() => ({
    ...DEFAULT_STORE_CONFIG,
    ...config,
  }), [config]);

  // Initialize all stores
  const geocacheStore = useGeocacheStore(storeConfig);
  const logStore = useLogStore(storeConfig);
  const authorStore = useAuthorStore(storeConfig);
  const offlineStore = useOfflineStore(storeConfig);

  // Create unified stores object
  const unifiedStores = useMemo((): UnifiedStores => ({
    geocache: geocacheStore,
    log: logStore,
    author: authorStore,
    offline: offlineStore,
  }), [geocacheStore, logStore, authorStore, offlineStore]);

  return (
    <GeocacheStoreContext.Provider value={geocacheStore}>
      <LogStoreContext.Provider value={logStore}>
        <AuthorStoreContext.Provider value={authorStore}>
          <OfflineStoreContext.Provider value={offlineStore}>
            <UnifiedStoresContext.Provider value={unifiedStores}>
              {children}
            </UnifiedStoresContext.Provider>
          </OfflineStoreContext.Provider>
        </AuthorStoreContext.Provider>
      </LogStoreContext.Provider>
    </GeocacheStoreContext.Provider>
  );
}

/**
 * Hook to access the geocache store
 */
export function useGeocacheStoreContext(): GeocacheStore {
  const store = useContext(GeocacheStoreContext);
  if (!store) {
    throw new Error('useGeocacheStoreContext must be used within a StoreProvider');
  }
  return store;
}

/**
 * Hook to access the log store
 */
export function useLogStoreContext(): LogStore {
  const store = useContext(LogStoreContext);
  if (!store) {
    throw new Error('useLogStoreContext must be used within a StoreProvider');
  }
  return store;
}

/**
 * Hook to access the author store
 */
export function useAuthorStoreContext(): AuthorStore {
  const store = useContext(AuthorStoreContext);
  if (!store) {
    throw new Error('useAuthorStoreContext must be used within a StoreProvider');
  }
  return store;
}

/**
 * Hook to access the offline store
 */
export function useOfflineStoreContext(): OfflineStore {
  const store = useContext(OfflineStoreContext);
  if (!store) {
    throw new Error('useOfflineStoreContext must be used within a StoreProvider');
  }
  return store;
}

/**
 * Hook to access all stores
 */
export function useStores(): UnifiedStores {
  const stores = useContext(UnifiedStoresContext);
  if (!stores) {
    throw new Error('useStores must be used within a StoreProvider');
  }
  return stores;
}

/**
 * Hook to access a specific store by name
 */
export function useStore<T extends keyof UnifiedStores>(storeName: T): UnifiedStores[T] {
  const stores = useStores();
  return stores[storeName];
}

/**
 * Higher-order component to provide stores
 */
export function withStores<P extends object>(
  Component: React.ComponentType<P>,
  config?: Partial<StoreConfig>
) {
  return function WithStoresComponent(props: P) {
    return (
      <StoreProvider config={config}>
        <Component {...props} />
      </StoreProvider>
    );
  };
}

/**
 * Hook for components that need multiple stores
 */
export function useMultipleStores<T extends (keyof UnifiedStores)[]>(
  storeNames: T
): Pick<UnifiedStores, T[number]> {
  const stores = useStores();
  
  return useMemo(() => {
    const selectedStores = {} as Pick<UnifiedStores, T[number]>;
    storeNames.forEach(storeName => {
      selectedStores[storeName] = stores[storeName];
    });
    return selectedStores;
  }, [stores, storeNames]);
}

/**
 * Hook to get store status across all stores
 */
export function useStoreStatus() {
  const stores = useStores();
  
  return useMemo(() => {
    const status = {
      isLoading: false,
      isError: false,
      errorCount: 0,
      syncStatus: {
        isActive: false,
        lastSync: null as Date | null,
        errorCount: 0,
      },
      cacheStats: {
        totalItems: 0,
        hitRate: 0,
        memoryUsage: 0,
        lastCleanup: null as Date | null,
      },
    };

    // Aggregate status from all stores
    Object.values(stores).forEach(store => {
      if (store.isLoading) status.isLoading = true;
      if (store.isError) status.isError = true;
      if (store.error) status.errorCount++;
      
      const storeStats = store.getStats();
      status.cacheStats.totalItems += storeStats.totalItems;
      status.cacheStats.memoryUsage += storeStats.memoryUsage;
      
      if (store.syncStatus.isActive) {
        status.syncStatus.isActive = true;
      }
      
      if (store.syncStatus.lastSync) {
        if (!status.syncStatus.lastSync || store.syncStatus.lastSync > status.syncStatus.lastSync) {
          status.syncStatus.lastSync = store.syncStatus.lastSync;
        }
      }
      
      status.syncStatus.errorCount += store.syncStatus.errorCount;
    });

    // Calculate average hit rate
    const storeCount = Object.keys(stores).length;
    if (storeCount > 0) {
      status.cacheStats.hitRate = Object.values(stores)
        .reduce((sum, store) => sum + store.getStats().hitRate, 0) / storeCount;
    }

    return status;
  }, [stores]);
}

/**
 * Hook to trigger actions across multiple stores
 */
export function useStoreActions() {
  const stores = useStores();
  
  return useMemo(() => ({
    // Refresh all data
    refreshAll: async () => {
      const results = await Promise.allSettled([
        stores.geocache.refreshAll(),
        stores.author.triggerSync(),
        stores.offline.triggerSync(),
      ]);
      
      const errors = results
        .filter(result => result.status === 'rejected')
        .map(result => (result as PromiseRejectedResult).reason);
      
      if (errors.length > 0) {
        throw new Error(`Failed to refresh some stores: ${errors.map(e => e.message).join(', ')}`);
      }
    },
    
    // Clear all caches
    clearAll: async () => {
      await Promise.all([
        stores.geocache.invalidateAll(),
        stores.log.invalidateAll(),
        stores.author.invalidateAll(),
        stores.offline.clearOfflineData(),
      ]);
    },
    
    // Start background sync for all stores
    startBackgroundSync: () => {
      stores.geocache.startBackgroundSync();
      stores.log.startBackgroundSync();
      stores.author.startBackgroundSync();
      stores.offline.startBackgroundSync();
    },
    
    // Stop background sync for all stores
    stopBackgroundSync: () => {
      stores.geocache.stopBackgroundSync();
      stores.log.stopBackgroundSync();
      stores.author.stopBackgroundSync();
      stores.offline.stopBackgroundSync();
    },
    
    // Update configuration for all stores
    updateConfig: (config: Partial<StoreConfig>) => {
      stores.geocache.updateConfig(config);
      stores.log.updateConfig(config);
      stores.author.updateConfig(config);
      stores.offline.updateConfig(config);
    },
  }), [stores]);
}