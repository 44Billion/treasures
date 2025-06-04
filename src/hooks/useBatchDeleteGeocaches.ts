import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useToast } from '@/hooks/useToast';
import { offlineStorage } from '@/lib/offlineStorage';
import { NIP_GC_KINDS, createGeocacheCoordinate } from '@/lib/nip-gc';
import { TIMEOUTS, RETRY_CONFIG } from '@/lib/constants';
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
      const batches = [];
      
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

            // Publish with retry logic
            const maxRetries = RETRY_CONFIG.MAX_RETRIES;
            
            for (let attempt = 1; attempt <= maxRetries; attempt++) {
              try {
                await nostr.event(signedEvent, { 
                  signal: AbortSignal.timeout(TIMEOUTS.DELETE_OPERATION) 
                });
                break;
              } catch (error) {
                if (attempt === maxRetries) {
                  throw error;
                }
                // Wait before retry
                await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
              }
            }

            result.successful.push(geocache.id);
          } catch (error) {
            const errorObj = error as { message?: string };
            result.failed.push({
              id: geocache.id,
              error: errorObj.message || 'Unknown error'
            });
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
          return old.filter((cache: { id: string }) => !geocacheIds.has(cache.id));
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
          description: `Successfully deleted ${successful.length} geocache${successful.length === 1 ? '' : 's'}. It may take a moment for all relays to process the deletions.`,
        });
      } else if (successful.length > 0) {
        toast({
          title: "Partial success",
          description: `Deleted ${successful.length} of ${geocaches.length} geocaches. ${failed.length} failed. It may take a moment for relays to process the deletions.`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Deletion failed",
          description: `Failed to delete any geocaches. Please try again.`,
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
      // Rollback optimistic updates
      if (context?.previousGeocaches) {
        queryClient.setQueryData(['geocaches'], context.previousGeocaches);
      }
      
      const errorObj = error as { message?: string };
      
      toast({
        title: "Batch deletion failed",
        description: errorObj.message || 'An unexpected error occurred during batch deletion',
        variant: "destructive",
      });
      
      console.error('Batch delete error:', error);
    },
    onSettled: () => {
      // Always invalidate queries after mutation settles
      queryClient.invalidateQueries({ queryKey: ['geocaches'] });
    },
  });
}