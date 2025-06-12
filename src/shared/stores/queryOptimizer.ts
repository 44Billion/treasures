/**
 * Query pattern optimization utilities
 */

import { useCallback, useRef, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useMemoizedValue } from './memoization';
import { useDebounce } from './performanceMonitor';

export interface QueryPattern {
  key: string;
  frequency: number;
  lastUsed: Date;
  averageDuration: number;
  successRate: number;
  dataSize: number;
}

export interface OptimizationStrategy {
  prefetch: boolean;
  cache: boolean;
  batch: boolean;
  priority: 'low' | 'medium' | 'high';
}

/**
 * Query pattern analyzer and optimizer
 */
export class QueryPatternAnalyzer {
  public patterns = new Map<string, QueryPattern>();
  private maxPatterns = 500;

  recordQuery(
    key: string, 
    duration: number, 
    success: boolean, 
    dataSize: number = 0
  ): void {
    const existing = this.patterns.get(key);
    
    if (existing) {
      // Update existing pattern
      existing.frequency++;
      existing.lastUsed = new Date();
      existing.averageDuration = (existing.averageDuration + duration) / 2;
      existing.successRate = (existing.successRate + (success ? 1 : 0)) / 2;
      existing.dataSize = Math.max(existing.dataSize, dataSize);
    } else {
      // Create new pattern
      this.patterns.set(key, {
        key,
        frequency: 1,
        lastUsed: new Date(),
        averageDuration: duration,
        successRate: success ? 1 : 0,
        dataSize,
      });
    }

    // Clean up old patterns if we exceed the limit
    if (this.patterns.size > this.maxPatterns) {
      this.cleanup();
    }
  }

  getOptimizationStrategy(key: string): OptimizationStrategy {
    const pattern = this.patterns.get(key);
    
    if (!pattern) {
      return {
        prefetch: false,
        cache: true,
        batch: false,
        priority: 'medium',
      };
    }

    // High frequency queries should be prefetched and cached
    const isHighFrequency = pattern.frequency > 10;
    const isRecent = Date.now() - pattern.lastUsed.getTime() < 300000; // 5 minutes
    const isFast = pattern.averageDuration < 1000; // Under 1 second
    const isReliable = pattern.successRate > 0.9;

    return {
      prefetch: isHighFrequency && isRecent && isFast && isReliable,
      cache: pattern.successRate > 0.7, // Cache if reasonably reliable
      batch: pattern.dataSize > 1000, // Batch large data sets
      priority: isHighFrequency && isRecent ? 'high' : 
                isHighFrequency ? 'medium' : 'low',
    };
  }

  getTopPatterns(limit: number = 10): QueryPattern[] {
    return Array.from(this.patterns.values())
      .sort((a, b) => {
        // Sort by frequency and recency
        const scoreA = a.frequency * (1 / (Date.now() - a.lastUsed.getTime()));
        const scoreB = b.frequency * (1 / (Date.now() - b.lastUsed.getTime()));
        return scoreB - scoreA;
      })
      .slice(0, limit);
  }

  private cleanup(): void {
    // Remove least used patterns
    const patterns = Array.from(this.patterns.entries())
      .sort(([, a], [, b]) => a.lastUsed.getTime() - b.lastUsed.getTime());
    
    const toRemove = patterns.slice(0, Math.floor(this.maxPatterns * 0.2));
    toRemove.forEach(([key]) => this.patterns.delete(key));
  }

  getStats() {
    const patterns = Array.from(this.patterns.values());
    
    return {
      totalPatterns: patterns.length,
      averageFrequency: patterns.reduce((sum, p) => sum + p.frequency, 0) / patterns.length,
      averageDuration: patterns.reduce((sum, p) => sum + p.averageDuration, 0) / patterns.length,
      averageSuccessRate: patterns.reduce((sum, p) => sum + p.successRate, 0) / patterns.length,
    };
  }
}

// Global analyzer instance
const globalAnalyzer = new QueryPatternAnalyzer();

/**
 * Hook for optimized query execution with pattern analysis
 */
