import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useGeocacheStoreContext } from '@/shared/stores/hooks';
import { useToast } from '@/shared/hooks/useToast';
import type { CreateGeocacheData } from '@/types/geocache';
import type { Geocache } from '@/shared/types';

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
      // Validate data
      if (!data.name?.trim()) {
        throw new Error("Cache name is required");
      }
      if (!data.description?.trim()) {
        throw new Error("Cache description is required");
      }
      if (!data.location || typeof data.location.lat !== 'number' || typeof data.location.lng !== 'number') {
        throw new Error("Valid location coordinates are required");
      }
      if (!data.difficulty || data.difficulty < 1 || data.difficulty > 5) {
        throw new Error("Difficulty must be between 1 and 5");
      }
      if (!data.terrain || data.terrain < 1 || data.terrain > 5) {
        throw new Error("Terrain must be between 1 and 5");
      }

      // Validate size is one of the allowed values
      const validSizes = ["micro", "small", "regular", "large", "other"];
      if (!data.size || !validSizes.includes(data.size)) {
        throw new Error("Size must be one of: micro, small, regular, large, other");
      }

      // Cast data to Partial<Geocache> with proper type assertion
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
        title: "Geocache created!",
        description: "Your geocache has been successfully hidden.",
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
        title: "Failed to create geocache",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });
}