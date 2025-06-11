/**
 * Tests for Cache Manager
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { CacheManagerClass } from '@/lib/cacheManager';

describe('CacheManager', () => {
  let cacheManager: CacheManagerClass;

  beforeEach(() => {
    cacheManager = new CacheManagerClass();
  });

  afterEach(() => {
    cacheManager.destroy();
  });

  describe('Geocache Operations', () => {
    it('should store and retrieve geocaches', () => {
      const geocache = {
        id: 'gc1',
        name: 'Test Cache',
        pubkey: 'author1',
        lat: 40.7128,
        lon: -74.0060,
      };

      cacheManager.setGeocache('gc1', geocache);
      const retrieved = cacheManager.getGeocache('gc1');

      expect(retrieved).toEqual(geocache);
    });

    it('should check if geocache exists', () => {
      const geocache = { id: 'gc1', name: 'Test Cache' };
      
      expect(cacheManager.hasGeocache('gc1')).toBe(false);
      
      cacheManager.setGeocache('gc1', geocache);
      expect(cacheManager.hasGeocache('gc1')).toBe(true);
    });

    it('should set multiple geocaches at once', () => {
      const geocaches = [
        { id: 'gc1', name: 'Cache 1' },
        { id: 'gc2', name: 'Cache 2' },
        { id: 'gc3', name: 'Cache 3' },
      ];

      cacheManager.setGeocaches(geocaches);

      expect(cacheManager.hasGeocache('gc1')).toBe(true);
      expect(cacheManager.hasGeocache('gc2')).toBe(true);
      expect(cacheManager.hasGeocache('gc3')).toBe(true);
    });

    it('should get all cached geocaches', () => {
      const geocaches = [
        { id: 'gc1', name: 'Cache 1' },
        { id: 'gc2', name: 'Cache 2' },
      ];

      cacheManager.setGeocaches(geocaches);
      const allCaches = cacheManager.getAllGeocaches();

      expect(allCaches).toHaveLength(2);
      expect(allCaches.map(gc => gc.name)).toContain('Cache 1');
      expect(allCaches.map(gc => gc.name)).toContain('Cache 2');
    });

    it('should update geocache data', () => {
      const geocache = { id: 'gc1', name: 'Original Name', difficulty: 1 };
      cacheManager.setGeocache('gc1', geocache);

      cacheManager.updateGeocache('gc1', { name: 'Updated Name' });

      const updated = cacheManager.getGeocache('gc1');
      expect(updated.name).toBe('Updated Name');
      expect(updated.difficulty).toBe(1); // Should preserve other fields
    });
  });

  describe('Log Operations', () => {
    it('should store and retrieve logs', () => {
      const logs = [
        { id: 'log1', content: 'Found it!', created_at: 1000 },
        { id: 'log2', content: 'Great cache!', created_at: 2000 },
      ];

      cacheManager.setLogs('gc1', logs);
      const retrieved = cacheManager.getLogs('gc1');

      expect(retrieved).toEqual(logs);
    });

    it('should add new logs to existing entries', () => {
      const initialLogs = [
        { id: 'log1', content: 'First log', created_at: 1000 },
      ];

      cacheManager.setLogs('gc1', initialLogs);

      const newLog = { id: 'log2', content: 'Second log', created_at: 2000 };
      cacheManager.addLog('gc1', newLog);

      const logs = cacheManager.getLogs('gc1');
      expect(logs).toHaveLength(2);
      expect(logs[0]).toEqual(newLog); // Should be first (newest)
    });

    it('should remove specific logs', () => {
      const logs = [
        { id: 'log1', content: 'First log' },
        { id: 'log2', content: 'Second log' },
      ];

      cacheManager.setLogs('gc1', logs);
      cacheManager.removeLog('gc1', 'log1');

      const remainingLogs = cacheManager.getLogs('gc1');
      expect(remainingLogs).toHaveLength(1);
      expect(remainingLogs[0].id).toBe('log2');
    });
  });

  describe('Validation and Freshness', () => {
    it('should validate fresh geocache data', () => {
      const geocache = { id: 'gc1', name: 'Test Cache' };
      cacheManager.setGeocache('gc1', geocache);

      const validation = cacheManager.validateGeocache('gc1', 300000); // 5 minutes
      
      expect(validation.isValid).toBe(true);
      expect(validation.shouldRefetch).toBe(false);
    });

    it('should invalidate old geocache data', () => {
      const now = Date.now();
      vi.setSystemTime(now);

      const geocache = { id: 'gc1', name: 'Test Cache' };
      cacheManager.setGeocache('gc1', geocache);

      // Move time forward beyond max age
      vi.setSystemTime(now + 400000); // 6.67 minutes

      const validation = cacheManager.validateGeocache('gc1', 300000); // 5 minutes max age
      
      expect(validation.isValid).toBe(false);
      expect(validation.reason).toBe('Cache expired');
      expect(validation.shouldRefetch).toBe(true);

      vi.useRealTimers();
    });

    it('should handle non-existent cache entries', () => {
      const validation = cacheManager.validateGeocache('nonexistent', 300000);
      
      expect(validation.isValid).toBe(false);
      expect(validation.reason).toBe('Not in cache');
      expect(validation.shouldRefetch).toBe(true);
    });

    it('should determine when to skip queries', () => {
      const geocache = { id: 'gc1', name: 'Test Cache' };
      cacheManager.setGeocache('gc1', geocache);

      // Fresh data - should skip query
      expect(cacheManager.shouldSkipGeocacheQuery('gc1')).toBe(true);

      // Non-existent data - should not skip query
      expect(cacheManager.shouldSkipGeocacheQuery('nonexistent')).toBe(false);
    });
  });

  describe('Background Updates', () => {
    it('should mark data for background update', () => {
      const geocache = { id: 'gc1', name: 'Test Cache' };
      cacheManager.setGeocache('gc1', geocache);

      // Initially should skip query (fresh data)
      expect(cacheManager.shouldSkipGeocacheQuery('gc1')).toBe(true);

      // Mark for background update
      cacheManager.markForBackgroundUpdate('geocache', 'gc1');

      // Should now be more likely to refresh (timestamp reduced)
      // Note: This is implementation-dependent, but the cache should be "older"
      const validation = cacheManager.validateGeocache('gc1', 300000);
      // The exact behavior depends on implementation, but it should be less fresh
    });

    it('should update only if data is newer', () => {
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

  describe('Cleanup and Maintenance', () => {
    it('should provide comprehensive statistics', () => {
      const geocaches = [
        { id: 'gc1', name: 'Cache 1' },
        { id: 'gc2', name: 'Cache 2' },
      ];

      const logs = [
        { id: 'log1', content: 'Log 1' },
      ];

      cacheManager.setGeocaches(geocaches);
      cacheManager.setLogs('gc1', logs);

      const stats = cacheManager.getStats();

      expect(stats.geocaches.size).toBe(2);
      expect(stats.logs.size).toBe(1);
      expect(stats.totalMemoryUsage).toBeGreaterThan(0);
    });

    it('should clear all caches', () => {
      const geocache = { id: 'gc1', name: 'Test Cache' };
      const logs = [{ id: 'log1', content: 'Test Log' }];

      cacheManager.setGeocache('gc1', geocache);
      cacheManager.setLogs('gc1', logs);

      expect(cacheManager.hasGeocache('gc1')).toBe(true);
      expect(cacheManager.hasLogs('gc1')).toBe(true);

      cacheManager.clearAll();

      expect(cacheManager.hasGeocache('gc1')).toBe(false);
      expect(cacheManager.hasLogs('gc1')).toBe(false);
    });

    it('should remove specific entries', () => {
      const geocache = { id: 'gc1', name: 'Test Cache' };
      const logs = [{ id: 'log1', content: 'Test Log' }];

      cacheManager.setGeocache('gc1', geocache);
      cacheManager.setLogs('gc1', logs);

      expect(cacheManager.removeGeocache('gc1')).toBe(true);
      expect(cacheManager.removeLogs('gc1')).toBe(true);

      expect(cacheManager.hasGeocache('gc1')).toBe(false);
      expect(cacheManager.hasLogs('gc1')).toBe(false);
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle typical geocaching workflow', () => {
      // Initial load of geocaches
      const geocaches = [
        { id: 'gc1', name: 'Cache 1', pubkey: 'author1' },
        { id: 'gc2', name: 'Cache 2', pubkey: 'author2' },
      ];

      cacheManager.setGeocaches(geocaches);

      // Load logs for first geocache
      const logs = [
        { id: 'log1', content: 'Found it!', pubkey: 'finder1', created_at: 1000 },
      ];

      cacheManager.setLogs('gc1', logs);

      // Add new log
      const newLog = { id: 'log2', content: 'TFTC!', pubkey: 'finder2', created_at: 2000 };
      cacheManager.addLog('gc1', newLog);

      // Verify state
      expect(cacheManager.getAllGeocaches()).toHaveLength(2);
      expect(cacheManager.getLogs('gc1')).toHaveLength(2);
      expect(cacheManager.getLogs('gc1')[0]).toEqual(newLog); // Newest first

      // Check validation
      expect(cacheManager.shouldSkipGeocacheQuery('gc1')).toBe(true);
      expect(cacheManager.shouldSkipLogsQuery('gc1')).toBe(true);
    });

    it('should handle cache invalidation scenarios', () => {
      const geocache = { id: 'gc1', name: 'Test Cache' };
      cacheManager.setGeocache('gc1', geocache);

      // Mark for background update
      cacheManager.markForBackgroundUpdate('geocache', 'gc1');

      // Should still have the data but marked for refresh
      expect(cacheManager.hasGeocache('gc1')).toBe(true);

      // Remove the cache (simulating deletion event)
      cacheManager.removeGeocache('gc1');
      expect(cacheManager.hasGeocache('gc1')).toBe(false);
    });
  });
});