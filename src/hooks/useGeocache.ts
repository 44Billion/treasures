import { useQuery } from '@tanstack/react-query';
import { useGeocacheStoreContext } from '@/stores/hooks';

export function useGeocache(id: string) {
  const geocacheStore = useGeocacheStoreContext();

  return useQuery({
    queryKey: ['geocache', id],
    queryFn: async () => {
      if (!id) return null;

      try {
        const result = await geocacheStore.fetchGeocache(id);
        if (!result.success) {
          throw result.error;
        }
        return result.data;
      } catch (error) {
        console.warn('Geocache query failed:', error);
        throw error;
      }
    },
    enabled: !!id,
    staleTime: 30000,
    gcTime: 300000,
    retry: false,
    refetchOnReconnect: true,
    networkMode: 'always',
  });
}