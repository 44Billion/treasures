/**
 * Offline storage system using IndexedDB for Nostr events and app data
 */

import { NostrEvent } from '@nostrify/nostrify';

const DB_NAME = 'TreasuresOfflineDB';
const DB_VERSION = 1;

// Store names
const STORES = {
  EVENTS: 'events',
  GEOCACHES: 'geocaches', 
  LOGS: 'logs',
  PROFILES: 'profiles',
  PENDING_EVENTS: 'pendingEvents',
  SETTINGS: 'settings',
  OFFLINE_ACTIONS: 'offlineActions',
} as const;

export interface OfflineAction {
  id: string;
  type: 'publish_event' | 'update_profile' | 'create_log' | 'bookmark_cache';
  data: Record<string, unknown>;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
}

export interface CachedGeocache {
  id: string;
  event: NostrEvent;
  lastUpdated: number;
  lastValidated?: number; // When we last confirmed this exists upstream
  coordinates?: [number, number];
  difficulty?: number;
  terrain?: number;
  type?: string;
}

export interface CachedProfile {
  pubkey: string;
  metadata: Record<string, unknown>;
  lastUpdated: number;
}

class OfflineStorage {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  async init(): Promise<void> {
    if (this.initPromise) {
      return this.initPromise;
    }

    // Check if IndexedDB is available
    if (typeof indexedDB === 'undefined') {
      console.warn('IndexedDB not available, offline storage disabled');
      this.initPromise = Promise.resolve();
      return this.initPromise;
    }

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Events store
        if (!db.objectStoreNames.contains(STORES.EVENTS)) {
          const eventsStore = db.createObjectStore(STORES.EVENTS, { keyPath: 'id' });
          eventsStore.createIndex('kind', 'kind');
          eventsStore.createIndex('pubkey', 'pubkey');
          eventsStore.createIndex('created_at', 'created_at');
        }

        // Geocaches store
        if (!db.objectStoreNames.contains(STORES.GEOCACHES)) {
          const geocachesStore = db.createObjectStore(STORES.GEOCACHES, { keyPath: 'id' });
          geocachesStore.createIndex('coordinates', 'coordinates');
          geocachesStore.createIndex('difficulty', 'difficulty');
          geocachesStore.createIndex('terrain', 'terrain');
          geocachesStore.createIndex('type', 'type');
          geocachesStore.createIndex('lastUpdated', 'lastUpdated');
        }

        // Logs store
        if (!db.objectStoreNames.contains(STORES.LOGS)) {
          const logsStore = db.createObjectStore(STORES.LOGS, { keyPath: 'id' });
          logsStore.createIndex('geocacheId', 'geocacheId');
          logsStore.createIndex('pubkey', 'pubkey');
          logsStore.createIndex('timestamp', 'timestamp');
        }

        // Profiles store
        if (!db.objectStoreNames.contains(STORES.PROFILES)) {
          const profilesStore = db.createObjectStore(STORES.PROFILES, { keyPath: 'pubkey' });
          profilesStore.createIndex('lastUpdated', 'lastUpdated');
        }

        // Pending events store
        if (!db.objectStoreNames.contains(STORES.PENDING_EVENTS)) {
          const pendingStore = db.createObjectStore(STORES.PENDING_EVENTS, { keyPath: 'id' });
          pendingStore.createIndex('timestamp', 'timestamp');
        }

        // Settings store
        if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
          db.createObjectStore(STORES.SETTINGS, { keyPath: 'key' });
        }

