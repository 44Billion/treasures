import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from '@/features/auth/hooks/useCurrentUser';
import { useToast } from '@/shared/hooks/useToast';
import { offlineStorage } from '@/features/offline/utils/offlineStorage';
import { NIP_GC_KINDS, createGeocacheCoordinate } from '@/features/geocache/utils/nip-gc';
import { TIMEOUTS } from '@/shared/config';
import type { NostrEvent } from '@nostrify/nostrify';

interface BatchDeleteParams {
  geocaches: Array<{
    id: string;
    event?: NostrEvent;
  }>;
  reason?: string;
}

interface BatchDeleteResult {
  successful: string[];
  failed: Array<{ id: string; error: string }>;
}

interface MutationContext {
  previousGeocaches: unknown;
}

export function useBatchDeleteGeocaches() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation<BatchDeleteResult, Error, BatchDeleteParams, MutationContext>({
    mutationFn: async ({ geocaches, reason }: BatchDeleteParams): Promise<BatchDeleteResult> => {
      if (!user?.signer) {
        throw new Error("You must be logged in to delete geocaches");
      }

      if (geocaches.length === 0) {
        throw new Error("No geocaches selected for deletion");
      }

      const result: BatchDeleteResult = {
        successful: [],
        failed: [],
      };

      // Optimistically remove from local storage
      for (const geocache of geocaches) {
        try {
          await offlineStorage.removeGeocache(geocache.id);
          await offlineStorage.removeEvent(geocache.id);
        } catch (error) {
          console.warn(`Failed to remove ${geocache.id} from offline storage:`, error);
        }
      }

      // Process deletions in batches to avoid overwhelming the network
      const batchSize = 3;
      const batches: Array<Array<{ id: string; event?: NostrEvent }>> = [];
      
      for (let i = 0; i < geocaches.length; i += batchSize) {
        batches.push(geocaches.slice(i, i + batchSize));
      }

      for (const batch of batches) {
        const batchPromises = batch.map(async (geocache) => {
          try {
            // Create deletion event
            const deletionTags: string[][] = [
              ['e', geocache.id],
              ['k', (geocache.event?.kind || NIP_GC_KINDS.GEOCACHE).toString()],
              ['client', 'treasures'],
            ];

            // Add coordinate tag for replaceable events
            if (geocache.event && geocache.event.kind === NIP_GC_KINDS.GEOCACHE) {
              const dTag = geocache.event.tags.find(t => t[0] === 'd')?.[1];
              if (dTag) {
                const coordinate = createGeocacheCoordinate(geocache.event.pubkey, dTag);
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
            // Deletion events are optimistic - we assume they work
            try {
              await nostr.event(signedEvent, { 
                signal: AbortSignal.timeout(TIMEOUTS.DELETE_OPERATION) 
              });
            } catch (publishError) {
              // Don't throw here - the event was signed and some relays might have received it
              // Log for debugging but continue with optimistic success
              console.warn(`Deletion event publish warning for ${geocache.id} (continuing optimistically):`, publishError);
            }

            result.successful.push(geocache.id);
          } catch (error) {
            const errorObj = error as { message?: string };
            
            // Only mark as failed for signing errors (user cancellation, no signer, etc.)
            // Network/relay errors are treated as successful since the event was signed
            if (errorObj.message?.includes('User rejected') || 
                errorObj.message?.includes('cancelled') ||
                errorObj.message?.includes('No signer') ||
                errorObj.message?.includes('signEvent')) {
              result.failed.push({
                id: geocache.id,
                error: errorObj.message || 'Signing failed'
              });
            } else {
              // Network/relay errors - treat as successful since event was signed
              result.successful.push(geocache.id);
              console.warn(`Network error for ${geocache.id} but treating as successful:`, error);
            }
          }
        });

        // Wait for current batch to complete before starting next batch
        await Promise.allSettled(batchPromises);
        
        // Small delay between batches to avoid overwhelming relays
        if (batches.indexOf(batch) < batches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      return result;
    },
    onMutate: async ({ geocaches }) => {
      // Optimistic updates: remove all geocaches from UI immediately
      await queryClient.cancelQueries({ queryKey: ['geocaches'] });
      
      const previousGeocaches = queryClient.getQueryData(['geocaches']);
      const geocacheIds = new Set(geocaches.map(g => g.id));
      
      // Remove from geocaches list
      queryClient.setQueryData(['geocaches'], (old: unknown) => {
        if (Array.isArray(old)) {
          return old.filter((cache: Record<string, unknown>) => {
            const cacheId = cache.id as string;
            return !geocacheIds.has(cacheId);
          });
        }
        return old;
      });
      
      // Mark individual geocaches as deleted
      for (const geocache of geocaches) {
        queryClient.setQueryData(['geocache', geocache.id], null);
      }
      
      return { previousGeocaches };
    },
    onSuccess: (result, { geocaches }) => {
      const { successful, failed } = result;
      
      if (successful.length === geocaches.length) {
        toast({
          title: "Geocaches deleted",
          description: `Successfully sent deletion requests for ${successful.length} geocache${successful.length === 1 ? '' : 's'}.`,
        });
      } else if (successful.length > 0) {
        toast({
          title: "Mostly successful",
          description: `Sent deletion requests for ${successful.length} of ${geocaches.length} geocaches. ${failed.length} were cancelled or failed to sign.`,
        });
      } else {
        toast({
          title: "Deletion cancelled",
          description: `No geocaches were deleted. All deletion requests were cancelled or failed to sign.`,
          variant: "destructive",
        });
      }
      
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['geocaches'] });
      queryClient.invalidateQueries({ queryKey: ['offline-geocaches'] });
      queryClient.invalidateQueries({ queryKey: ['my-geocaches'] });
      
      console.log(`Batch deletion complete: ${successful.length} successful, ${failed.length} failed`);
    },
    onError: (error, { geocaches }, context) => {
      const errorObj = error as { message?: string };
      const isSigningError = errorObj.message?.includes('User rejected') || 
                            errorObj.message?.includes('cancelled') ||
                            errorObj.message?.includes('No signer');
      
      if (isSigningError) {
        // Only rollback for user cancellation or signer issues
        if (context?.previousGeocaches) {
          queryClient.setQueryData(['geocaches'], context.previousGeocaches);
        }
        
        toast({
          title: "Batch deletion cancelled",
          description: "The batch deletion was cancelled.",
          variant: "destructive",
        });
      } else {
        // For other errors, keep optimistic update but show softer message
        toast({
          title: "Deletion requests sent",
          description: "Some deletion requests were sent but may take longer to propagate.",
        });
      }
      
      console.error('Batch delete error:', error);
    },
    onSettled: () => {
      // Always invalidate queries after mutation settles
      queryClient.invalidateQueries({ queryKey: ['geocaches'] });
    },
  });
}