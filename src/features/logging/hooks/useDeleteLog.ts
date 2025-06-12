import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from '@/features/auth/hooks/useCurrentUser';
import { useToast } from '@/shared/hooks/useToast';
import type { GeocacheLog } from '@/types/geocache';

export function useDeleteLog() {
  const queryClient = useQueryClient();
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (logId: string) => {
      if (!user) {
        throw new Error("User is not logged in");
      }

      if (!user.signer) {
        throw new Error("No signer available. Please check your Nostr extension.");
      }

      try {
        // Create and sign the deletion event
        const event = await user.signer.signEvent({
          kind: 5, // Event deletion request
          content: 'Log deleted by author',
          tags: [
            ['e', logId], // Reference to the log event to delete
            ['client', 'treasures'], // Add client tag
          ],
          created_at: Math.floor(Date.now() / 1000),
        });


        // Fire-and-forget deletion: send to relays without strict verification
        // Deletion events are optimistic - we assume they work and don't fail the operation
        try {
          await nostr.event(event, { signal: AbortSignal.timeout(5000) });
        } catch (publishError) {
          // Don't throw here - the event was signed and some relays might have received it
          // Log for debugging but continue with optimistic success
          console.warn('Deletion event publish warning (continuing optimistically):', publishError);
        }

        return event;
      } catch (error: unknown) {
        
        const errorObj = error as { message?: string };
        if (errorObj.message?.includes("User rejected")) {
          throw new Error("Event signing was cancelled.");
        } else if (errorObj.message?.includes("not logged in")) {
          throw new Error("User is not logged in");
        }
        
        throw error;
      }
    },
    onSuccess: (event, logId) => {
      toast({
        title: "Log deleted",
        description: "Your log has been removed and the deletion request sent to relays.",
      });
      
      // Optimistically remove the log from all relevant caches
      queryClient.setQueriesData(
        { queryKey: ['geocache-logs'] },
        (oldData: unknown) => {
          if (Array.isArray(oldData)) {
            return oldData.filter((log: GeocacheLog) => log.id !== logId);
          }
          return oldData;
        }
      );
      
      // Invalidate queries to refresh the data
      queryClient.invalidateQueries({ queryKey: ['geocache-logs'] });
      queryClient.invalidateQueries({ queryKey: ['geocaches'] });
    },
    onError: (error: unknown) => {
      const errorObj = error as { message?: string };
      
      // Only show destructive errors for signing issues
      if (errorObj.message?.includes('User rejected') || errorObj.message?.includes('cancelled')) {
        toast({
          title: "Deletion cancelled",
          description: "The log deletion was cancelled.",
          variant: "destructive",
        });
      } else if (errorObj.message?.includes('not logged in') || errorObj.message?.includes('No signer')) {
        toast({
          title: "Authentication required",
          description: "Please log in to delete logs.",
          variant: "destructive",
        });
      } else {
        // For network/relay errors, show a softer message
        toast({
          title: "Deletion request sent",
          description: "The deletion request was created but may take longer to propagate to all relays.",
        });
      }
    },
  });
}