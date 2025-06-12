/**
 * Performance optimization tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { 
  usePerformanceMonitor, 
  useMemoryMonitor,
  QueryOptimizer 
} from '@/shared/stores/performanceMonitor';
import { 
  useMemoizedValue, 
  useOptimizedCallback,
  useLRUMemo,
  MemoUtils 
} from '@/shared/stores/memoization';
import { useBackgroundSyncScheduler } from '@/shared/stores/backgroundSync';
import { 
  QueryPatternAnalyzer,
  useOptimizedQuery 
} from '@/shared/stores/queryOptimizer';

// Test wrapper with QueryClient
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}

describe('Performance Monitoring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should track operation metrics', async () => {
    const { result } = renderHook(() => usePerformanceMonitor('test-store'));

    const mockOperation = vi.fn().mockResolvedValue('test-result');
    
    await act(async () => {
      await result.current.measureOperation('test-operation', mockOperation);
    });

    const stats = result.current.getStats();
    expect(stats.totalOperations).toBe(1);
    expect(stats.successRate).toBe(1);
    expect(mockOperation).toHaveBeenCalledOnce();
  });

  it('should record failed operations', async () => {
    const { result } = renderHook(() => usePerformanceMonitor('test-store'));

    const mockOperation = vi.fn().mockRejectedValue(new Error('Test error'));
    
    await act(async () => {
      try {
        await result.current.measureOperation('test-operation', mockOperation);
      } catch (error) {
        // Expected to fail
      }
    });

    const stats = result.current.getStats();
    expect(stats.totalOperations).toBe(1);
    expect(stats.successRate).toBe(0);
  });

  it('should clear metrics', () => {
    const { result } = renderHook(() => usePerformanceMonitor('test-store'));

    act(() => {
      result.current.recordMetric({
        operationName: 'test',
        duration: 100,
        timestamp: new Date(),
        success: true,
      });
    });

    let stats = result.current.getStats();
    expect(stats.totalOperations).toBe(1);

    act(() => {
      result.current.clearMetrics();
    });

    stats = result.current.getStats();
    expect(stats.totalOperations).toBe(0);
  });
});

describe('Memory Monitoring', () => {
  it('should provide memory usage when available', () => {
    const { result } = renderHook(() => useMemoryMonitor());

    const usage = result.current.getMemoryUsage();
    
    // Memory API might not be available in test environment
    if (usage) {
      expect(typeof usage.used).toBe('number');
      expect(typeof usage.total).toBe('number');
      expect(typeof usage.limit).toBe('number');
      expect(typeof usage.percentage).toBe('number');
    } else {
      expect(usage).toBeNull();
    }
  });

  it('should check memory pressure', () => {
    const { result } = renderHook(() => useMemoryMonitor());

    const hasPressure = result.current.checkMemoryPressure();
    expect(typeof hasPressure).toBe('boolean');
  });
});

describe('Query Optimizer', () => {
  beforeEach(() => {
    QueryOptimizer.clearCache();
  });

  afterEach(() => {
    QueryOptimizer.clearCache();
  });

  it('should cache and retrieve results', () => {
    const testData = { id: 1, name: 'test' };
    
    QueryOptimizer.setCachedResult('test-key', testData);
    const cached = QueryOptimizer.getCachedResult('test-key');
    
    expect(cached).toEqual(testData);
  });

  it('should return null for non-existent keys', () => {
    const cached = QueryOptimizer.getCachedResult('non-existent');
    expect(cached).toBeNull();
  });

  it('should provide cache statistics', () => {
    QueryOptimizer.setCachedResult('key1', 'value1');
    QueryOptimizer.setCachedResult('key2', 'value2');
    
    const stats = QueryOptimizer.getCacheStats();
    expect(stats.size).toBe(2);
    expect(typeof stats.totalHits).toBe('number');
    expect(typeof stats.averageAge).toBe('number');
    expect(typeof stats.hitRate).toBe('number');
  });

  it('should clear cache', () => {
    QueryOptimizer.setCachedResult('test-key', 'test-value');
    expect(QueryOptimizer.getCacheStats().size).toBe(1);
    
    QueryOptimizer.clearCache();
    expect(QueryOptimizer.getCacheStats().size).toBe(0);
  });
});

describe('Memoization Utilities', () => {
  it('should memoize values with shallow equality', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useMemoizedValue(value),
      { initialProps: { value: { a: 1, b: 2 } } }
    );

    const firstResult = result.current;
    
    // Same object reference should return same memoized value
    rerender({ value: { a: 1, b: 2 } });
    expect(result.current).toBe(firstResult);
    
    // Different values should return new memoized value
    rerender({ value: { a: 2, b: 2 } });
    expect(result.current).not.toBe(firstResult);
  });

  it('should optimize callbacks', () => {
    const mockFn = vi.fn();
    const { result, rerender } = renderHook(
      ({ deps }) => useOptimizedCallback(() => mockFn(), deps),
      { initialProps: { deps: [1, 2] } }
    );

    const firstCallback = result.current;
    
    // Same dependencies should return same callback
    rerender({ deps: [1, 2] });
    expect(result.current).toBe(firstCallback);
    
    // Different dependencies should return new callback
    rerender({ deps: [1, 3] });
    expect(result.current).not.toBe(firstCallback);
  });

  it('should provide LRU memoization', () => {
    const expensiveFunction = vi.fn((x: number) => x * 2);
    
    const { result } = renderHook(() => 
      useLRUMemo(expensiveFunction, 2) // Capacity of 2
    );

    // First calls should execute function
    expect(result.current(1)).toBe(2);
    expect(result.current(2)).toBe(4);
    expect(expensiveFunction).toHaveBeenCalledTimes(2);

    // Cached calls should not execute function
    expect(result.current(1)).toBe(2);
    expect(expensiveFunction).toHaveBeenCalledTimes(2);

    // Exceeding capacity should evict oldest
    expect(result.current(3)).toBe(6);
    expect(expensiveFunction).toHaveBeenCalledTimes(3);
    
    // This should be cached since 1 was accessed recently
    expect(result.current(1)).toBe(2);
    expect(expensiveFunction).toHaveBeenCalledTimes(3);
  });

  it('should provide utility functions', () => {
    expect(MemoUtils.shallowEqual({ a: 1 }, { a: 1 })).toBe(true);
    expect(MemoUtils.shallowEqual({ a: 1 }, { a: 2 })).toBe(false);
    
    expect(MemoUtils.deepEqual({ a: { b: 1 } }, { a: { b: 1 } })).toBe(true);
    expect(MemoUtils.deepEqual({ a: { b: 1 } }, { a: { b: 2 } })).toBe(false);
  });
});

describe('Background Sync Scheduler', () => {
  it('should add and manage sync tasks', () => {
    const { result } = renderHook(() => useBackgroundSyncScheduler());

    const mockSyncFn = vi.fn().mockResolvedValue(undefined);
    
    act(() => {
      const taskId = result.current.addTask({
        name: 'test-sync',
        priority: 'medium',
        interval: 1000,
        maxRetries: 3,
        execute: mockSyncFn,
      });
      
      expect(typeof taskId).toBe('string');
    });

    const tasks = result.current.getTasks();
    expect(tasks).toHaveLength(1);
    expect(tasks[0].name).toBe('test-sync');
  });

  it('should remove sync tasks', () => {
    const { result } = renderHook(() => useBackgroundSyncScheduler());

    const mockSyncFn = vi.fn().mockResolvedValue(undefined);
    
    let taskId: string;
    act(() => {
      taskId = result.current.addTask({
        name: 'test-sync',
        priority: 'medium',
        interval: 1000,
        maxRetries: 3,
        execute: mockSyncFn,
      });
    });

    expect(result.current.getTasks()).toHaveLength(1);

    act(() => {
      result.current.removeTask(taskId);
    });

    expect(result.current.getTasks()).toHaveLength(0);
  });

  it('should provide sync status', () => {
    const { result } = renderHook(() => useBackgroundSyncScheduler());

    const status = result.current.getStatus();
    expect(typeof status.isRunning).toBe('boolean');
    expect(Array.isArray(status.activeTasks)).toBe(true);
    expect(typeof status.completedTasks).toBe('number');
    expect(typeof status.failedTasks).toBe('number');
  });
});

describe('Query Pattern Analyzer', () => {
  let analyzer: QueryPatternAnalyzer;

  beforeEach(() => {
    analyzer = new QueryPatternAnalyzer();
  });

  it('should record query patterns', () => {
    analyzer.recordQuery('test-query', 100, true, 1000);
    
    const strategy = analyzer.getOptimizationStrategy('test-query');
    expect(strategy.cache).toBe(true);
    expect(strategy.priority).toBe('low'); // Low frequency initially
  });

  it('should suggest prefetching for high-frequency queries', () => {
    // Record multiple successful, fast queries
    for (let i = 0; i < 15; i++) {
      analyzer.recordQuery('frequent-query', 50, true, 100);
    }
    
    const strategy = analyzer.getOptimizationStrategy('frequent-query');
    expect(strategy.prefetch).toBe(true);
    expect(strategy.priority).toBe('high');
  });

  it('should provide pattern statistics', () => {
    analyzer.recordQuery('query1', 100, true, 500);
    analyzer.recordQuery('query2', 200, false, 1000);
    
    const stats = analyzer.getStats();
    expect(stats.totalPatterns).toBe(2);
    expect(typeof stats.averageFrequency).toBe('number');
    expect(typeof stats.averageDuration).toBe('number');
    expect(typeof stats.averageSuccessRate).toBe('number');
  });

  it('should return top patterns', () => {
    analyzer.recordQuery('query1', 100, true, 500);
    analyzer.recordQuery('query2', 200, true, 1000);
    analyzer.recordQuery('query1', 150, true, 600); // Make query1 more frequent
    
    const topPatterns = analyzer.getTopPatterns(1);
    expect(topPatterns).toHaveLength(1);
    expect(topPatterns[0].key).toBe('query1');
    expect(topPatterns[0].frequency).toBe(2);
  });
});

describe('Optimized Query Hook', () => {
  it('should enhance query with pattern analysis', () => {
    const wrapper = createWrapper();
    const mockQueryFn = vi.fn().mockResolvedValue('test-data');
    
    const { result } = renderHook(
      () => useOptimizedQuery(['test-query'], mockQueryFn),
      { wrapper }
    );

    expect(result.current.queryKey).toEqual(['test-query']);
    expect(typeof result.current.queryFn).toBe('function');
    expect(result.current.meta).toBeDefined();
    expect(result.current.meta.strategy).toBeDefined();
  });
});