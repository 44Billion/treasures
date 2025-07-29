import { useState, useEffect } from 'react';
import { useOfflineStore } from '@/shared/stores/useOfflineStore';

export function useOfflineMapData() {
  const offlineStore = useOfflineStore();
  const [offlineData, setOfflineData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const loadOfflineData = async () => {
      setIsLoading(true);
      try {
        // Use the actual method from the store
        const data = offlineStore.offlineGeocaches || [];
        setOfflineData(data);
      } catch (error) {
        console.error('Failed to load offline map data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadOfflineData();
  }, [offlineStore]);

  return { offlineData, isLoading };
}