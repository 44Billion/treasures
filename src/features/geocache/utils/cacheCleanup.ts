/**
 * Cache cleanup utilities to prevent memory leaks
 */

import { QueryClient } from '@tanstack/react-query';

export class CacheCleanupManager {
  private queryClient: QueryClient;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private readonly CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes
  private readonly MAX_CACHE_ENTRIES = 200; // Maximum number of cached queries

  constructor(queryClient: QueryClient) {
    this.queryClient = queryClient;
  }

  /**
   * Start automatic cache cleanup
   */
  start() {
    if (this.cleanupInterval) return;

    this.cleanupInterval = setInterval(() => {
      this.performCleanup();
    }, this.CLEANUP_INTERVAL);

    console.log('Cache cleanup manager started');
  }

  /**
   * Stop automatic cache cleanup
   */
  stop() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      console.log('Cache cleanup manager stopped');
    }
  }

  /**
   * Perform cache cleanup
   */
  private performCleanup() {
    try {
      const cache = this.queryClient.getQueryCache();
      const queries = cache.getAll();
      
      console.log(`Cache cleanup: ${queries.length} queries in cache`);

      // Remove queries that haven't been used recently
      const now = Date.now();
      const staleThreshold = 10 * 60 * 1000; // 10 minutes
      let removedCount = 0;

      for (const query of queries) {
        const lastAccessed = query.state.dataUpdatedAt || query.state.errorUpdatedAt || 0;
        const isStale = now - lastAccessed > staleThreshold;
        
        // Remove stale queries that aren't currently being observed
        if (isStale && query.getObserversCount() === 0) {
          cache.remove(query);
          removedCount++;
        }
      }

      // If we still have too many queries, remove the oldest ones
      const remainingQueries = cache.getAll();
      if (remainingQueries.length > this.MAX_CACHE_ENTRIES) {
        const sortedQueries = remainingQueries
          .filter(q => q.getObserversCount() === 0) // Only remove unobserved queries
          .sort((a, b) => {
            const aTime = a.state.dataUpdatedAt || a.state.errorUpdatedAt || 0;
            const bTime = b.state.dataUpdatedAt || b.state.errorUpdatedAt || 0;
            return aTime - bTime; // Oldest first
          });

        const toRemove = sortedQueries.slice(0, remainingQueries.length - this.MAX_CACHE_ENTRIES);
        for (const query of toRemove) {
          cache.remove(query);
          removedCount++;
        }
      }

      if (removedCount > 0) {
        console.log(`Cache cleanup: removed ${removedCount} stale queries`);
      }
    } catch (error) {
      console.warn('Cache cleanup failed:', error);
    }
  }

  /**
   * Manual cleanup trigger
   */
  cleanup() {
    this.performCleanup();
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const cache = this.queryClient.getQueryCache();
    const queries = cache.getAll();
    
    const stats = {
      totalQueries: queries.length,
      activeQueries: queries.filter(q => q.getObserversCount() > 0).length,
      staleQueries: queries.filter(q => q.isStale()).length,
      errorQueries: queries.filter(q => q.state.status === 'error').length,
    };

    return stats;
  }
}

// Singleton instance
let cacheCleanupManager: CacheCleanupManager | null = null;

export function initializeCacheCleanup(queryClient: QueryClient) {
  if (cacheCleanupManager) {
    cacheCleanupManager.stop();
  }
  
  cacheCleanupManager = new CacheCleanupManager(queryClient);
  cacheCleanupManager.start();
  
  return cacheCleanupManager;
}

export function getCacheCleanupManager() {
  return cacheCleanupManager;
}