/**
 * Unified Data Stores
 * Export all store-related functionality
 */

// Types
export type {
  BaseStoreState,
  StoreActionResult,
  SyncStatus,
  CacheStats,
  StoreConfig,
  GeocacheStoreState,
  GeocacheStoreActions,
  GeocacheStore,
  LogStoreState,
  LogStoreActions,
  LogStore,
  AuthorStoreState,
  AuthorStoreActions,
  AuthorStore,
  AuthorMetadata,
  OfflineStoreState,
  OfflineStoreActions,
  OfflineStore,
  PendingAction,
  StorageInfo,
  UnifiedStores,
  StoreProviderProps,
} from './types';

// Base store utilities
export {
  useBaseStore,
  createQueryKey,
  isDataStale,
  batchOperations,
  createOptimisticUpdate,
  DEFAULT_STORE_CONFIG,
} from './baseStore';

// Individual store hooks
export { useGeocacheStore } from './useGeocacheStore';
export { useLogStore } from './useLogStore';
export { useAuthorStore } from './useAuthorStore';
export { useOfflineStore } from './useOfflineStore';

// Store provider and context hooks
export {
  StoreProvider,
  useGeocacheStoreContext,
  useLogStoreContext,
  useAuthorStoreContext,
  useOfflineStoreContext,
  useStores,
  useStore,
  useMultipleStores,
  useStoreStatus,
  useStoreActions,
  withStores,
} from './StoreProvider';

// Migration helpers for backward compatibility
export {
  useGeocaches,
  useGeocache,
  useUserGeocaches,
  useGeocacheLogs,
  useCreateLog,
  useAuthor,
  useCurrentUser,
  useGeocachePrefetch,
  useDataManager,
} from './migrationHelpers';

// Convenience re-exports for common patterns
export {
  // Direct store access (for components that don't need context)
  useGeocacheStore as useDirectGeocacheStore,
  useLogStore as useDirectLogStore,
  useAuthorStore as useDirectAuthorStore,
  useOfflineStore as useDirectOfflineStore,
};