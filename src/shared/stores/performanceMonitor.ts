/**
 * Performance monitoring utilities for stores
 */

import { useCallback, useRef, useEffect } from 'react';

export interface PerformanceMetrics {
  operationName: string;
  duration: number;
  timestamp: Date;
  success: boolean;
  cacheHit?: boolean;
  dataSize?: number;
}

export interface PerformanceStats {
  totalOperations: number;
  averageDuration: number;
  successRate: number;
  cacheHitRate: number;
  slowOperations: PerformanceMetrics[];
  recentMetrics: PerformanceMetrics[];
}

/**
 * Performance monitor hook for tracking store operations
 */
export function usePerformanceMonitor(storeName: string) {
  const metricsRef = useRef<PerformanceMetrics[]>([]);
  const maxMetrics = 1000; // Keep last 1000 operations
  const slowThreshold = 2000; // Operations slower than 2s

  const recordMetric = useCallback((metric: PerformanceMetrics) => {
    metricsRef.current.push(metric);
    
    // Keep only recent metrics
    if (metricsRef.current.length > maxMetrics) {
      metricsRef.current = metricsRef.current.slice(-maxMetrics);
    }

    // Log slow operations in development
    if (process.env.NODE_ENV === 'development' && metric.duration > slowThreshold) {
      console.warn(`[${storeName}] Slow operation detected:`, {
        operation: metric.operationName,
        duration: `${metric.duration}ms`,
        success: metric.success,
      });
    }
  }, [storeName, slowThreshold]);

  const measureOperation = useCallback(<T>(
    operationName: string,
    operation: () => Promise<T>,
    options: { cacheHit?: boolean; dataSize?: number } = {}
  ): Promise<T> => {
    const startTime = performance.now();
    
    return operation()
      .then((result) => {
        const duration = performance.now() - startTime;
        recordMetric({
          operationName,
          duration,
          timestamp: new Date(),
          success: true,
          cacheHit: options.cacheHit,
          dataSize: options.dataSize,
        });
        return result;
      })
      .catch((error) => {
        const duration = performance.now() - startTime;
        recordMetric({
          operationName,
          duration,
          timestamp: new Date(),
          success: false,
          cacheHit: options.cacheHit,
          dataSize: options.dataSize,
        });
        throw error;
      });
  }, [recordMetric]);

  const getStats = useCallback((): PerformanceStats => {
    const metrics = metricsRef.current;
    const recentMetrics = metrics.slice(-100); // Last 100 operations
    
    if (metrics.length === 0) {
      return {
        totalOperations: 0,
        averageDuration: 0,
        successRate: 0,
        cacheHitRate: 0,
        slowOperations: [],
        recentMetrics: [],
      };
    }

    const totalDuration = metrics.reduce((sum, m) => sum + m.duration, 0);
    const successCount = metrics.filter(m => m.success).length;
    const cacheHitCount = metrics.filter(m => m.cacheHit).length;
    const cacheableOperations = metrics.filter(m => m.cacheHit !== undefined).length;
    const slowOperations = metrics.filter(m => m.duration > slowThreshold);

    return {
      totalOperations: metrics.length,
      averageDuration: totalDuration / metrics.length,
      successRate: successCount / metrics.length,
      cacheHitRate: cacheableOperations > 0 ? cacheHitCount / cacheableOperations : 0,
      slowOperations: slowOperations.slice(-10), // Last 10 slow operations
      recentMetrics,
    };
  }, [slowThreshold]);

  const clearMetrics = useCallback(() => {
    metricsRef.current = [];
  }, []);

  return {
    measureOperation,
    recordMetric,
    getStats,
    clearMetrics,
  };
}

/**
 * Memory usage monitoring
 */
export function useMemoryMonitor() {
  const getMemoryUsage = useCallback(() => {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      return {
        used: memory.usedJSHeapSize,
        total: memory.totalJSHeapSize,
        limit: memory.jsHeapSizeLimit,
        percentage: (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100,
      };
    }
    return null;
  }, []);

  const checkMemoryPressure = useCallback(() => {
    const usage = getMemoryUsage();
    if (usage && usage.percentage > 80) {
      console.warn('High memory usage detected:', usage);
      return true;
    }
    return false;
  }, [getMemoryUsage]);

  return {
    getMemoryUsage,
    checkMemoryPressure,
  };
}

/**
 * Query performance optimization utilities
 */
export class QueryOptimizer {
  private static queryCache = new Map<string, { data: any; timestamp: number; hits: number }>();
  private static maxCacheSize = 100;
  private static cacheTimeout = 30000; // 30 seconds

  static getCachedResult<T>(key: string): T | null {
    const cached = this.queryCache.get(key);
    if (!cached) return null;

    if (Date.now() - cached.timestamp > this.cacheTimeout) {
      this.queryCache.delete(key);
      return null;
    }

    cached.hits++;
    return cached.data;
  }

  static setCachedResult<T>(key: string, data: T): void {
    // Clean up old entries if cache is full
    if (this.queryCache.size >= this.maxCacheSize) {
      const oldestKey = Array.from(this.queryCache.entries())
        .sort(([, a], [, b]) => a.timestamp - b.timestamp)[0][0];
      this.queryCache.delete(oldestKey);
    }

    this.queryCache.set(key, {
      data,
      timestamp: Date.now(),
      hits: 0,
    });
  }

  static getCacheStats() {
    const entries = Array.from(this.queryCache.values());
    const totalHits = entries.reduce((sum, entry) => sum + entry.hits, 0);
    const avgAge = entries.length > 0 
      ? entries.reduce((sum, entry) => sum + (Date.now() - entry.timestamp), 0) / entries.length
      : 0;

    return {
      size: this.queryCache.size,
      totalHits,
      averageAge: avgAge,
      hitRate: totalHits / Math.max(1, entries.length),
    };
  }

  static clearCache(): void {
    this.queryCache.clear();
  }
}

/**
 * Debounced operation utility
 */
export function useDebounce<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const timeoutRef = useRef<NodeJS.Timeout>();

  const debouncedCallback = useCallback((...args: Parameters<T>) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      callback(...args);
    }, delay);
  }, [callback, delay]) as T;

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return debouncedCallback;
}

/**
 * Throttled operation utility
 */
export function useThrottle<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T {
  const lastCallRef = useRef<number>(0);

  const throttledCallback = useCallback((...args: Parameters<T>) => {
    const now = Date.now();
    if (now - lastCallRef.current >= delay) {
      lastCallRef.current = now;
      callback(...args);
    }
  }, [callback, delay]) as T;

  return throttledCallback;
}