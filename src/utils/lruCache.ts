/**
 * LRU Cache implementation for geocaches and logs
 * Provides efficient in-memory caching with automatic eviction
 */

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  accessCount: number;
  lastAccessed: number;
}

export interface CacheStats {
  size: number;
  maxSize: number;
  hitRate: number;
  totalHits: number;
  totalMisses: number;
  oldestEntry: number | null;
  newestEntry: number | null;
}

export class LRUCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private maxSize: number;
  private hits = 0;
  private misses = 0;

  constructor(maxSize: number = 500) {
    this.maxSize = maxSize;
  }

  /**
   * Get an item from the cache
   */
  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) {
      this.misses++;
      return undefined;
    }

    // Update access statistics
    entry.accessCount++;
    entry.lastAccessed = Date.now();
    this.hits++;

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.data;
  }

  /**
   * Set an item in the cache
   */
  set(key: string, data: T): void {
    const now = Date.now();

    // If key exists, update it
    if (this.cache.has(key)) {
      const entry = this.cache.get(key)!;
      entry.data = data;
      entry.timestamp = now;
      entry.lastAccessed = now;
      entry.accessCount++;
      
      // Move to end
      this.cache.delete(key);
      this.cache.set(key, entry);
      return;
    }

    // If at capacity, remove least recently used
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    // Add new entry
    this.cache.set(key, {
      data,
      timestamp: now,
      accessCount: 1,
      lastAccessed: now,
    });
  }

  /**
   * Check if key exists in cache
   */
  has(key: string): boolean {
    return this.cache.has(key);
  }

  /**
   * Delete an item from cache
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all items from cache
   */
  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const entries = Array.from(this.cache.values());
    const timestamps = entries.map(e => e.timestamp);
    
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: this.hits + this.misses > 0 ? this.hits / (this.hits + this.misses) : 0,
      totalHits: this.hits,
      totalMisses: this.misses,
      oldestEntry: timestamps.length > 0 ? Math.min(...timestamps) : null,
      newestEntry: timestamps.length > 0 ? Math.max(...timestamps) : null,
    };
  }

  /**
   * Get all keys in cache (ordered by recency)
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Get all values in cache (ordered by recency)
   */
  values(): T[] {
    return Array.from(this.cache.values()).map(entry => entry.data);
  }

  /**
   * Remove entries older than specified age (in milliseconds)
   */
  evictOld(maxAge: number): number {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > maxAge) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.cache.delete(key));
    return keysToDelete.length;
  }

  /**
   * Get entries that match a predicate
   */
  filter(predicate: (data: T, key: string) => boolean): Array<{ key: string; data: T }> {
    const results: Array<{ key: string; data: T }> = [];
    
    for (const [key, entry] of this.cache.entries()) {
      if (predicate(entry.data, key)) {
        results.push({ key, data: entry.data });
      }
    }
    
    return results;
  }

  /**
   * Update cache size limit
   */
  setMaxSize(newMaxSize: number): void {
    this.maxSize = newMaxSize;
    
    // Evict excess entries if needed
    while (this.cache.size > this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }
  }

  /**
   * Get cache entry with metadata
   */
  getEntry(key: string): CacheEntry<T> | undefined {
    const entry = this.cache.get(key);
    if (entry) {
      entry.accessCount++;
      entry.lastAccessed = Date.now();
      
      // Move to end
      this.cache.delete(key);
      this.cache.set(key, entry);
    }
    return entry;
  }

  /**
   * Batch set multiple entries
   */
  setMany(entries: Array<{ key: string; data: T }>): void {
    entries.forEach(({ key, data }) => {
      this.set(key, data);
    });
  }

  /**
   * Batch get multiple entries
   */
  getMany(keys: string[]): Array<{ key: string; data: T | undefined }> {
    return keys.map(key => ({
      key,
      data: this.get(key),
    }));
  }
}

/**
 * Specialized cache for geocaches with additional methods
 */
export class GeocacheCache extends LRUCache<any> {
  constructor(maxSize: number = 200) {
    super(maxSize);
  }

  /**
   * Get geocaches by author
   */
  getByAuthor(pubkey: string): any[] {
    return this.filter((geocache) => geocache.pubkey === pubkey).map(item => item.data);
  }

  /**
   * Get geocaches within a bounding box
   */
  getInBounds(north: number, south: number, east: number, west: number): any[] {
    return this.filter((geocache) => {
      if (!geocache.lat || !geocache.lon) return false;
      return geocache.lat <= north && 
             geocache.lat >= south && 
             geocache.lon <= east && 
             geocache.lon >= west;
    }).map(item => item.data);
  }

  /**
   * Get geocaches by difficulty range
   */
  getByDifficulty(min: number, max: number): any[] {
    return this.filter((geocache) => {
      const difficulty = geocache.difficulty || 1;
      return difficulty >= min && difficulty <= max;
    }).map(item => item.data);
  }

  /**
   * Update geocache data (merge with existing)
   */
  updateGeocache(key: string, updates: Partial<any>): void {
    const existing = this.get(key);
    if (existing) {
      this.set(key, { ...existing, ...updates });
    }
  }
}

/**
 * Specialized cache for logs with additional methods
 */
export class LogCache extends LRUCache<any[]> {
  constructor(maxSize: number = 300) {
    super(maxSize);
  }

  /**
   * Add a new log to existing logs for a geocache
   */
  addLog(geocacheKey: string, newLog: any): void {
    const existingLogs = this.get(geocacheKey) || [];
    const updatedLogs = [newLog, ...existingLogs];
    this.set(geocacheKey, updatedLogs);
  }

  /**
   * Remove a log from a geocache
   */
  removeLog(geocacheKey: string, logId: string): void {
    const existingLogs = this.get(geocacheKey) || [];
    const filteredLogs = existingLogs.filter(log => log.id !== logId);
    this.set(geocacheKey, filteredLogs);
  }

  /**
   * Get logs by author across all geocaches
   */
  getLogsByAuthor(pubkey: string): any[] {
    const allLogs: any[] = [];
    
    for (const logs of this.values()) {
      const authorLogs = logs.filter(log => log.pubkey === pubkey);
      allLogs.push(...authorLogs);
    }
    
    return allLogs.sort((a, b) => b.created_at - a.created_at);
  }

  /**
   * Get recent logs across all geocaches
   */
  getRecentLogs(limit: number = 20): any[] {
    const allLogs: any[] = [];
    
    for (const logs of this.values()) {
      allLogs.push(...logs);
    }
    
    return allLogs
      .sort((a, b) => b.created_at - a.created_at)
      .slice(0, limit);
  }
}