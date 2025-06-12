import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from '@/features/auth/hooks/useCurrentUser';
import { useToast } from '@/shared/hooks/useToast';
import { offlineStorage } from '@/features/offline/utils/offlineStorage';
import { NIP_GC_KINDS, createGeocacheCoordinate } from '@/features/geocache/utils/nip-gc';
import { TIMEOUTS } from '@/shared/config';
import type { NostrEvent } from '@nostrify/nostrify';

interface DeleteGeocacheParams {
  geocacheId: string;
  geocacheEvent?: NostrEvent;
  reason?: string;
}

export function useDeleteGeocache() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();
  const { toast } = useToast();

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
        ['client', 'treasures'],
      ];

      // Add coordinate tag for replaceable events
      if (geocacheEvent && geocacheEvent.kind === NIP_GC_KINDS.GEOCACHE) {
        const dTag = geocacheEvent.tags.find(t => t[0] === 'd')?.[1];
        if (dTag) {
          const coordinate = createGeocacheCoordinate(geocacheEvent.pubkey, dTag);
          deletionTags.push(['a', coordinate]);
        }
      }

      const deletionEvent = {
        kind: 5,
        content: reason || 'Geocache deleted by author',
        tags: deletionTags,
        created_at: Math.floor(Date.now() / 1000),
      };

      // Sign the event
      const signedEvent = await user.signer.signEvent(deletionEvent);

      // Fire-and-forget deletion: send to relays without strict verification
      // Deletion events are optimistic - we assume they work and don't fail the operation
      // if some relays don't respond immediately
      try {
        await nostr.event(signedEvent, { 
          signal: AbortSignal.timeout(TIMEOUTS.DELETE_OPERATION) 
        });
      } catch (publishError) {
        // Don't throw here - the event was signed and some relays might have received it
        // Log for debugging but continue with optimistic success
        console.warn('Deletion event publish warning (continuing optimistically):', publishError);
      }

      return signedEvent;
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
        description: "Your geocache has been removed and the deletion request sent to relays.",
      });
      
      // Invalidate related queries to ensure fresh data
      queryClient.invalidateQueries({ queryKey: ['geocaches'] });
      queryClient.invalidateQueries({ queryKey: ['offline-geocaches'] });
      queryClient.invalidateQueries({ queryKey: ['my-geocaches'] });
      
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

