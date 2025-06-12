/**
 * Offline feature types
 */

export type {
  OfflineAction,
  CachedGeocache,
  CachedProfile,
} from '../utils/offlineStorage';

export type {
  SyncStatus,
  SyncOptions,
} from '../utils/offlineSync';

export type {
  ConnectivityStatus,
  ConnectivityOptions,
} from '../utils/connectivityChecker';

export interface OfflineConfig {
  autoSync: boolean;
  offlineMode: boolean;
  offlineOnly: boolean;
  autoCacheMaps: boolean;
  maxCacheAge: number;
  maxStorageSize: number;
  enableAutoCleanup: boolean;
}

export interface OfflineStorageInfo {
  used: number;
  quota: number;
  geocaches: number;
  profiles: number;
  events: number;
  mapTiles: number;
}