/**
 * Cache Manager for coordinating LRU caches with React Query
 * Provides intelligent caching that prevents unnecessary refetches
 */

import { GeocacheCache, LogCache, CacheStats } from '@/shared/utils/lruCache';
import { STORAGE_CONFIG } from '@/shared/config/storage';

export interface CacheManagerStats {
  geocaches: CacheStats;
  logs: CacheStats;
  totalMemoryUsage: number;
  lastCleanup: number | null;
  cacheEfficiency: 'excellent' | 'good' | 'poor';
  memoryPressure: 'low' | 'moderate' | 'high';
}

export interface CacheValidationResult {
  isValid: boolean;
  reason?: string;
  shouldRefetch: boolean;
}

class CacheManagerClass {
  private geocacheCache: GeocacheCache;
  private logCache: LogCache;
  private lastCleanup: number | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.geocacheCache = new GeocacheCache(STORAGE_CONFIG.MAX_CACHE_ENTRIES);
    this.logCache = new LogCache(STORAGE_CONFIG.MAX_CACHE_ENTRIES);
    
    // Start automatic cleanup
    this.startCleanupInterval();
  }

  /**
   * GEOCACHE OPERATIONS
   */

  /**
   * Get geocache from cache
   */
  getGeocache(id: string): any | undefined {
    return this.geocacheCache.get(id);
  }

  /**
   * Set geocache in cache
   */
  setGeocache(id: string, geocache: any): void {
    this.geocacheCache.set(id, geocache);
  }

  /**
   * Check if geocache exists in cache
   */
  hasGeocache(id: string): boolean {
    return this.geocacheCache.has(id);
  }

  /**
   * Set multiple geocaches at once
   */
  setGeocaches(geocaches: any[]): void {
    const entries = geocaches.map(geocache => ({
      key: geocache.id,
      data: geocache,
    }));
    this.geocacheCache.setMany(entries);
  }

  /**
   * Get all cached geocaches
   */
  getAllGeocaches(): any[] {
    return this.geocacheCache.values();
  }

  /**
   * Get geocaches by author
   */
  getGeocachesByAuthor(pubkey: string): any[] {
    return this.geocacheCache.getByAuthor(pubkey);
  }

  /**
   * Update geocache data
   */
  updateGeocache(id: string, updates: Partial<any>): void {
    this.geocacheCache.updateGeocache(id, updates);
  }

  /**
   * LOG OPERATIONS
   */

  /**
   * Get logs for a geocache
   */
  getLogs(geocacheId: string): any[] | undefined {
    return this.logCache.get(geocacheId);
  }

  /**
   * Set logs for a geocache
   */
  setLogs(geocacheId: string, logs: any[]): void {
    this.logCache.set(geocacheId, logs);
  }

  /**
   * Check if logs exist for a geocache
   */
  hasLogs(geocacheId: string): boolean {
    return this.logCache.has(geocacheId);
  }

  /**
   * Add a new log to a geocache
   */
  addLog(geocacheId: string, log: any): void {
    this.logCache.addLog(geocacheId, log);
  }

  /**
   * Remove a log from a geocache
   */
  removeLog(geocacheId: string, logId: string): void {
    this.logCache.removeLog(geocacheId, logId);
  }

  /**
   * Get recent logs across all geocaches
   */
  getRecentLogs(limit: number = 20): any[] {
    return this.logCache.getRecentLogs(limit);
  }

  /**
   * VALIDATION AND FRESHNESS
   */

  /**
   * Validate if cached data is still fresh and should be used
   */
  validateGeocache(id: string, maxAge: number = 300000): CacheValidationResult {
    const entry = this.geocacheCache.getEntry(id);
    
    if (!entry) {
      return {
        isValid: false,
        reason: 'Not in cache',
        shouldRefetch: true,
      };
    }

    const age = Date.now() - entry.timestamp;
    
    if (age > maxAge) {
      return {
        isValid: false,
        reason: 'Cache expired',
        shouldRefetch: true,
      };
    }

    return {
      isValid: true,
      shouldRefetch: false,
    };
  }

  /**
   * Validate if cached logs are fresh
   */
  validateLogs(geocacheId: string, maxAge: number = 240000): CacheValidationResult {
    const entry = this.logCache.getEntry(geocacheId);
    
    if (!entry) {
      return {
        isValid: false,
        reason: 'Not in cache',
        shouldRefetch: true,
      };
    }

    const age = Date.now() - entry.timestamp;
    
    if (age > maxAge) {
      return {
        isValid: false,
        reason: 'Cache expired',
        shouldRefetch: true,
      };
    }

    return {
      isValid: true,
      shouldRefetch: false,
    };
  }

  /**
   * Check if we should skip a query because we have fresh data
   */
  shouldSkipGeocacheQuery(id: string): boolean {
    const validation = this.validateGeocache(id);
    return validation.isValid && !validation.shouldRefetch;
  }

  /**
   * Check if we should skip a logs query because we have fresh data
   */
  shouldSkipLogsQuery(geocacheId: string): boolean {
    const validation = this.validateLogs(geocacheId);
    return validation.isValid && !validation.shouldRefetch;
  }

  /**
   * BACKGROUND UPDATES
   */

  /**
   * Mark data as needing background update (but don't force immediate refetch)
   */
  markForBackgroundUpdate(type: 'geocache' | 'logs', id: string): void {
    // This could be used to queue background updates
    // For now, we'll just ensure the data gets refreshed on next access
    if (type === 'geocache') {
      const entry = this.geocacheCache.getEntry(id);
      if (entry) {
        // Reduce timestamp to make it appear older (will trigger refresh sooner)
        entry.timestamp = entry.timestamp - 60000; // Make it 1 minute older
      }
    } else {
      const entry = this.logCache.getEntry(id);
      if (entry) {
        entry.timestamp = entry.timestamp - 60000;
      }
    }
  }

  /**
   * Update data only if it's actually new
   */
  updateIfNewer(type: 'geocache' | 'logs', id: string, newData: any, timestamp?: number): boolean {
    const dataTimestamp = timestamp || Date.now();
    
    if (type === 'geocache') {
      const existing = this.geocacheCache.getEntry(id);
      if (!existing) {
        // No existing data, add it
        this.setGeocache(id, newData);
        return true;
      }
      
      // Only update if significantly newer (more than 30 seconds)
      const timeDiff = dataTimestamp - existing.timestamp;
      if (timeDiff > 30000) {
        this.setGeocache(id, newData);
        return true;
      }
    } else {
      const existing = this.logCache.getEntry(id);
      if (!existing) {
        // No existing data, add it
        this.setLogs(id, newData);
        return true;
      }
      
      // Only update if significantly newer (more than 30 seconds)
      const timeDiff = dataTimestamp - existing.timestamp;
      if (timeDiff > 30000) {
        this.setLogs(id, newData);
        return true;
      }
    }
    
    return false;
  }

  /**
   * Safely update cache with new data, preserving existing if network fails
   */
  safeUpdate(type: 'geocache' | 'logs', id: string, newData: any, fallbackToCache: boolean = true): boolean {
    try {
      if (type === 'geocache') {
        // Only update if we have actual data
        if (newData && (Array.isArray(newData) ? newData.length > 0 : true)) {
          this.setGeocache(id, newData);
          return true;
        } else if (fallbackToCache) {
          // Don't clear existing cache if new data is empty
          const existing = this.getGeocache(id);
          if (existing) {
            console.log(`Preserving cached geocache ${id} - network returned empty`);
            return false; // Didn't update, but preserved cache
          }
        }
      } else {
        // Only update if we have actual data
        if (newData && Array.isArray(newData) && newData.length > 0) {
          this.setLogs(id, newData);
          return true;
        } else if (fallbackToCache) {
          // Don't clear existing cache if new data is empty
          const existing = this.getLogs(id);
          if (existing && existing.length > 0) {
            console.log(`Preserving cached logs for ${id} - network returned empty`);
            return false; // Didn't update, but preserved cache
          }
        }
      }
      
      return false;
    } catch (error) {
      console.warn(`Failed to update cache for ${type} ${id}:`, error);
      return false;
    }
  }

  /**
   * CLEANUP AND MAINTENANCE
   */

  /**
   * Clean up old cache entries
   */
  cleanup(): void {
    const maxAge = STORAGE_CONFIG.MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
    
    const geocachesEvicted = this.geocacheCache.evictOld(maxAge);
    const logsEvicted = this.logCache.evictOld(maxAge);
    
    this.lastCleanup = Date.now();
    
    console.log(`Cache cleanup: evicted ${geocachesEvicted} geocaches, ${logsEvicted} log entries`);
  }

  /**
   * Start automatic cleanup interval
   */
  private startCleanupInterval(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, STORAGE_CONFIG.CLEANUP_INTERVAL);
  }

  /**
   * Stop automatic cleanup
   */
  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Clear all caches
   */
  clearAll(): void {
    this.geocacheCache.clear();
    this.logCache.clear();
    this.lastCleanup = null;
  }

  /**
   * Get comprehensive cache statistics
   */
  getStats(): CacheManagerStats {
    const geocacheStats = this.geocacheCache.getStats();
    const logStats = this.logCache.getStats();
    
    // Rough memory usage estimation
    const geocacheMemory = geocacheStats.size * 2000; // ~2KB per geocache
    const logMemory = logStats.size * 1000; // ~1KB per log entry
    const totalMemoryUsage = geocacheMemory + logMemory;
    
    // Calculate overall hit rate
    const totalHits = geocacheStats.totalHits + logStats.totalHits;
    const totalRequests = totalHits + geocacheStats.totalMisses + logStats.totalMisses;
    const overallHitRate = totalRequests > 0 ? totalHits / totalRequests : 0;
    
    // Determine cache efficiency
    const cacheEfficiency: 'excellent' | 'good' | 'poor' = 
      overallHitRate >= 0.8 ? 'excellent' :
      overallHitRate >= 0.6 ? 'good' : 'poor';
    
    // Determine memory pressure
    const memoryPressure: 'low' | 'moderate' | 'high' = 
      totalMemoryUsage < 1024 * 1024 ? 'low' : // < 1MB
      totalMemoryUsage < 5 * 1024 * 1024 ? 'moderate' : 'high'; // < 5MB
    
    return {
      geocaches: geocacheStats,
      logs: logStats,
      totalMemoryUsage,
      lastCleanup: this.lastCleanup,
      cacheEfficiency,
      memoryPressure,
    };
  }

  /**
   * Remove specific entries (for deletion events)
   */
  removeGeocache(id: string): boolean {
    return this.geocacheCache.delete(id);
  }

  /**
   * Remove logs for a geocache
   */
  removeLogs(geocacheId: string): boolean {
    return this.logCache.delete(geocacheId);
  }

  /**
   * Get cache keys for debugging
   */
  getGeocacheKeys(): string[] {
    return this.geocacheCache.keys();
  }

  /**
   * Get log cache keys for debugging
   */
  getLogKeys(): string[] {
    return this.logCache.keys();
  }

  /**
   * Destroy the cache manager
   */
  destroy(): void {
    this.stopCleanup();
    this.clearAll();
  }
}

// Singleton instance
export const cacheManager = new CacheManagerClass();

// Export for testing
export { CacheManagerClass };