import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useGeocacheStoreContext } from '@/stores/hooks';
import { useToast } from '@/hooks/useToast';
import type { CreateGeocacheData } from '@/types/geocache';
import type { Geocache } from '@/types/geocache';

interface CreateGeocacheResult {
  event: any;
  geocache: Geocache;
}

export function useCreateGeocache() {
  const queryClient = useQueryClient();
  const geocacheStore = useGeocacheStoreContext();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: CreateGeocacheData) => {
      // Cast data to Partial<Geocache> with proper type assertion
      // Note: Full validation is handled by the geocache store's mutationFn
      const geocacheData = {
        ...data,
        size: data.size as Geocache['size'],
        type: data.type as Geocache['type'],
      };

      // Use the store's createGeocache method
      const result = await geocacheStore.createGeocache(geocacheData);
      if (!result.success) {
        throw result.error;
      }

      // The result already has the correct structure
      if (!result.data) {
        throw new Error('Failed to create geocache: No data returned');
      }

      return result.data;
    },
    onSuccess: (data: CreateGeocacheResult) => {
      toast({
        title: "Treasure hidden!",
        description: "Your treasure has been successfully hidden.",
      });
      
      // Invalidate related queries to ensure fresh data
      queryClient.invalidateQueries({ queryKey: ['geocaches'] });
      queryClient.invalidateQueries({ queryKey: ['user-geocaches'] });
      if (data?.geocache) {
        queryClient.invalidateQueries({ queryKey: ['geocache', data.geocache.id] });
      }
    },
    onError: (error: unknown) => {
      let errorMessage = "Please try again later.";
      const errorObj = error as { message?: string };
      
      if (errorObj.message) {
        errorMessage = errorObj.message;
      } else if (String(error).includes("timeout")) {
        errorMessage = "Connection timeout. Please check your internet connection.";
      } else if (String(error).includes("User rejected")) {
        errorMessage = "You cancelled the event signing.";
      }
      
      toast({
        title: "Failed to hide treasure",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });
}