export function useOptimizedQuery<T>(
  queryKey: unknown[],
  queryFn: () => Promise<T>,
  options: {
    enabled?: boolean;
    staleTime?: number;
    cacheTime?: number;
    refetchInterval?: number | false;
  } = {}
) {
  const queryClient = useQueryClient();
  const keyString = JSON.stringify(queryKey);
  const strategy = globalAnalyzer.getOptimizationStrategy(keyString);
  
  // Memoize options to prevent unnecessary re-renders
  const memoizedOptions = useMemoizedValue({
    ...options,
    staleTime: strategy.cache ? (options.staleTime || 300000) : 0, // 5 minutes if cacheable
    cacheTime: strategy.cache ? (options.cacheTime || 600000) : 0, // 10 minutes if cacheable
  });

  // Enhanced query function with pattern recording
  const enhancedQueryFn = useCallback(async () => {
    const startTime = performance.now();
    let success = false;
    let result: T | null = null;
    
    try {
      result = await queryFn();
      success = true;
      return result;
    } finally {
      const duration = performance.now() - startTime;
      const dataSize = result ? JSON.stringify(result).length : 0;
      globalAnalyzer.recordQuery(keyString, duration, success, dataSize);
    }
  }, [queryFn, keyString]);

  // Prefetch if strategy suggests it
  useEffect(() => {
    if (strategy.prefetch && memoizedOptions.enabled !== false) {
      const prefetchKey = [...queryKey, 'prefetch'];
      queryClient.prefetchQuery({
        queryKey: prefetchKey,
        queryFn: enhancedQueryFn,
        staleTime: memoizedOptions.staleTime,
      });
    }
  }, [strategy.prefetch, queryKey, enhancedQueryFn, queryClient, memoizedOptions]);

  return {
    queryKey,
    queryFn: enhancedQueryFn,
    ...memoizedOptions,
    meta: {
      strategy,
      pattern: globalAnalyzer.patterns.get(keyString),
    },
  };
}

/**
 * Hook for batch query optimization
 */
export function useBatchQueryOptimizer() {
  const queryClient = useQueryClient();
  const batchQueueRef = useRef<Map<string, {
    queries: Array<{ key: unknown[]; fn: () => Promise<any> }>;
    timeout: NodeJS.Timeout;
  }>>(new Map());

  const debouncedExecuteBatch = useDebounce((batchKey: string) => {
    const batch = batchQueueRef.current.get(batchKey);
    if (!batch) return;

    // Execute all queries in the batch concurrently
    Promise.allSettled(
      batch.queries.map(async ({ key, fn }) => {
        try {
          const result = await fn();
          queryClient.setQueryData(key, result);
        } catch (error) {
          console.error('Batch query failed:', error);
        }
      })
    );

    batchQueueRef.current.delete(batchKey);
  }, 100);

  const addToBatch = useCallback((
    batchKey: string,
    queryKey: unknown[],
    queryFn: () => Promise<any>
  ) => {
    const existing = batchQueueRef.current.get(batchKey);
    
    if (existing) {
      existing.queries.push({ key: queryKey, fn: queryFn });
      clearTimeout(existing.timeout);
    } else {
      batchQueueRef.current.set(batchKey, {
        queries: [{ key: queryKey, fn: queryFn }],
        timeout: setTimeout(() => debouncedExecuteBatch(batchKey), 100),
      });
    }

    debouncedExecuteBatch(batchKey);
  }, [debouncedExecuteBatch]);

  return { addToBatch };
}

/**
 * Hook for intelligent prefetching based on user behavior
 */
export function useIntelligentPrefetch() {
  const userActionsRef = useRef<string[]>([]);
  const maxActions = 50;

  const recordAction = useCallback((action: string) => {
    userActionsRef.current.push(action);
    
    if (userActionsRef.current.length > maxActions) {
      userActionsRef.current = userActionsRef.current.slice(-maxActions);
    }

    // Analyze patterns and prefetch likely next queries
    const recentActions = userActionsRef.current.slice(-5);
    const patterns = findActionPatterns(recentActions);
    
    patterns.forEach(pattern => {
      if (pattern.confidence > 0.7) {
        // Prefetch the likely next query
        prefetchForAction(pattern.nextAction);
      }
    });
  }, []);

  const prefetchForAction = useCallback((action: string) => {
    // This would map actions to specific queries to prefetch
    // For example: 'view-geocache' -> prefetch logs for that geocache
    const prefetchMap: Record<string, () => void> = {
      'view-geocache-list': () => {
        // Prefetch first few geocache details
      },
      'open-geocache-detail': () => {
        // Prefetch logs and author info
      },
      'view-map': () => {
        // Prefetch nearby geocaches
      },
    };

    const prefetchFn = prefetchMap[action];
    if (prefetchFn) {
      prefetchFn();
    }
  }, []);

  return { recordAction };
}

function findActionPatterns(actions: string[]): Array<{
  pattern: string[];
  nextAction: string;
  confidence: number;
}> {
  // Simple pattern detection - in a real implementation this would be more sophisticated
  const patterns: Array<{ pattern: string[]; nextAction: string; confidence: number }> = [];
  
  for (let i = 0; i < actions.length - 2; i++) {
    const pattern = actions.slice(i, i + 2);
    const nextAction = actions[i + 2] || '';
    
    // Calculate confidence based on how often this pattern occurs
    let occurrences = 0;
    for (let j = 0; j < actions.length - 2; j++) {
      const testPattern = actions.slice(j, j + 2);
      if (JSON.stringify(testPattern) === JSON.stringify(pattern)) {
        occurrences++;
      }
    }
    
    const confidence = Math.min(occurrences / 10, 1); // Max confidence of 1
    
    if (confidence > 0.3) {
      patterns.push({ pattern, nextAction, confidence });
    }
  }
  
  return patterns;
}

export { globalAnalyzer as queryPatternAnalyzer };