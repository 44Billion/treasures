/**
 * Generic hook for async operations with loading and error states
 */

import { useState, useCallback } from 'react';

export interface AsyncOperationState<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
}

export interface AsyncOperationActions<T, P extends any[] = []> {
  execute: (...params: P) => Promise<T | undefined>;
  reset: () => void;
  setData: (data: T | null) => void;
  setError: (error: string | null) => void;
}

export type AsyncOperationResult<T, P extends any[] = []> = 
  AsyncOperationState<T> & AsyncOperationActions<T, P>;

/**
 * Generic hook for async operations
 */
export function useAsyncOperation<T, P extends any[] = []>(
  asyncFunction: (...params: P) => Promise<T>,
  options: {
    initialData?: T | null;
    onSuccess?: (data: T) => void;
    onError?: (error: string) => void;
  } = {}
): AsyncOperationResult<T, P> {
  const { initialData = null, onSuccess, onError } = options;

  const [state, setState] = useState<AsyncOperationState<T>>({
    data: initialData,
    isLoading: false,
    error: null,
  });

  const execute = useCallback(async (...params: P): Promise<T | undefined> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const result = await asyncFunction(...params);
      setState(prev => ({ ...prev, data: result, isLoading: false }));
      onSuccess?.(result);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An error occurred';
      setState(prev => ({ ...prev, error: errorMessage, isLoading: false }));
      onError?.(errorMessage);
      return undefined;
    }
  }, [asyncFunction, onSuccess, onError]);

  const reset = useCallback(() => {
    setState({ data: initialData, isLoading: false, error: null });
  }, [initialData]);

  const setData = useCallback((data: T | null) => {
    setState(prev => ({ ...prev, data }));
  }, []);

  const setError = useCallback((error: string | null) => {
    setState(prev => ({ ...prev, error }));
  }, []);

  return {
    ...state,
    execute,
    reset,
    setData,
    setError,
  };
}

/**
 * Hook for async operations that don't return data (like delete operations)
 */
export function useAsyncAction<P extends any[] = []>(
  asyncFunction: (...params: P) => Promise<void>,
  options: {
    onSuccess?: () => void;
    onError?: (error: string) => void;
  } = {}
) {
  return useAsyncOperation(asyncFunction, options);
}

/**
 * Hook for async operations with automatic retry
 */
export function useAsyncOperationWithRetry<T, P extends any[] = []>(
  asyncFunction: (...params: P) => Promise<T>,
  maxRetries: number = 3,
  retryDelay: number = 1000,
  options: {
    initialData?: T | null;
    onSuccess?: (data: T) => void;
    onError?: (error: string) => void;
  } = {}
) {
  const baseOperation = useAsyncOperation(asyncFunction, options);

  const executeWithRetry = useCallback(async (...params: P): Promise<T | undefined> => {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await baseOperation.execute(...params);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, retryDelay * Math.pow(2, attempt)));
        }
      }
    }
    
    throw lastError;
  }, [baseOperation.execute, maxRetries, retryDelay]);

  return {
    ...baseOperation,
    execute: executeWithRetry,
  };
}