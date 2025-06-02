/**
 * Offline synchronization manager for handling background sync and conflict resolution
 */

import { NostrEvent } from '@nostrify/nostrify';
import { offlineStorage, OfflineAction } from './offlineStorage';
import { connectivityChecker, ConnectivityStatus } from './connectivityChecker';

export interface SyncStatus {
  isOnline: boolean;
  isConnected: boolean;
  connectionQuality: 'good' | 'poor' | 'offline';
  isSyncing: boolean;
  lastSyncTime: number | null;
  pendingActions: number;
  syncErrors: string[];
  latency?: number;
}

export interface SyncOptions {
  maxRetries: number;
  retryDelay: number;
  batchSize: number;
}

class OfflineSync {
  private connectivity: ConnectivityStatus = {
    isOnline: navigator.onLine,
    isConnected: false,
    connectionQuality: 'offline',
    lastChecked: 0,
  };
  private isSyncing = false;
  private syncListeners: ((status: SyncStatus) => void)[] = [];
  private syncInterval: number | null = null;
  private lastSyncTime: number | null = null;
  private syncErrors: string[] = [];
  private connectivityUnsubscribe: (() => void) | null = null;

  constructor() {
    this.setupConnectivityListener();
    this.setupPeriodicSync();
  }

  private setupConnectivityListener(): void {
    // Subscribe to connectivity changes
    this.connectivityUnsubscribe = connectivityChecker.addListener((status) => {
      const wasConnected = this.connectivity.isConnected;
      this.connectivity = status;
      
      // Trigger sync when we regain connectivity
      if (!wasConnected && status.isConnected && status.connectionQuality !== 'offline') {
        this.syncWhenOnline();
      }
      
      this.notifyListeners();
    });

    // Get initial status
    this.connectivity = connectivityChecker.getStatus();
  }

  private setupPeriodicSync(): void {
    // Sync every 5 minutes when connected
    this.syncInterval = window.setInterval(() => {
      if (this.connectivity.isConnected && !this.isSyncing) {
        this.syncPendingActions();
      }
    }, 5 * 60 * 1000);
  }

  private async syncWhenOnline(): Promise<void> {
    if (this.connectivity.isConnected) {
      await this.syncPendingActions();
    }
  }

  async syncPendingActions(options: Partial<SyncOptions> = {}): Promise<void> {
    if (this.isSyncing || !this.connectivity.isConnected) {
      return;
    }

    const defaultOptions: SyncOptions = {
      maxRetries: 3,
      retryDelay: 1000,
      batchSize: 10,
    };

    const syncOptions = { ...defaultOptions, ...options };

    this.isSyncing = true;
    this.syncErrors = [];
    this.notifyListeners();

    try {
      const pendingActions = await offlineStorage.getPendingActions();
      
      // Process actions in batches
      for (let i = 0; i < pendingActions.length; i += syncOptions.batchSize) {
        const batch = pendingActions.slice(i, i + syncOptions.batchSize);
        await this.processBatch(batch, syncOptions);
      }

      this.lastSyncTime = Date.now();
      await offlineStorage.setSetting('lastSyncTime', this.lastSyncTime);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown sync error';
      this.syncErrors.push(errorMessage);
      console.error('Sync failed:', error);
    } finally {
      this.isSyncing = false;
      this.notifyListeners();
    }
  }

  private async processBatch(actions: OfflineAction[], options: SyncOptions): Promise<void> {
    const promises = actions.map(action => this.processAction(action, options));
    await Promise.allSettled(promises);
  }

  private async processAction(action: OfflineAction, options: SyncOptions): Promise<void> {
    try {
      switch (action.type) {
        case 'publish_event':
          await this.publishEvent(action);
          break;
        case 'update_profile':
          await this.updateProfile(action);
          break;
        case 'create_log':
          await this.createLog(action);
          break;
        case 'bookmark_cache':
          await this.bookmarkCache(action);
          break;
        default:
          throw new Error(`Unknown action type: ${action.type}`);
      }

      // Remove successful action
      await offlineStorage.removeOfflineAction(action.id);
    } catch (error) {
      // Increment retry count
      action.retryCount++;
      
      if (action.retryCount >= action.maxRetries) {
        // Max retries reached, remove action and log error
        await offlineStorage.removeOfflineAction(action.id);
        const errorMessage = `Failed to sync action ${action.id} after ${action.maxRetries} retries: ${error}`;
        this.syncErrors.push(errorMessage);
        console.error(errorMessage);
      } else {
        // Update action with new retry count
        await offlineStorage.updateOfflineAction(action);
        
        // Wait before next retry
        await new Promise(resolve => setTimeout(resolve, options.retryDelay * action.retryCount));
      }
    }
  }

