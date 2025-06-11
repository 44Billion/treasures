/**
 * Migration helpers for transitioning from old hooks
 * These provide backward compatibility while components migrate to new stores
 */

import React from 'react';
import {
  useGeocacheStoreContext,
  useLogStoreContext,
  useAuthorStoreContext,
  useStores,
  useStoreStatus,
  useStoreActions,
} from './StoreProvider';

// Geocache migration helpers
export function useGeocaches() {
  const store = useGeocacheStoreContext();
  return {
    data: store.geocaches,
    isLoading: store.isLoading,
    isError: store.isError,
    error: store.error,
    refetch: store.refreshAll,
    dataUpdatedAt: store.lastUpdate?.getTime(),
    isSuccess: !store.isLoading && !store.isError,
  };
}

export function useGeocache(id: string) {
  const store = useGeocacheStoreContext();
  const geocache = store.geocaches.find(g => g.id === id) || store.selectedGeocache;
  
  return {
    data: geocache,
    isLoading: store.isLoading,
    isError: store.isError,
    error: store.error,
    refetch: () => store.refreshGeocache(id),
  };
}

export function useUserGeocaches(pubkey?: string) {
  const store = useGeocacheStoreContext();
  
  return {
    data: pubkey ? store.geocaches.filter(g => g.pubkey === pubkey) : store.userGeocaches,
    isLoading: store.isLoading,
    isError: store.isError,
    error: store.error,
    refetch: pubkey ? () => store.fetchUserGeocaches(pubkey) : store.refreshAll,
  };
}

// Log migration helpers
export function useGeocacheLogs(geocacheId: string, dTag?: string, pubkey?: string, relays?: string[], verificationPubkey?: string) {
  const store = useLogStoreContext();
  const logs = store.logsByGeocache[geocacheId] || [];
  
  return {
    data: logs,
    isLoading: store.isLoading,
    isError: store.isError,
    error: store.error,
    refetch: () => store.refreshLogs(geocacheId),
  };
}

export function useCreateLog() {
  const store = useLogStoreContext();
  
  return {
    mutate: store.createLog,
    mutateAsync: store.createLog,
    isLoading: store.isLoading,
    isError: store.isError,
    error: store.error,
  };
}

// Author migration helpers
export function useAuthor(pubkey: string) {
  const store = useAuthorStoreContext();
  const author = store.authors[pubkey];
  
  return {
    data: author,
    isLoading: store.isLoading,
    isError: store.isError,
    error: store.error,
    refetch: () => store.refreshAuthor(pubkey),
  };
}

export function useCurrentUser() {
  const store = useAuthorStoreContext();
  
  return {
    user: store.currentUser,
    isLoading: store.isLoading,
    isError: store.isError,
    error: store.error,
  };
}

// Prefetch manager migration helper
export function useGeocachePrefetch() {
  const geocacheStore = useGeocacheStoreContext();
  const logStore = useLogStoreContext();
  
  return {
    prefetchGeocache: async (geocache: any) => {
      if (geocache.id) {
        await geocacheStore.preloadGeocache(geocache.id);
        await logStore.prefetchLogs([geocache.id]);
      }
    },
    prefetchMultiple: async (geocacheIds: string[]) => {
      await Promise.all(geocacheIds.map(id => geocacheStore.preloadGeocache(id)));
      await logStore.prefetchLogs(geocacheIds);
    },
  };
}

// Data manager migration helper
export function useDataManager(options: {
  enablePolling?: boolean;
  enablePrefetching?: boolean;
  priorityGeocaches?: string[];
} = {}) {
  const stores = useStores();
  const actions = useStoreActions();
  const status = useStoreStatus();
  
  return {
    // Data
    geocaches: stores.geocache.geocaches,
    isLoading: status.isLoading,
    isError: status.isError,
    error: stores.geocache.error,
    
    // Actions
    refreshAll: actions.refreshAll,
    refreshGeocache: stores.geocache.refreshGeocache,
    pausePolling: actions.stopBackgroundSync,
    resumePolling: actions.startBackgroundSync,
    
    // Status
    getStatus: () => status,
    
    // Sub-managers (for compatibility)
    prefetchManager: {
      triggerPrefetch: async (geocacheIds?: string[]) => {
        if (geocacheIds) {
          await stores.log.prefetchLogs(geocacheIds);
        }
      },
      getPrefetchStatus: () => ({
        totalGeocaches: stores.geocache.geocaches.length,
        prefetchedLogs: Object.keys(stores.log.logsByGeocache).length,
        prefetchedAuthors: Object.keys(stores.author.authors).length,
        isPolling: status.syncStatus.isActive,
        isPrefetching: true,
      }),
    },
    cacheInvalidation: {
      invalidateGeocache: stores.geocache.invalidateGeocache,
      validateCachedGeocaches: async () => {
        // This would be handled automatically by the stores
      },
      isMonitoring: status.syncStatus.isActive,
    },
    
    // Legacy compatibility
    isActive: status.syncStatus.isActive,
    lastUpdate: stores.geocache.lastUpdate,
    errorCount: status.errorCount,
  };
}