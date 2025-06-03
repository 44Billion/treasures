import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useToast } from '@/hooks/useToast';
import { useNostrPublish } from '@/hooks/useUnifiedNostr';
import { offlineStorage } from '@/lib/offlineStorage';
import { NIP_GC_KINDS, createGeocacheCoordinate } from '@/lib/nip-gc';
import { TIMEOUTS } from '@/lib/constants';
import type { NostrEvent } from '@nostrify/nostrify';

interface DeleteGeocacheParams {
  geocacheId: string;
  geocacheEvent?: NostrEvent;
  reason?: string;
}

export function useDeleteGeocache() {
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { mutateAsync: publishEvent } = useNostrPublish();

  return useMutation({
    mutationFn: async ({ geocacheId, geocacheEvent, reason }: DeleteGeocacheParams) => {
      if (!user?.signer) {
        throw new Error("You must be logged in to delete geocaches");
      }

      // Optimistically remove from local storage immediately
      try {
        await offlineStorage.removeGeocache(geocacheId);
        await offlineStorage.removeEvent(geocacheId);
      } catch (error) {
        console.warn('Failed to remove from offline storage:', error);
      }

      // Create deletion event
      const deletionTags: string[][] = [
        ['e', geocacheId],
        ['k', (geocacheEvent?.kind || NIP_GC_KINDS.GEOCACHE).toString()],
      ];

      // Add coordinate tag for replaceable events
      if (geocacheEvent && geocacheEvent.kind === NIP_GC_KINDS.GEOCACHE) {
        const dTag = geocacheEvent.tags.find(t => t[0] === 'd')?.[1];
        if (dTag) {
          const coordinate = createGeocacheCoordinate(geocacheEvent.pubkey, dTag);
          deletionTags.push(['a', coordinate]);
        }
      }

      // Use unified publish system
      const result = await publishEvent({
        event: {
          kind: 5,
          content: reason || 'Geocache deleted by author',
          tags: deletionTags,
        },
        options: {
          timeout: TIMEOUTS.DELETE_OPERATION,
          requireMinSuccess: 1,
          verifyPublication: false, // Skip verification for faster deletion
        },
        invalidateQueries: [
          ['geocaches'],
          ['offline-geocaches'],
          ['my-geocaches'],
          ['geocache', geocacheId],
        ],
      });

      return result.event;
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
    onSuccess: (event, { geocacheId }) => {
      toast({
        title: "Geocache deleted",
        description: "Your geocache has been removed. It may take a moment for all relays to process the deletion.",
      });
      
      // Invalidate related queries to ensure fresh data
      queryClient.invalidateQueries({ queryKey: ['geocaches'] });
      queryClient.invalidateQueries({ queryKey: ['offline-geocaches'] });
      queryClient.invalidateQueries({ queryKey: ['my-geocaches'] });
      
      console.log(`Successfully deleted geocache: ${geocacheId}`);
    },
    onError: (error, { geocacheId }, context) => {
      // Rollback optimistic updates
      if (context?.previousGeocache) {
        queryClient.setQueryData(['geocache', geocacheId], context.previousGeocache);
      }
      if (context?.previousGeocaches) {
        queryClient.setQueryData(['geocaches'], context.previousGeocaches);
      }
      
      const errorObj = error as { message?: string };
      const errorMessage = errorObj.message || 'An unexpected error occurred';
      
      toast({
        title: "Failed to delete geocache",
        description: errorMessage,
        variant: "destructive",
      });
      
      console.error('Delete geocache error:', error);
    },
    onSettled: () => {
      // Always invalidate queries after mutation settles
      queryClient.invalidateQueries({ queryKey: ['geocaches'] });
    },
  });
}

