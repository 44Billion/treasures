/**
 * Shared types for unified data stores
 */

import type { NostrEvent } from '@nostrify/nostrify';
import type { Geocache } from '@/types/geocache';
import type { GeocacheLog } from '@/types/geocache-log';

// Base store state interface
export interface BaseStoreState {
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  lastUpdate: Date | null;
}

// Store action result
export interface StoreActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: Error;
}

// Background sync status
export interface SyncStatus {
  isActive: boolean;
  lastSync: Date | null;
  errorCount: number;
  nextSync?: Date;
}

// Cache statistics
export interface CacheStats {
  totalItems: number;
  hitRate: number;
  memoryUsage: number;
  lastCleanup: Date | null;
  performanceStats?: Record<string, unknown>; // From performance monitor
  syncStatus?: Record<string, unknown>; // From sync scheduler
}

// Store configuration
export interface StoreConfig {
  enableBackgroundSync?: boolean;
  enablePrefetching?: boolean;
  syncInterval?: number;
  cacheTimeout?: number;
  maxCacheSize?: number;
}

// Geocache store specific types
export interface GeocacheStoreState extends BaseStoreState {
  geocaches: Geocache[];
  userGeocaches: Geocache[];
  nearbyGeocaches: Geocache[];
  selectedGeocache: Geocache | null;
  syncStatus: SyncStatus;
  cacheStats: CacheStats;
}

export interface GeocacheStoreActions {
  // Data fetching
  fetchGeocaches: () => Promise<StoreActionResult<Geocache[]>>;
  fetchGeocache: (id: string) => Promise<StoreActionResult<Geocache>>;
  fetchUserGeocaches: (pubkey: string) => Promise<StoreActionResult<Geocache[]>>;
  fetchNearbyGeocaches: (lat: number, lon: number, radius?: number) => Promise<StoreActionResult<Geocache[]>>;
  
  // CRUD operations
  createGeocache: (geocache: Partial<Geocache>) => Promise<StoreActionResult<Geocache>>;
  updateGeocache: (id: string, updates: Partial<Geocache>) => Promise<StoreActionResult<Geocache>>;
  deleteGeocache: (id: string) => Promise<StoreActionResult<void>>;
  batchDeleteGeocaches: (ids: string[]) => Promise<StoreActionResult<void>>;
  
  // Cache management
  invalidateGeocache: (id: string) => void;
  invalidateAll: () => void;
  refreshGeocache: (id: string) => Promise<StoreActionResult<Geocache>>;
  refreshAll: () => Promise<StoreActionResult<Geocache[]>>;
  
  // Selection and navigation
  selectGeocache: (geocache: Geocache | null) => void;
  preloadGeocache: (id: string) => Promise<void>;
  
  // Background sync
  startBackgroundSync: () => void;
  stopBackgroundSync: () => void;
  triggerSync: () => Promise<StoreActionResult<void>>;
  
  // Configuration
  updateConfig: (config: Partial<StoreConfig>) => void;
  getStats: () => CacheStats;
}

// Log store specific types
export interface LogStoreState extends BaseStoreState {
  logsByGeocache: Record<string, GeocacheLog[]>;
  recentLogs: GeocacheLog[];
  userLogs: GeocacheLog[];
  syncStatus: SyncStatus;
  cacheStats: CacheStats;
}

export interface LogStoreActions {
  // Data fetching
  fetchLogs: (geocacheId: string) => Promise<StoreActionResult<GeocacheLog[]>>;
  fetchRecentLogs: (limit?: number) => Promise<StoreActionResult<GeocacheLog[]>>;
  fetchUserLogs: (pubkey: string) => Promise<StoreActionResult<GeocacheLog[]>>;
  
  // CRUD operations
  createLog: (log: Partial<GeocacheLog>) => Promise<StoreActionResult<GeocacheLog>>;
  createVerifiedLog: (log: Partial<GeocacheLog>) => Promise<StoreActionResult<GeocacheLog>>;
  deleteLog: (logId: string) => Promise<StoreActionResult<void>>;
  
  // Cache management
  invalidateLogs: (geocacheId: string) => void;
  invalidateAll: () => void;
  refreshLogs: (geocacheId: string) => Promise<StoreActionResult<GeocacheLog[]>>;
  
  // Prefetching
  prefetchLogs: (geocacheIds: string[]) => Promise<void>;
  
  // Background sync
  startBackgroundSync: () => void;
  stopBackgroundSync: () => void;
  triggerSync: (geocacheIds?: string[]) => Promise<StoreActionResult<void>>;
  