        // Offline actions store
        if (!db.objectStoreNames.contains(STORES.OFFLINE_ACTIONS)) {
          const actionsStore = db.createObjectStore(STORES.OFFLINE_ACTIONS, { keyPath: 'id' });
          actionsStore.createIndex('type', 'type');
          actionsStore.createIndex('timestamp', 'timestamp');
        }
      };
    });

    return this.initPromise;
  }

  private async ensureDB(): Promise<IDBDatabase> {
    if (!this.db) {
      await this.init();
    }
    if (!this.db) {
      throw new Error('IndexedDB not available or failed to initialize');
    }
    return this.db;
  }

  // Event storage methods
  async storeEvent(event: NostrEvent): Promise<void> {
    try {
      const db = await this.ensureDB();
      const transaction = db.transaction([STORES.EVENTS], 'readwrite');
      const store = transaction.objectStore(STORES.EVENTS);
      await new Promise<void>((resolve, reject) => {
        const request = store.put(event);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.warn('Failed to store event offline:', error);
      // Silently fail if IndexedDB is not available
    }
  }

  async getEvent(id: string): Promise<NostrEvent | null> {
    try {
      const db = await this.ensureDB();
      const transaction = db.transaction([STORES.EVENTS], 'readonly');
      const store = transaction.objectStore(STORES.EVENTS);
      return new Promise((resolve, reject) => {
        const request = store.get(id);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.warn('Failed to get event offline:', error);
      return null;
    }
  }

  async getEventsByKind(kind: number): Promise<NostrEvent[]> {
    const db = await this.ensureDB();
    const transaction = db.transaction([STORES.EVENTS], 'readonly');
    const store = transaction.objectStore(STORES.EVENTS);
    const index = store.index('kind');
    return new Promise((resolve, reject) => {
      const request = index.getAll(kind);
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  // Geocache storage methods
  async storeGeocache(geocache: CachedGeocache): Promise<void> {
    const db = await this.ensureDB();
    const transaction = db.transaction([STORES.GEOCACHES], 'readwrite');
    const store = transaction.objectStore(STORES.GEOCACHES);
    await new Promise<void>((resolve, reject) => {
      const request = store.put(geocache);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getGeocache(id: string): Promise<CachedGeocache | null> {
    const db = await this.ensureDB();
    const transaction = db.transaction([STORES.GEOCACHES], 'readonly');
    const store = transaction.objectStore(STORES.GEOCACHES);
    return new Promise((resolve, reject) => {
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async getAllGeocaches(): Promise<CachedGeocache[]> {
    const db = await this.ensureDB();
    const transaction = db.transaction([STORES.GEOCACHES], 'readonly');
    const store = transaction.objectStore(STORES.GEOCACHES);
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  // Fast method to get recent geocaches with limit
  async getRecentGeocaches(limit: number = 20): Promise<CachedGeocache[]> {
    const db = await this.ensureDB();
    const transaction = db.transaction([STORES.GEOCACHES], 'readonly');
    const store = transaction.objectStore(STORES.GEOCACHES);
    const index = store.index('lastUpdated');
    
    return new Promise((resolve, reject) => {
      const results: CachedGeocache[] = [];
      const request = index.openCursor(null, 'prev'); // Newest first
      
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor && results.length < limit) {
          results.push(cursor.value);
          cursor.continue();
        } else {
          resolve(results);
        }
      };
      
      request.onerror = () => reject(request.error);
    });
  }

  async getGeocachesInBounds(
    minLat: number,
    maxLat: number,
    minLng: number,
    maxLng: number
  ): Promise<CachedGeocache[]> {
    const allCaches = await this.getAllGeocaches();
    return allCaches.filter(cache => {
      if (!cache.coordinates) return false;
      const [lat, lng] = cache.coordinates;
      return lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng;
    });
  }

  // Profile storage methods
  async storeProfile(profile: CachedProfile): Promise<void> {
    const db = await this.ensureDB();
    const transaction = db.transaction([STORES.PROFILES], 'readwrite');
    const store = transaction.objectStore(STORES.PROFILES);
    await new Promise<void>((resolve, reject) => {
      const request = store.put(profile);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getProfile(pubkey: string): Promise<CachedProfile | null> {
    const db = await this.ensureDB();
    const transaction = db.transaction([STORES.PROFILES], 'readonly');
    const store = transaction.objectStore(STORES.PROFILES);
    return new Promise((resolve, reject) => {
      const request = store.get(pubkey);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  // Offline actions methods
  async addOfflineAction(action: Omit<OfflineAction, 'id'>): Promise<string> {
    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const fullAction: OfflineAction = { ...action, id };
    
    const db = await this.ensureDB();
    const transaction = db.transaction([STORES.OFFLINE_ACTIONS], 'readwrite');
    const store = transaction.objectStore(STORES.OFFLINE_ACTIONS);
    
    await new Promise<void>((resolve, reject) => {
      const request = store.put(fullAction);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
    
    return id;
  }

  async getPendingActions(): Promise<OfflineAction[]> {
    try {
      const db = await this.ensureDB();
      const transaction = db.transaction([STORES.OFFLINE_ACTIONS], 'readonly');
      const store = transaction.objectStore(STORES.OFFLINE_ACTIONS);
      return new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.warn('Failed to get pending actions:', error);
      return [];
    }
  }

  async removeOfflineAction(id: string): Promise<void> {
    const db = await this.ensureDB();
    const transaction = db.transaction([STORES.OFFLINE_ACTIONS], 'readwrite');
    const store = transaction.objectStore(STORES.OFFLINE_ACTIONS);
    await new Promise<void>((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async updateOfflineAction(action: OfflineAction): Promise<void> {
    const db = await this.ensureDB();
    const transaction = db.transaction([STORES.OFFLINE_ACTIONS], 'readwrite');
    const store = transaction.objectStore(STORES.OFFLINE_ACTIONS);
    await new Promise<void>((resolve, reject) => {
      const request = store.put(action);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Settings methods
  async setSetting(key: string, value: unknown): Promise<void> {
    const db = await this.ensureDB();
    const transaction = db.transaction([STORES.SETTINGS], 'readwrite');
    const store = transaction.objectStore(STORES.SETTINGS);
    await new Promise<void>((resolve, reject) => {
      const request = store.put({ key, value });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getSetting(key: string): Promise<unknown> {
    const db = await this.ensureDB();
    const transaction = db.transaction([STORES.SETTINGS], 'readonly');
    const store = transaction.objectStore(STORES.SETTINGS);
    return new Promise((resolve, reject) => {
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result?.value);
      request.onerror = () => reject(request.error);
    });
  }

  // Cleanup methods
  async clearOldData(maxAge: number = 30 * 24 * 60 * 60 * 1000): Promise<void> {
    const cutoff = Date.now() - maxAge;
    const db = await this.ensureDB();
    
    // Clear old geocaches
    const geocacheTransaction = db.transaction([STORES.GEOCACHES], 'readwrite');
    const geocacheStore = geocacheTransaction.objectStore(STORES.GEOCACHES);
    const geocacheIndex = geocacheStore.index('lastUpdated');
    
    const geocacheRequest = geocacheIndex.openCursor(IDBKeyRange.upperBound(cutoff));
    geocacheRequest.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };

    // Clear old profiles
    const profileTransaction = db.transaction([STORES.PROFILES], 'readwrite');
    const profileStore = profileTransaction.objectStore(STORES.PROFILES);
    const profileIndex = profileStore.index('lastUpdated');
    
    const profileRequest = profileIndex.openCursor(IDBKeyRange.upperBound(cutoff));
    profileRequest.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };
  }

  // Remove specific geocache from storage
  async removeGeocache(id: string): Promise<void> {
    try {
      const db = await this.ensureDB();
      const transaction = db.transaction([STORES.GEOCACHES], 'readwrite');
      const store = transaction.objectStore(STORES.GEOCACHES);
      await new Promise<void>((resolve, reject) => {
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.warn('Failed to remove geocache from storage:', error);
    }
  }

  // Update validation timestamp for a geocache
  async updateGeocacheValidation(id: string): Promise<void> {
    try {
      const geocache = await this.getGeocache(id);
      if (geocache) {
        geocache.lastValidated = Date.now();
        await this.storeGeocache(geocache);
      }
    } catch (error) {
      console.warn('Failed to update geocache validation:', error);
    }
  }

  // Get geocaches that haven't been validated recently
  async getUnvalidatedGeocaches(maxAge: number = 24 * 60 * 60 * 1000): Promise<CachedGeocache[]> {
    try {
      const allCaches = await this.getAllGeocaches();
      const cutoff = Date.now() - maxAge;
      
      return allCaches.filter(cache => 
        !cache.lastValidated || cache.lastValidated < cutoff
      );
    } catch (error) {
      console.warn('Failed to get unvalidated geocaches:', error);
      return [];
    }
  }

  // Remove specific event from storage
  async removeEvent(id: string): Promise<void> {
    try {
      const db = await this.ensureDB();
      const transaction = db.transaction([STORES.EVENTS], 'readwrite');
      const store = transaction.objectStore(STORES.EVENTS);
      await new Promise<void>((resolve, reject) => {
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.warn('Failed to remove event from storage:', error);
    }
  }

  // Storage management with limits
  async checkStorageLimit(): Promise<boolean> {
    try {
      const { getStorageUsage, isStorageNearLimit } = await import('@/shared/utils/storageConfig');
      return await isStorageNearLimit();
    } catch (error) {
      console.warn('Failed to check storage limit:', error);
      return false;
    }
  }

  async performCleanup(): Promise<void> {
    try {
      const { getStorageConfig } = await import('@/shared/utils/storageConfig');
      const config = await getStorageConfig();
      
      if (config.enableAutoCleanup) {
        console.log('Performing storage cleanup...');
        await this.clearOldData(config.maxCacheAge);
        
        // Also clear browser caches if needed
        if ('caches' in window) {
          const cacheNames = await caches.keys();
          for (const cacheName of cacheNames) {
            if (cacheName.includes('old') || cacheName.includes('temp')) {
              await caches.delete(cacheName);
            }
          }
        }
      }
    } catch (error) {
      console.error('Failed to perform cleanup:', error);
    }
  }

  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.initPromise = null;
    }
  }
}

// Singleton instance
export const offlineStorage = new OfflineStorage();