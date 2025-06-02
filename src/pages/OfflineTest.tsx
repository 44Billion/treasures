import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DesktopHeader } from '@/components/DesktopHeader';
import { offlineStorage } from '@/lib/offlineStorage';
import { useOfflineGeocaches } from '@/hooks/useOfflineGeocaches';
import { useToast } from '@/hooks/useToast';

export default function OfflineTest() {
  const [storageStats, setStorageStats] = useState({
    geocaches: 0,
    events: 0,
    profiles: 0,
  });
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { data: geocaches, isLoading: isLoadingGeocaches } = useOfflineGeocaches({ limit: 5 });

  const refreshStats = async () => {
    try {
      const geocaches = await offlineStorage.getAllGeocaches();
      setStorageStats({
        geocaches: geocaches.length,
        events: 0, // We'll implement this later
        profiles: 0, // We'll implement this later
      });
    } catch (error) {
      console.error('Failed to get storage stats:', error);
    }
  };

  const testOfflineStorage = async () => {
    setIsLoading(true);
    try {
      // Test storing a sample geocache
      const sampleGeocache = {
        id: `test-${Date.now()}`,
        event: {
          id: `test-${Date.now()}`,
          pubkey: 'test-pubkey',
          created_at: Math.floor(Date.now() / 1000),
          kind: 37515,
          content: JSON.stringify({
            name: 'Test Cache',
            description: 'A test geocache for offline storage',
          }),
          tags: [
            ['d', `test-${Date.now()}`],
            ['g', '40.7128,-74.0060'],
            ['difficulty', '2'],
            ['terrain', '1'],
            ['type', 'traditional'],
          ],
          sig: 'test-signature',
        },
        lastUpdated: Date.now(),
        coordinates: [40.7128, -74.0060] as [number, number],
        difficulty: 2,
        terrain: 1,
        type: 'traditional',
      };

      await offlineStorage.storeGeocache(sampleGeocache);
      await refreshStats();
      
      toast({
        title: 'Test successful',
        description: 'Sample geocache stored in offline storage',
      });
    } catch (error) {
      console.error('Test failed:', error);
      toast({
        title: 'Test failed',
        description: 'Failed to store sample geocache',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const clearTestData = async () => {
    try {
      await offlineStorage.clearOldData(0); // Clear all data
      await refreshStats();
      
      toast({
        title: 'Test data cleared',
        description: 'All offline storage has been cleared',
      });
    } catch (error) {
      console.error('Clear failed:', error);
      toast({
        title: 'Clear failed',
        description: 'Failed to clear offline storage',
        variant: 'destructive',
      });
    }
  };

  // Refresh stats on component mount
  useState(() => {
    refreshStats();
  });

  return (
    <div className="min-h-screen bg-muted/30">
      <DesktopHeader />
      
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Offline Storage Test</CardTitle>
              <CardDescription>
                Test and debug offline storage functionality
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold">{storageStats.geocaches}</div>
                  <div className="text-sm text-muted-foreground">Geocaches</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">{storageStats.events}</div>
                  <div className="text-sm text-muted-foreground">Events</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">{storageStats.profiles}</div>
                  <div className="text-sm text-muted-foreground">Profiles</div>
                </div>
              </div>
              
              <div className="flex gap-2">
                <Button onClick={refreshStats} variant="outline" className="flex-1">
                  Refresh Stats
                </Button>
                <Button onClick={testOfflineStorage} disabled={isLoading} className="flex-1">
                  {isLoading ? 'Testing...' : 'Test Storage'}
                </Button>
                <Button onClick={clearTestData} variant="destructive" className="flex-1">
                  Clear All
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Offline Geocaches Hook Test</CardTitle>
              <CardDescription>
                Test the useOfflineGeocaches hook
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingGeocaches ? (
                <div>Loading geocaches...</div>
              ) : geocaches && geocaches.length > 0 ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{geocaches.length} geocaches loaded</Badge>
                  </div>
                  {geocaches.slice(0, 3).map((cache) => (
                    <div key={cache.id} className="p-3 border rounded">
                      <div className="font-medium">{cache.name}</div>
                      <div className="text-sm text-muted-foreground">
                        D{cache.difficulty}/T{cache.terrain} • {cache.type}
                      </div>
                      {cache.distance && (
                        <div className="text-xs text-muted-foreground">
                          Distance: {cache.distance.toFixed(2)}km
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-muted-foreground">No geocaches found</div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}