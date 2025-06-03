import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useToast } from '@/hooks/useToast';
import { isSafari, createSafariNostr } from '@/lib/safariNostr';
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

      // Fast deletion with minimal retries
      const maxRetries = 2; // Reduced retries
      const timeout = isSafari() ? TIMEOUTS.DELETE_OPERATION : TIMEOUTS.DELETE_OPERATION * 1.5;
      
      let lastError: Error | null = null;
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          if (isSafari()) {
            // Use Safari-optimized client with shorter timeout
            const safariClient = createSafariNostr([
              'wss://relay.damus.io',
              'wss://nos.lol'
            ]);
            
            try {
              await safariClient.publish(signedEvent, { 
                timeout: timeout,
                maxRetries: 1 
              });
              safariClient.close();
              return signedEvent; // Success, return immediately
            } catch (error) {
              safariClient.close();
              lastError = error as Error;
              if (attempt === maxRetries) break;
            }
          } else {
            // Use standard Nostr client with timeout
            await nostr.event(signedEvent, { 
              signal: AbortSignal.timeout(timeout) 
            });
            return signedEvent; // Success, return immediately
          }
        } catch (error) {
          lastError = error as Error;
          if (attempt === maxRetries) break;
          
          // Short delay before retry (no exponential backoff)
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      
      // All attempts failed
      const errorObj = lastError as { message?: string };
      if (errorObj?.message?.includes('timeout')) {
        throw new Error('Deletion timed out. Please check if the geocache was deleted.');
      } else if (errorObj?.message?.includes('User rejected') || errorObj?.message?.includes('cancelled')) {
        throw new Error('Deletion was cancelled.');
      } else {
        throw new Error('Failed to delete geocache. Please try again.');
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
        description: "Your geocache has been successfully removed from the network.",
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

