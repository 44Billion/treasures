/**
 * Performance monitoring utilities for cache operations
 */

interface PerformanceMetric {
  operation: string;
  duration: number;
  timestamp: number;
  success: boolean;
  details?: Record<string, unknown>;
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private maxMetrics = 100; // Keep last 100 metrics

  startTimer(operation: string): (success?: boolean, details?: Record<string, unknown>) => void {
    const startTime = performance.now();
    
    return (success: boolean = true, details?: Record<string, unknown>) => {
      const duration = performance.now() - startTime;
      
      this.addMetric({
        operation,
        duration,
        timestamp: Date.now(),
        success,
        details,
      });
      
      // Log slow operations
      if (duration > 2000) {
        console.warn(`Slow operation detected: ${operation} took ${duration.toFixed(2)}ms`, details);
      }
    };
  }

  private addMetric(metric: PerformanceMetric) {
    this.metrics.push(metric);
    
    // Keep only recent metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }
  }

  getMetrics(operation?: string): PerformanceMetric[] {
    if (operation) {
      return this.metrics.filter(m => m.operation === operation);
    }
    return [...this.metrics];
  }

  getAverageTime(operation: string): number {
    const operationMetrics = this.getMetrics(operation);
    if (operationMetrics.length === 0) return 0;
    
    const total = operationMetrics.reduce((sum, m) => sum + m.duration, 0);
    return total / operationMetrics.length;
  }

  getSuccessRate(operation: string): number {
    const operationMetrics = this.getMetrics(operation);
    if (operationMetrics.length === 0) return 0;
    
    const successful = operationMetrics.filter(m => m.success).length;
    return (successful / operationMetrics.length) * 100;
  }

  logSummary() {
    const operations = [...new Set(this.metrics.map(m => m.operation))];
    
    console.group('Performance Summary');
    operations.forEach(operation => {
      const avgTime = this.getAverageTime(operation);
      const successRate = this.getSuccessRate(operation);
      const count = this.getMetrics(operation).length;
      
      console.log(`${operation}: ${avgTime.toFixed(2)}ms avg, ${successRate.toFixed(1)}% success, ${count} samples`);
    });
    console.groupEnd();
  }

  clear() {
    this.metrics = [];
  }
}

// Singleton instance
export const performanceMonitor = new PerformanceMonitor();

// Convenience functions
export function measureAsync<T>(
  operation: string,
  fn: () => Promise<T>,
  details?: Record<string, unknown>
): Promise<T> {
  const endTimer = performanceMonitor.startTimer(operation);
  
  return fn()
    .then(result => {
      endTimer(true, details);
      return result;
    })
    .catch(error => {
      const errorObj = error as { message?: string };
      endTimer(false, { ...details, error: errorObj.message });
      throw error;
    });
}

export function measureSync<T>(
  operation: string,
  fn: () => T,
  details?: Record<string, unknown>
): T {
  const endTimer = performanceMonitor.startTimer(operation);
  
  try {
    const result = fn();
    endTimer(true, details);
    return result;
  } catch (error) {
    endTimer(false, { ...details, error: (error as Error).message });
    throw error;
  }
}

// Hook for React components to measure render performance
export function usePerformanceTimer(componentName: string) {
  const endTimer = performanceMonitor.startTimer(`render:${componentName}`);
  
  // Call this in useEffect to measure render time
  return () => endTimer(true);
}