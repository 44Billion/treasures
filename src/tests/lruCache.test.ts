/**
 * Tests for LRU Cache implementation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LRUCache, GeocacheCache, LogCache } from '@/shared/utils/lruCache';

describe('LRUCache', () => {
  let cache: LRUCache<string>;

  beforeEach(() => {
    cache = new LRUCache<string>(3); // Small cache for testing
  });

  it('should store and retrieve values', () => {
    cache.set('key1', 'value1');
    expect(cache.get('key1')).toBe('value1');
  });

  it('should return undefined for non-existent keys', () => {
    expect(cache.get('nonexistent')).toBeUndefined();
  });

  it('should evict least recently used items when at capacity', () => {
    cache.set('key1', 'value1');
    cache.set('key2', 'value2');
    cache.set('key3', 'value3');
    cache.set('key4', 'value4'); // Should evict key1

    expect(cache.get('key1')).toBeUndefined();
    expect(cache.get('key2')).toBe('value2');
    expect(cache.get('key3')).toBe('value3');
    expect(cache.get('key4')).toBe('value4');
  });

  it('should update access order when getting items', () => {
    cache.set('key1', 'value1');
    cache.set('key2', 'value2');
    cache.set('key3', 'value3');
    
    // Access key1 to make it most recently used
    cache.get('key1');
    
    // Add key4, should evict key2 (least recently used)
    cache.set('key4', 'value4');

    expect(cache.get('key1')).toBe('value1'); // Still there
    expect(cache.get('key2')).toBeUndefined(); // Evicted
    expect(cache.get('key3')).toBe('value3');
    expect(cache.get('key4')).toBe('value4');
  });

  it('should update existing keys without changing size', () => {
    cache.set('key1', 'value1');
    cache.set('key2', 'value2');
    
    const sizeBefore = cache.getStats().size;
    cache.set('key1', 'updated_value1');
    const sizeAfter = cache.getStats().size;

    expect(sizeBefore).toBe(sizeAfter);
    expect(cache.get('key1')).toBe('updated_value1');
  });

  it('should track hit and miss statistics', () => {
    cache.set('key1', 'value1');
    
    cache.get('key1'); // Hit
    cache.get('key2'); // Miss
    cache.get('key1'); // Hit
    cache.get('key3'); // Miss

    const stats = cache.getStats();
    expect(stats.totalHits).toBe(2);
    expect(stats.totalMisses).toBe(2);
    expect(stats.hitRate).toBe(0.5);
  });

  it('should evict old entries', () => {
    const now = Date.now();
    vi.setSystemTime(now);

    cache.set('key1', 'value1');
    
    // Move time forward
    vi.setSystemTime(now + 10000);
    cache.set('key2', 'value2');

    // Evict entries older than 5 seconds
    const evicted = cache.evictOld(5000);
    
    expect(evicted).toBe(1);
    expect(cache.get('key1')).toBeUndefined();
    expect(cache.get('key2')).toBe('value2');

    vi.useRealTimers();
  });

  it('should filter entries by predicate', () => {
    cache.set('user1', 'Alice');
    cache.set('user2', 'Bob');
    cache.set('admin1', 'Charlie');

    const users = cache.filter((value, key) => key.startsWith('user'));
    
    expect(users).toHaveLength(2);
    expect(users.map(u => u.data)).toContain('Alice');
    expect(users.map(u => u.data)).toContain('Bob');
  });

  it('should handle batch operations', () => {
    const entries = [
      { key: 'key1', data: 'value1' },
      { key: 'key2', data: 'value2' },
      { key: 'key3', data: 'value3' },
    ];

    cache.setMany(entries);

    const results = cache.getMany(['key1', 'key2', 'key4']);
    
    expect(results[0].data).toBe('value1');
    expect(results[1].data).toBe('value2');
    expect(results[2].data).toBeUndefined();
  });
});

describe('GeocacheCache', () => {
  let cache: GeocacheCache;

  beforeEach(() => {
    cache = new GeocacheCache(5);
  });

  it('should filter geocaches by author', () => {
    const geocaches = [
      { id: 'gc1', pubkey: 'author1', name: 'Cache 1' },
      { id: 'gc2', pubkey: 'author2', name: 'Cache 2' },
      { id: 'gc3', pubkey: 'author1', name: 'Cache 3' },
    ];

    geocaches.forEach(gc => cache.set(gc.id, gc));

    const author1Caches = cache.getByAuthor('author1');
    expect(author1Caches).toHaveLength(2);
    expect(author1Caches.map(gc => gc.name)).toContain('Cache 1');
    expect(author1Caches.map(gc => gc.name)).toContain('Cache 3');
  });

  it('should filter geocaches by difficulty', () => {
    const geocaches = [
      { id: 'gc1', difficulty: 1, name: 'Easy Cache' },
      { id: 'gc2', difficulty: 3, name: 'Medium Cache' },
      { id: 'gc3', difficulty: 5, name: 'Hard Cache' },
    ];

    geocaches.forEach(gc => cache.set(gc.id, gc));

    const mediumCaches = cache.getByDifficulty(2, 4);
    expect(mediumCaches).toHaveLength(1);
    expect(mediumCaches[0].name).toBe('Medium Cache');
  });

  it('should update geocache data', () => {
    const geocache = { id: 'gc1', name: 'Original Name', difficulty: 1 };
    cache.set('gc1', geocache);

    cache.updateGeocache('gc1', { name: 'Updated Name', difficulty: 2 });

    const updated = cache.get('gc1');
    expect(updated.name).toBe('Updated Name');
    expect(updated.difficulty).toBe(2);
  });
});

describe('LogCache', () => {
  let cache: LogCache;

  beforeEach(() => {
    cache = new LogCache(5);
  });

  it('should add logs to existing entries', () => {
    const initialLogs = [
      { id: 'log1', content: 'First log', created_at: 1000 },
    ];

    cache.set('gc1', initialLogs);

    const newLog = { id: 'log2', content: 'Second log', created_at: 2000 };
    cache.addLog('gc1', newLog);

    const logs = cache.get('gc1');
    expect(logs).toHaveLength(2);
    expect(logs[0]).toEqual(newLog); // Should be first (newest)
  });

  it('should remove specific logs', () => {
    const logs = [
      { id: 'log1', content: 'First log' },
      { id: 'log2', content: 'Second log' },
    ];

    cache.set('gc1', logs);
    cache.removeLog('gc1', 'log1');

    const remainingLogs = cache.get('gc1');
    expect(remainingLogs).toHaveLength(1);
    expect(remainingLogs[0].id).toBe('log2');
  });

  it('should get logs by author across all geocaches', () => {
    cache.set('gc1', [
      { id: 'log1', pubkey: 'user1', content: 'Log 1', created_at: 1000 },
      { id: 'log2', pubkey: 'user2', content: 'Log 2', created_at: 2000 },
    ]);

    cache.set('gc2', [
      { id: 'log3', pubkey: 'user1', content: 'Log 3', created_at: 3000 },
    ]);

    const user1Logs = cache.getLogsByAuthor('user1');
    expect(user1Logs).toHaveLength(2);
    expect(user1Logs[0].id).toBe('log3'); // Newest first
    expect(user1Logs[1].id).toBe('log1');
  });

  it('should get recent logs across all geocaches', () => {
    cache.set('gc1', [
      { id: 'log1', content: 'Old log', created_at: 1000 },
      { id: 'log2', content: 'Recent log', created_at: 3000 },
    ]);

    cache.set('gc2', [
      { id: 'log3', content: 'Newest log', created_at: 4000 },
    ]);

    const recentLogs = cache.getRecentLogs(2);
    expect(recentLogs).toHaveLength(2);
    expect(recentLogs[0].id).toBe('log3'); // Newest first
    expect(recentLogs[1].id).toBe('log2');
  });
});