/**
 * Performance monitoring dashboard for debugging
 * Only shows in development mode
 */

import { useState, useEffect } from 'react';
import { performanceMonitor } from '@/lib/performance';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function PerformanceDashboard() {
  const [metrics, setMetrics] = useState(performanceMonitor.getMetrics());
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Only show in development
    if (process.env.NODE_ENV !== 'development') return;

    const interval = setInterval(() => {
      setMetrics(performanceMonitor.getMetrics());
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  // Don't render in production
  if (process.env.NODE_ENV !== 'development') return null;

  const operations = [...new Set(metrics.map(m => m.operation))];

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsVisible(!isVisible)}
        className="mb-2"
      >
        {isVisible ? 'Hide' : 'Show'} Performance
      </Button>
      
      {isVisible && (
        <Card className="w-80 max-h-96 overflow-auto">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Performance Metrics</CardTitle>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => performanceMonitor.logSummary()}
              >
                Log Summary
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  performanceMonitor.clear();
                  setMetrics([]);
                }}
              >
                Clear
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {operations.map(operation => {
              const avgTime = performanceMonitor.getAverageTime(operation);
              const successRate = performanceMonitor.getSuccessRate(operation);
              const count = performanceMonitor.getMetrics(operation).length;
              
              return (
                <div key={operation} className="text-xs">
                  <div className="font-medium">{operation}</div>
                  <div className="text-muted-foreground">
                    {avgTime.toFixed(0)}ms avg • {successRate.toFixed(0)}% success • {count} samples
                  </div>
                </div>
              );
            })}
            
            {operations.length === 0 && (
              <div className="text-xs text-muted-foreground">
                No metrics recorded yet
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}