/**
 * Storage configuration and limits
 */

// Default storage limit: 2GB in bytes
export const DEFAULT_STORAGE_LIMIT = 2 * 1024 * 1024 * 1024; // 2GB

// Storage configuration
export interface StorageConfig {
  maxStorageSize: number; // in bytes
  cleanupThreshold: number; // percentage (0-1) at which to trigger cleanup
  maxCacheAge: number; // maximum age in milliseconds before data is considered stale
  enableAutoCleanup: boolean;
}

// Default storage configuration
export const DEFAULT_STORAGE_CONFIG: StorageConfig = {
  maxStorageSize: DEFAULT_STORAGE_LIMIT,
  cleanupThreshold: 0.9, // Cleanup when 90% full
  maxCacheAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  enableAutoCleanup: true,
};

// Storage configuration constants
export const STORAGE_CONFIG = {
  MAX_AGE_DAYS: 30,
  CLEANUP_INTERVAL: 24 * 60 * 60 * 1000, // 24 hours
  MAX_CACHE_ENTRIES: 500,
  MAX_IMAGE_CACHE_ENTRIES: 200,
} as const;

// Get storage configuration from settings or use defaults
export async function getStorageConfig(): Promise<StorageConfig> {
  try {
    // Try to get from localStorage first for immediate access
    const stored = localStorage.getItem('treasures-storage-config');
    if (stored) {
      const config = JSON.parse(stored);
      return { ...DEFAULT_STORAGE_CONFIG, ...config };
    }
  } catch (error) {
    console.warn('Failed to load storage config from localStorage:', error);
  }
  
  return DEFAULT_STORAGE_CONFIG;
}

// Save storage configuration
export async function setStorageConfig(config: Partial<StorageConfig>): Promise<void> {
  try {
    const currentConfig = await getStorageConfig();
    const newConfig = { ...currentConfig, ...config };
    
    // Save to localStorage for immediate access
    localStorage.setItem('treasures-storage-config', JSON.stringify(newConfig));
    
    // Also save to IndexedDB for persistence (if available)
    try {
      const { offlineStorage } = await import('@/features/offline/utils/offlineStorage');
      await offlineStorage.setSetting('storageConfig', newConfig);
    } catch (error) {
      // IndexedDB might not be available in test environment, that's ok
      console.warn('Failed to save to IndexedDB:', error);
    }
  } catch (error) {
    console.error('Failed to save storage config:', error);
    throw error;
  }
}

// Get current storage usage estimate
export async function getStorageUsage(): Promise<{
  used: number;
  quota: number;
  percentage: number;
}> {
  // Get the configured storage limit (not the browser's quota)
  // This ensures we respect the user's configured limit (default 2GB)
  // rather than using the browser's potentially much larger quota
  const config = await getStorageConfig();
  const configuredQuota = config.maxStorageSize;
  
  try {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      const used = estimate.usage || 0;
      
      // Use the configured limit, not the browser's quota
      return {
        used,
        quota: configuredQuota,
        percentage: configuredQuota > 0 ? used / configuredQuota : 0,
      };
    }
  } catch (error) {
    console.warn('Failed to get storage estimate:', error);
  }
  
  // Fallback: estimate based on IndexedDB size
  try {
    const { offlineStorage } = await import('@/features/offline/utils/offlineStorage');
    await offlineStorage.init();
    
    // This is a rough estimate - in a real implementation you'd want to
    // calculate the actual size of stored data
    const geocaches = await offlineStorage.getAllGeocaches();
    const estimatedSize = geocaches.length * 10000; // Rough estimate: 10KB per cache
    
    return {
      used: estimatedSize,
      quota: configuredQuota,
      percentage: estimatedSize / configuredQuota,
    };
  } catch (error) {
    console.warn('Failed to estimate storage usage:', error);
    return {
      used: 0,
      quota: configuredQuota,
      percentage: 0,
    };
  }
}

// Check if storage is approaching limit
export async function isStorageNearLimit(): Promise<boolean> {
  const config = await getStorageConfig();
  const usage = await getStorageUsage();
  
  // Calculate percentage based on configured limit
  const percentage = usage.quota > 0 ? usage.used / usage.quota : 0;
  
  return percentage >= config.cleanupThreshold;
}

// Format bytes for display
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}