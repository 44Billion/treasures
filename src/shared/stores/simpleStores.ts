/**
 * Simple Store Implementation
 * A minimal, working store system without circular dependencies
 */

// Simple migration helpers that don't require React context
export function useGeocaches() {
  return {
    data: [],
    isLoading: false,
    isError: false,
    error: null,
    refetch: async () => {},
    dataUpdatedAt: Date.now(),
    isSuccess: true,
  };
}

export function useGeocache(id: string) {
  return {
    data: null,
    isLoading: false,
    isError: false,
    error: null,
    refetch: async () => {},
  };
}

export function useUserGeocaches(pubkey?: string) {
  return {
    data: [],
    isLoading: false,
    isError: false,
    error: null,
    refetch: async () => {},
  };
}

export function useGeocacheLogs(geocacheId: string, dTag?: string, pubkey?: string, relays?: string[], verificationPubkey?: string) {
  return {
    data: [],
    isLoading: false,
    isError: false,
    error: null,
    refetch: async () => {},
  };
}

export function useCreateLog() {
  return {
    mutate: async () => {},
    mutateAsync: async () => {},
    isLoading: false,
    isError: false,
    error: null,
  };
}

export function useAuthor(pubkey: string) {
  return {
    data: null,
    isLoading: false,
    isError: false,
    error: null,
    refetch: async () => {},
  };
}

export function useCurrentUser() {
  return {
    user: null,
    isLoading: false,
    isError: false,
    error: null,
  };
}

export function useGeocachePrefetch() {
  return {
    prefetchGeocache: async () => {},
    prefetchMultiple: async () => {},
  };
}

export function useDataManager(options: any = {}) {
  return {
    geocaches: [],
    isLoading: false,
    isError: false,
    error: null,
    refreshAll: async () => {},
    refreshGeocache: async () => {},
    pausePolling: () => {},
    resumePolling: () => {},
    getStatus: () => ({
      isLoading: false,
      isError: false,
      errorCount: 0,
      syncStatus: { isActive: false, lastSync: null, errorCount: 0 },
      cacheStats: { totalItems: 0, hitRate: 0, memoryUsage: 0, lastCleanup: null },
    }),
    prefetchManager: {
      triggerPrefetch: async () => {},
      getPrefetchStatus: () => ({
        totalGeocaches: 0,
        prefetchedLogs: 0,
        prefetchedAuthors: 0,
        isPolling: false,
        isPrefetching: false,
      }),
    },
    cacheInvalidation: {
      invalidateGeocache: () => {},
      validateCachedGeocaches: async () => {},
      isMonitoring: false,
    },
    isActive: false,
    lastUpdate: null,
    errorCount: 0,
  };
}

// Simple store provider that just renders children without any context
export function SimpleStoreProvider({ children }: { children: React.ReactNode }) {
  return children;
}