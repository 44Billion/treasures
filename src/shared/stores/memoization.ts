/**
 * Advanced memoization utilities for store optimization
 */

import { useMemo, useRef, useCallback } from 'react';

/**
 * Deep equality check for complex objects
 */
function deepEqual(a: any, b: any): boolean {
  if (a === b) return true;
  
  if (a == null || b == null) return a === b;
  
  if (typeof a !== typeof b) return false;
  
  if (typeof a !== 'object') return a === b;
  
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  
  if (Array.isArray(a)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }
  
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  
  if (keysA.length !== keysB.length) return false;
  
  for (const key of keysA) {
    if (!keysB.includes(key)) return false;
    if (!deepEqual(a[key], b[key])) return false;
  }
  
  return true;
}

/**
 * Shallow equality check for objects
 */
function shallowEqual(a: any, b: any): boolean {
  if (a === b) return true;
  
  if (a == null || b == null) return a === b;
  
  if (typeof a !== 'object' || typeof b !== 'object') return a === b;
  
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  
  if (keysA.length !== keysB.length) return false;
  
  for (const key of keysA) {
    if (a[key] !== b[key]) return false;
  }
  
  return true;
}

/**
 * Memoization hook with configurable equality check
 */
export function useMemoizedValue<T>(
  value: T,
  equalityFn: (a: T, b: T) => boolean = shallowEqual
): T {
  const ref = useRef<T>(value);
  
  if (!equalityFn(ref.current, value)) {
    ref.current = value;
  }
  
  return ref.current;
}

/**
 * Deep memoization hook for complex objects
 */
export function useDeepMemo<T>(value: T): T {
  return useMemoizedValue(value, deepEqual);
}

/**
 * Memoized callback with dependency optimization
 */
export function useOptimizedCallback<T extends (...args: any[]) => any>(
  callback: T,
  deps: React.DependencyList
): T {
  const memoizedDeps = useDeepMemo(deps);
  return useCallback(callback, memoizedDeps);
}

/**
 * Memoized selector for extracting data from complex state
 */
export function useSelector<TState, TSelected>(
  state: TState,
  selector: (state: TState) => TSelected,
  equalityFn: (a: TSelected, b: TSelected) => boolean = shallowEqual
): TSelected {
  const selectedValue = useMemo(() => selector(state), [state, selector]);
  return useMemoizedValue(selectedValue, equalityFn);
}

/**
 * LRU Cache implementation for memoization
 */
class LRUCache<K, V> {
  private capacity: number;
  private cache = new Map<K, V>();

  constructor(capacity: number = 100) {
    this.capacity = capacity;
  }

  get(key: K): V | undefined {
    if (this.cache.has(key)) {
      // Move to end (most recently used)
      const value = this.cache.get(key)!;
      this.cache.delete(key);
      this.cache.set(key, value);
      return value;
    }
    return undefined;
  }

  set(key: K, value: V): void {
    if (this.cache.has(key)) {
      // Update existing
      this.cache.delete(key);
    } else if (this.cache.size >= this.capacity) {
      // Remove least recently used (first item)
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    this.cache.set(key, value);
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }

  getStats() {
    return {
      size: this.cache.size,
      capacity: this.capacity,
      utilization: this.cache.size / this.capacity,
    };
  }
}

/**
 * Memoization hook with LRU cache
 */
export function useLRUMemo<TArgs extends readonly unknown[], TReturn>(
  fn: (...args: TArgs) => TReturn,
  capacity: number = 50
): (...args: TArgs) => TReturn {
  const cacheRef = useRef(new LRUCache<string, TReturn>(capacity));
  
  return useCallback((...args: TArgs): TReturn => {
    const key = JSON.stringify(args);
    
    if (cacheRef.current.has(key)) {
      return cacheRef.current.get(key)!;
    }
    
    const result = fn(...args);
    cacheRef.current.set(key, result);
    return result;
  }, [fn, capacity]);
}

/**
 * Memoized computation with automatic invalidation
 */
export function useComputedValue<T, TDeps extends readonly unknown[]>(
  computeFn: () => T,
  deps: TDeps,
  options: {
    equalityFn?: (a: T, b: T) => boolean;
    maxAge?: number; // milliseconds
  } = {}
): T {
  const { equalityFn = shallowEqual, maxAge } = options;
  const cacheRef = useRef<{
    value: T;
    deps: TDeps;
    timestamp: number;
  } | null>(null);

  const memoizedDeps = useDeepMemo(deps);
  
  return useMemo(() => {
    const now = Date.now();
    
    // Check if cache is valid
    if (cacheRef.current) {
      const isDepsSame = deepEqual(cacheRef.current.deps, memoizedDeps);
      const isNotExpired = !maxAge || (now - cacheRef.current.timestamp) < maxAge;
      
      if (isDepsSame && isNotExpired) {
        return cacheRef.current.value;
      }
    }
    
    // Compute new value
    const newValue = computeFn();
    
    // Update cache if value changed
    if (!cacheRef.current || !equalityFn(cacheRef.current.value, newValue)) {
      cacheRef.current = {
        value: newValue,
        deps: memoizedDeps,
        timestamp: now,
      };
    }
    
    return newValue;
  }, [computeFn, memoizedDeps, equalityFn, maxAge]);
}

/**
 * Batch memoization for multiple values
 */
export function useBatchMemo<T extends Record<string, any>>(
  values: T,
  equalityFn: (a: any, b: any) => boolean = shallowEqual
): T {
  const refs = useRef<Partial<T>>({});
  
  return useMemo(() => {
    const result = {} as T;
    let hasChanges = false;
    
    for (const [key, value] of Object.entries(values)) {
      if (!equalityFn(refs.current[key], value)) {
        refs.current[key] = value;
        hasChanges = true;
      }
      result[key] = refs.current[key];
    }
    
    return hasChanges ? result : refs.current as T;
  }, [values, equalityFn]);
}

/**
 * Memoized array operations
 */
export function useMemoizedArray<T>(
  array: T[],
  keyFn: (item: T) => string | number = (item, index) => index
): T[] {
  const keysRef = useRef<(string | number)[]>([]);
  const itemsRef = useRef<T[]>([]);
  
  return useMemo(() => {
    const newKeys = array.map(keyFn);
    
    // Check if keys changed
    if (newKeys.length !== keysRef.current.length || 
        !newKeys.every((key, index) => key === keysRef.current[index])) {
      keysRef.current = newKeys;
      itemsRef.current = [...array];
    }
    
    return itemsRef.current;
  }, [array, keyFn]);
}

/**
 * Stable reference hook for objects
 */
export function useStableReference<T extends object>(obj: T): T {
  const ref = useRef<T>(obj);
  
  if (!shallowEqual(ref.current, obj)) {
    ref.current = obj;
  }
  
  return ref.current;
}

/**
 * Memoization utilities export
 */
export const MemoUtils = {
  deepEqual,
  shallowEqual,
  LRUCache,
};