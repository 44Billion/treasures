import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useGeocacheStoreContext } from '@/shared/stores/hooks';
import { useToast } from '@/shared/hooks/useToast';
import { offlineStorage } from '@/features/offline/utils/offlineStorage';
import type { NostrEvent } from '@nostrify/nostrify';

interface DeleteGeocacheParams {
  geocacheId: string;
  geocacheEvent?: NostrEvent;
  reason?: string;
}

export function useDeleteGeocache() {
  const queryClient = useQueryClient();
  const geocacheStore = useGeocacheStoreContext();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ geocacheId }: DeleteGeocacheParams) => {
      // Optimistically remove from local storage immediately
      try {
        await offlineStorage.removeGeocache(geocacheId);
        await offlineStorage.removeEvent(geocacheId);
      } catch (error) {
        console.warn('Failed to remove from offline storage:', error);
      }

      // Use the store's deleteGeocache method
      const result = await geocacheStore.deleteGeocache(geocacheId);
      if (!result.success) {
        throw result.error;
      }

      return result.data;
    },
    onMutate: async ({ geocacheId }) => {
      // Optimistic update: immediately remove from UI
      await queryClient.cancelQueries({ queryKey: ['geocache', geocacheId] });
      await queryClient.cancelQueries({ queryKey: ['geocaches'] });
      
      // Store previous data for rollback
      const previousGeocache = queryClient.getQueryData(['geocache', geocacheId]);
      const previousGeocaches = queryClient.getQueryData(['geocaches']);
      
      // Remove from geocaches list
      queryClient.setQueryData(['geocaches'], (old: unknown) => {
        if (Array.isArray(old)) {
          return old.filter((cache: { id: string }) => cache.id !== geocacheId);
        }
        return old;
      });
      
      // Mark individual geocache as deleted
      queryClient.setQueryData(['geocache', geocacheId], null);
      
      return { previousGeocache, previousGeocaches };
    },
    onSuccess: (_data, { geocacheId }) => {
      toast({
        title: "Geocache deleted",
        description: "Your geocache has been removed and the deletion request sent to relays.",
      });
      
      // Invalidate related queries to ensure fresh data
      queryClient.invalidateQueries({ queryKey: ['geocaches'] });
      queryClient.invalidateQueries({ queryKey: ['offline-geocaches'] });
      queryClient.invalidateQueries({ queryKey: ['user-geocaches'] });
      
      console.log(`Deletion event sent for geocache: ${geocacheId}`);
    },
    onError: (error, { geocacheId }, context) => {
      // Rollback optimistic updates only for signing errors
      const errorObj = error as { message?: string };
      const isSigningError = errorObj.message?.includes('User rejected') || 
                            errorObj.message?.includes('cancelled') ||
                            errorObj.message?.includes('No signer');
      
      if (isSigningError) {
        // Only rollback for user cancellation or signer issues
        if (context?.previousGeocache) {
          queryClient.setQueryData(['geocache', geocacheId], context.previousGeocache);
        }
        if (context?.previousGeocaches) {
          queryClient.setQueryData(['geocaches'], context.previousGeocaches);
        }
        
        toast({
          title: "Deletion cancelled",
          description: "The geocache deletion was cancelled.",
          variant: "destructive",
        });
      } else {
        // For network/relay errors, keep the optimistic update but show a softer message
        toast({
          title: "Deletion request sent",
          description: "The deletion request was created but may take longer to propagate to all relays.",
        });
      }
      
      console.error('Delete geocache error:', error);
    },
    onSettled: () => {
      // Always invalidate queries after mutation settles
      queryClient.invalidateQueries({ queryKey: ['geocaches'] });
    },
  });
}