  private async publishEvent(action: OfflineAction): Promise<void> {
    const eventData = action.data as { event: NostrEvent };
    
    // This would integrate with your Nostr client
    // For now, we'll simulate the API call
    const response = await fetch('/api/nostr/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(eventData),
    });

    if (!response.ok) {
      throw new Error(`Failed to publish event: ${response.statusText}`);
    }
  }

  private async updateProfile(action: OfflineAction): Promise<void> {
    const profileData = action.data as { metadata: Record<string, unknown> };
    
    // This would integrate with your Nostr client
    const response = await fetch('/api/nostr/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profileData),
    });

    if (!response.ok) {
      throw new Error(`Failed to update profile: ${response.statusText}`);
    }
  }

  private async createLog(action: OfflineAction): Promise<void> {
    const logData = action.data as { geocacheId: string; content: string; type: string };
    
    // This would integrate with your Nostr client
    const response = await fetch('/api/nostr/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(logData),
    });

    if (!response.ok) {
      throw new Error(`Failed to create log: ${response.statusText}`);
    }
  }

  private async bookmarkCache(action: OfflineAction): Promise<void> {
    const bookmarkData = action.data as { geocacheId: string; bookmarked: boolean };
    
    // This would integrate with your Nostr client
    const response = await fetch('/api/nostr/bookmark', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bookmarkData),
    });

    if (!response.ok) {
      throw new Error(`Failed to bookmark cache: ${response.statusText}`);
    }
  }

  // Queue offline actions
  async queueAction(
    type: OfflineAction['type'],
    data: Record<string, unknown>,
    maxRetries = 3
  ): Promise<string> {
    const actionId = await offlineStorage.addOfflineAction({
      type,
      data,
      timestamp: Date.now(),
      retryCount: 0,
      maxRetries,
    });

    this.notifyListeners();

    // Try to sync immediately if connected
    if (this.connectivity.isConnected && !this.isSyncing) {
      this.syncPendingActions();
    }

    return actionId;
  }

  // Status and listeners
  async getStatus(): Promise<SyncStatus> {
    const pendingActions = await offlineStorage.getPendingActions();
    const lastSyncTime = await offlineStorage.getSetting('lastSyncTime') as number | null;
    
    return {
      isOnline: this.connectivity.isOnline,
      isConnected: this.connectivity.isConnected,
      connectionQuality: this.connectivity.connectionQuality,
      isSyncing: this.isSyncing,
      lastSyncTime: lastSyncTime || this.lastSyncTime,
      pendingActions: pendingActions.length,
      syncErrors: [...this.syncErrors],
      latency: this.connectivity.latency,
    };
  }

  addSyncListener(listener: (status: SyncStatus) => void): () => void {
    this.syncListeners.push(listener);
    
    // Return unsubscribe function
    return () => {
      const index = this.syncListeners.indexOf(listener);
      if (index > -1) {
        this.syncListeners.splice(index, 1);
      }
    };
  }

  private async notifyListeners(): Promise<void> {
    const status = await this.getStatus();
    this.syncListeners.forEach(listener => {
      try {
        listener(status);
      } catch (error) {
        console.error('Error in sync listener:', error);
      }
    });
  }

  // Manual sync trigger
  async forcSync(): Promise<void> {
    // Force a connectivity check first
    const status = await connectivityChecker.forceCheck();
    
    if (status.isConnected) {
      await this.syncPendingActions();
    } else {
      throw new Error('Cannot sync while offline - no internet connectivity detected');
    }
  }

  // Force connectivity check
  async checkConnectivity(): Promise<ConnectivityStatus> {
    return await connectivityChecker.forceCheck();
  }

  // Cleanup
  destroy(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    if (this.connectivityUnsubscribe) {
      this.connectivityUnsubscribe();
      this.connectivityUnsubscribe = null;
    }
    this.syncListeners = [];
  }
}

// Singleton instance
export const offlineSync = new OfflineSync();