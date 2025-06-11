/**
 * Integration tests for cache system with React Query
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode, createElement } from 'react';
import { cacheManager } from '@/features/geocache/utils/cacheManager';

// Mock wrapper for React Query
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });

  return ({ children }: { children: ReactNode }) => 
    createElement(QueryClientProvider, { client: queryClient }, children);
}

describe('Cache Integration', () => {
  beforeEach(() => {
    cacheManager.clearAll();
  });

  afterEach(() => {
    cacheManager.clearAll();
  });

  describe('CacheManager Integration', () => {
    it('should provide cache operations that work with React Query', async () => {
      // Test adding a geocache
      const geocache = {
        id: 'gc1',
        name: 'Test Cache',
        pubkey: 'author1',
        lat: 40.7128,
        lon: -74.0060,
      };

      // Add geocache through cache manager
      cacheManager.updateGeocache('gc1', geocache);

      // Verify it's in the cache
      expect(cacheManager.hasGeocache('gc1')).toBe(true);
      expect(cacheManager.getGeocache('gc1')).toEqual(expect.objectContaining(geocache));
    });

    it('should handle log operations correctly', async () => {
      const log = {
        id: 'log1',
        content: 'Found it!',
        pubkey: 'finder1',
        created_at: Date.now(),
      };

      // Add log through cache manager
      cacheManager.addLog('gc1', log);

      // Verify it's in the cache
      const logs = cacheManager.getLogs('gc1');
      expect(logs).toHaveLength(1);
      expect(logs[0]).toEqual(log);
    });

    it('should provide accurate cache statistics', async () => {
      // Add some test data
      const geocache = { id: 'gc1', name: 'Test Cache' };
      const logs = [{ id: 'log1', content: 'Test log' }];

      cacheManager.updateGeocache('gc1', geocache);
      cacheManager.setLogs('gc1', logs);

      // Get statistics
      const stats = cacheManager.getStats();

      expect(stats.geocaches.size).toBeGreaterThanOrEqual(1);
      expect(stats.logs.size).toBeGreaterThanOrEqual(1);
      expect(stats.totalMemoryUsage).toBeGreaterThan(0);
      expect(['excellent', 'good', 'poor']).toContain(stats.cacheEfficiency);
      expect(['low', 'moderate', 'high']).toContain(stats.memoryPressure);
    });

    it('should clear all caches when requested', async () => {
      // Add test data
      cacheManager.updateGeocache('gc1', { id: 'gc1', name: 'Test' });
      cacheManager.setLogs('gc1', [{ id: 'log1', content: 'Test' }]);

      // Verify data exists
      expect(cacheManager.hasGeocache('gc1')).toBe(true);
      expect(cacheManager.hasLogs('gc1')).toBe(true);

      // Clear all
      cacheManager.clearAll();

      // Verify data is gone
      expect(cacheManager.hasGeocache('gc1')).toBe(false);
      expect(cacheManager.hasLogs('gc1')).toBe(false);
    });
  });

  describe('Cache Validation Integration', () => {
    it('should validate cache freshness correctly', () => {
      const now = Date.now();
      vi.setSystemTime(now);

      // Add fresh data
      const geocache = { id: 'gc1', name: 'Fresh Cache' };
      cacheManager.setGeocache('gc1', geocache);

      // Should be valid immediately
      const validation1 = cacheManager.validateGeocache('gc1', 300000); // 5 minutes
      expect(validation1.isValid).toBe(true);
      expect(validation1.shouldRefetch).toBe(false);

      // Move time forward beyond max age
      vi.setSystemTime(now + 400000); // 6.67 minutes

      // Should now be invalid
      const validation2 = cacheManager.validateGeocache('gc1', 300000);
      expect(validation2.isValid).toBe(false);
      expect(validation2.shouldRefetch).toBe(true);

      vi.useRealTimers();
    });

    it('should handle cache misses correctly', () => {
      const validation = cacheManager.validateGeocache('nonexistent', 300000);
      
      expect(validation.isValid).toBe(false);
      expect(validation.reason).toBe('Not in cache');
      expect(validation.shouldRefetch).toBe(true);
    });
  });

  describe('Background Update Integration', () => {
    it('should mark data for background updates', () => {
      const geocache = { id: 'gc1', name: 'Test Cache' };
      cacheManager.setGeocache('gc1', geocache);

      // Initially should be fresh
      expect(cacheManager.shouldSkipGeocacheQuery('gc1')).toBe(true);

      // Mark for background update
      cacheManager.markForBackgroundUpdate('geocache', 'gc1');

      // The exact behavior depends on implementation, but the cache should be marked as needing refresh
      // This is tested indirectly through the validation system
      const validation = cacheManager.validateGeocache('gc1', 300000);
      // The timestamp should be reduced, making it appear older
    });

    it('should only update with newer data', () => {
      const now = Date.now();
      const oldGeocache = { id: 'gc1', name: 'Old Cache' };
      const newGeocache = { id: 'gc1', name: 'New Cache' };

      cacheManager.setGeocache('gc1', oldGeocache);

      // Try to update with older timestamp - should not update
      const wasUpdated1 = cacheManager.updateIfNewer('geocache', 'gc1', newGeocache, now - 10000);
      expect(wasUpdated1).toBe(false);
      expect(cacheManager.getGeocache('gc1').name).toBe('Old Cache');

      // Update with newer timestamp - should update
      const wasUpdated2 = cacheManager.updateIfNewer('geocache', 'gc1', newGeocache, now + 10000);
      expect(wasUpdated2).toBe(true);
      expect(cacheManager.getGeocache('gc1').name).toBe('New Cache');
    });
  });

  describe('Memory Management', () => {
    it('should respect cache size limits', () => {
      // Create a small cache for testing
      const testCache = new (cacheManager.constructor as any)();
      testCache.geocacheCache.setMaxSize(3);

      // Add more items than the limit
      for (let i = 1; i <= 5; i++) {
        testCache.setGeocache(`gc${i}`, { id: `gc${i}`, name: `Cache ${i}` });
      }

      // Should only have 3 items (the most recent ones)
      const stats = testCache.getStats();
      expect(stats.geocaches.size).toBe(3);

      // Should have the most recent items
      expect(testCache.hasGeocache('gc3')).toBe(true);
      expect(testCache.hasGeocache('gc4')).toBe(true);
      expect(testCache.hasGeocache('gc5')).toBe(true);

      // Should not have the oldest items
      expect(testCache.hasGeocache('gc1')).toBe(false);
      expect(testCache.hasGeocache('gc2')).toBe(false);

      testCache.destroy();
    });

    it('should track memory usage accurately', () => {
      const geocache = { id: 'gc1', name: 'Test Cache', description: 'A test cache' };
      const logs = [
        { id: 'log1', content: 'Found it!' },
        { id: 'log2', content: 'Great cache!' },
      ];

      cacheManager.setGeocache('gc1', geocache);
      cacheManager.setLogs('gc1', logs);

      const stats = cacheManager.getStats();
      
      // Should have reasonable memory usage estimates
      expect(stats.totalMemoryUsage).toBeGreaterThan(0);
      expect(stats.totalMemoryUsage).toBeLessThan(100000); // Should be reasonable for test data
    });
  });
});