  // Configuration
  updateConfig: (config: Partial<StoreConfig>) => void;
  getStats: () => CacheStats;
}

// Author store specific types
export interface AuthorMetadata {
  pubkey: string;
  metadata: NostrEvent | null;
  nip05Verified: boolean;
  lastUpdate: Date;
}

export interface AuthorStoreState extends BaseStoreState {
  authors: Record<string, AuthorMetadata>;
  currentUser: AuthorMetadata | null;
  syncStatus: SyncStatus;
  cacheStats: CacheStats;
}

export interface AuthorStoreActions {
  // Data fetching
  fetchAuthor: (pubkey: string) => Promise<StoreActionResult<AuthorMetadata>>;
  fetchAuthors: (pubkeys: string[]) => Promise<StoreActionResult<AuthorMetadata[]>>;
  
  // Profile management
  updateProfile: (metadata: Record<string, unknown>) => Promise<StoreActionResult<NostrEvent>>;
  verifyNip05: (pubkey: string) => Promise<StoreActionResult<boolean>>;
  
  // Cache management
  invalidateAuthor: (pubkey: string) => void;
  invalidateAll: () => void;
  refreshAuthor: (pubkey: string) => Promise<StoreActionResult<AuthorMetadata>>;
  
  // Prefetching
  prefetchAuthors: (pubkeys: string[]) => Promise<void>;
  
  // Background sync
  startBackgroundSync: () => void;
  stopBackgroundSync: () => void;
  triggerSync: (pubkeys?: string[]) => Promise<StoreActionResult<void>>;
  
  // User management
  setCurrentUser: (user: AuthorMetadata | null) => void;
  
  // Configuration
  updateConfig: (config: Partial<StoreConfig>) => void;
  getStats: () => CacheStats;
}

// Offline store specific types
export interface OfflineStoreState extends BaseStoreState {
  isOnline: boolean;
  isConnected: boolean;
  offlineGeocaches: Geocache[];
  offlineLogs: Record<string, GeocacheLog[]>;
  pendingActions: PendingAction[];
  storageInfo: StorageInfo;
  syncStatus: SyncStatus;
}

export interface PendingAction {
  id: string;
  type: 'create' | 'update' | 'delete';
  entity: 'geocache' | 'log';
  data: unknown;
  timestamp: Date;
  retryCount: number;
}

export interface StorageInfo {
  totalSize: number;
  availableSpace: number;
  geocacheCount: number;
  logCount: number;
  lastCleanup: Date | null;
}

export interface OfflineStoreActions {
  // Connectivity
  setOnlineStatus: (isOnline: boolean) => void;
  setConnectedStatus: (isConnected: boolean) => void;
  checkConnectivity: () => Promise<boolean>;
  
  // Offline data management
  saveGeocacheOffline: (geocache: Geocache) => Promise<StoreActionResult<void>>;
  saveLogOffline: (log: GeocacheLog) => Promise<StoreActionResult<void>>;
  removeOfflineGeocache: (id: string) => Promise<StoreActionResult<void>>;
  removeOfflineLog: (id: string) => Promise<StoreActionResult<void>>;
  
  // Sync operations
  syncPendingActions: () => Promise<StoreActionResult<void>>;
  addPendingAction: (action: Omit<PendingAction, 'id' | 'timestamp' | 'retryCount'>) => void;
  removePendingAction: (id: string) => void;
  
  // Storage management
  getStorageInfo: () => Promise<StorageInfo>;
  cleanupStorage: () => Promise<StoreActionResult<void>>;
  clearOfflineData: () => Promise<StoreActionResult<void>>;
  
  // Background sync
  startBackgroundSync: () => void;
  stopBackgroundSync: () => void;
  triggerSync: () => Promise<StoreActionResult<void>>;
  
  // Configuration
  updateConfig: (config: Partial<StoreConfig>) => void;
  getStats: () => CacheStats;
}

// Combined store interface for unified access
export interface UnifiedStores {
  geocache: GeocacheStoreState & GeocacheStoreActions;
  log: LogStoreState & LogStoreActions;
  author: AuthorStoreState & AuthorStoreActions;
  offline: OfflineStoreState & OfflineStoreActions;
}

// Store provider context type
export interface StoreProviderProps {
  children: React.ReactNode;
  config?: Partial<StoreConfig>;
}

// Hook return types
export type GeocacheStore = GeocacheStoreState & GeocacheStoreActions;
export type LogStore = LogStoreState & LogStoreActions;
export type AuthorStore = AuthorStoreState & AuthorStoreActions;
export type OfflineStore = OfflineStoreState & OfflineStoreActions;