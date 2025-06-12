/**
 * Performance monitoring dashboard for development
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import { Progress } from '@/shared/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { QueryOptimizer } from '@/shared/stores/performanceMonitor';

interface PerformanceDashboardProps {
  stores?: string[];
  className?: string;
}

export function PerformanceDashboard({ 
  stores = ['geocache', 'log', 'author', 'offline'],
  className 
}: PerformanceDashboardProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Only show in development
  useEffect(() => {
    setIsVisible(process.env.NODE_ENV === 'development');
  }, []);

  if (!isVisible) return null;

  const refresh = () => setRefreshKey(prev => prev + 1);

  return (
    <div className={`fixed bottom-4 right-4 z-50 ${className}`}>
      <Card className="w-96 max-h-96 overflow-auto bg-background/95 backdrop-blur">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Performance Monitor</CardTitle>
            <Button variant="ghost" size="sm" onClick={refresh}>
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="cache">Cache</TabsTrigger>
              <TabsTrigger value="memory">Memory</TabsTrigger>
            </TabsList>
            
            <TabsContent value="overview" className="space-y-2">
              <OverviewTab key={refreshKey} />
            </TabsContent>
            
            <TabsContent value="cache" className="space-y-2">
              <CacheTab key={refreshKey} />
            </TabsContent>
            
            <TabsContent value="memory" className="space-y-2">
              <MemoryTab key={refreshKey} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

function OverviewTab() {
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    // This would collect stats from all stores
    // For now, just show placeholder data
    setStats({
      totalOperations: 156,
      averageDuration: 245,
      successRate: 0.94,
      activeStores: 4,
    });
  }, []);

  if (!stats) return <div>Loading...</div>;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div className="text-center">
          <div className="text-lg font-semibold">{stats.totalOperations}</div>
          <div className="text-xs text-muted-foreground">Operations</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-semibold">{stats.averageDuration}ms</div>
          <div className="text-xs text-muted-foreground">Avg Duration</div>
        </div>
      </div>
      
      <div>
        <div className="flex justify-between text-sm mb-1">
          <span>Success Rate</span>
          <span>{(stats.successRate * 100).toFixed(1)}%</span>
        </div>
        <Progress value={stats.successRate * 100} className="h-2" />
      </div>
      
      <div className="flex justify-between items-center">
        <span className="text-sm">Active Stores</span>
        <Badge variant="secondary">{stats.activeStores}</Badge>
      </div>
    </div>
  );
}

function CacheTab() {
  const [cacheStats, setCacheStats] = useState<any>(null);

  useEffect(() => {
    const stats = QueryOptimizer.getCacheStats();
    setCacheStats(stats);
  }, []);

  if (!cacheStats) return <div>Loading...</div>;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div className="text-center">
          <div className="text-lg font-semibold">{cacheStats.size}</div>
          <div className="text-xs text-muted-foreground">Cached Items</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-semibold">{cacheStats.totalHits}</div>
          <div className="text-xs text-muted-foreground">Total Hits</div>
        </div>
      </div>
      
      <div>
        <div className="flex justify-between text-sm mb-1">
          <span>Hit Rate</span>
          <span>{(cacheStats.hitRate * 100).toFixed(1)}%</span>
        </div>
        <Progress value={cacheStats.hitRate * 100} className="h-2" />
      </div>
      
      <div className="flex justify-between items-center">
        <span className="text-sm">Avg Age</span>
        <span className="text-xs">{Math.round(cacheStats.averageAge / 1000)}s</span>
      </div>
      
      <Button 
        variant="outline" 
        size="sm" 
        className="w-full"
        onClick={() => {
          QueryOptimizer.clearCache();
          window.location.reload();
        }}
      >
        Clear Cache
      </Button>
    </div>
  );
}

function MemoryTab() {
  const [memoryStats, setMemoryStats] = useState<any>(null);

  useEffect(() => {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      setMemoryStats({
        used: memory.usedJSHeapSize,
        total: memory.totalJSHeapSize,
        limit: memory.jsHeapSizeLimit,
        percentage: (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100,
      });
    } else {
      setMemoryStats({ unavailable: true });
    }
  }, []);

  if (!memoryStats) return <div>Loading...</div>;

  if (memoryStats.unavailable) {
    return (
      <div className="text-center text-sm text-muted-foreground">
        Memory stats unavailable in this browser
      </div>
    );
  }

  const formatBytes = (bytes: number) => {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div className="text-center">
          <div className="text-lg font-semibold">{formatBytes(memoryStats.used)}</div>
          <div className="text-xs text-muted-foreground">Used</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-semibold">{formatBytes(memoryStats.limit)}</div>
          <div className="text-xs text-muted-foreground">Limit</div>
        </div>
      </div>
      
      <div>
        <div className="flex justify-between text-sm mb-1">
          <span>Memory Usage</span>
          <span>{memoryStats.percentage.toFixed(1)}%</span>
        </div>
        <Progress 
          value={memoryStats.percentage} 
          className="h-2"
          // Show warning colors for high usage
          style={{
            '--progress-background': memoryStats.percentage > 80 ? '#ef4444' : 
                                   memoryStats.percentage > 60 ? '#f59e0b' : '#10b981'
          } as React.CSSProperties}
        />
      </div>
      
      {memoryStats.percentage > 80 && (
        <div className="text-xs text-red-600 bg-red-50 p-2 rounded">
          High memory usage detected. Consider refreshing the page.
        </div>
      )}
      
      <Button 
        variant="outline" 
        size="sm" 
        className="w-full"
        onClick={() => {
          if (window.gc) {
            window.gc();
          } else {
            console.warn('Garbage collection not available');
          }
        }}
      >
        Force GC
      </Button>
    </div>
  );
}