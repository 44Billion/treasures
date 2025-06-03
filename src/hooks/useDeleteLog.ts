import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useToast } from '@/hooks/useToast';
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


        // Send to relays with a shorter timeout and no verification
        // Deletion events don't need strict verification since they're fire-and-forget
        try {
          await nostr.event(event, { signal: AbortSignal.timeout(8000) });
        } catch (publishError) {
          // Don't throw here - the event was signed and some relays might have received it
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
        description: "Your log has been removed. It may take a moment for all relays to process the deletion.",
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
      
      let errorMessage = "Please try again later.";
      
      if (errorObj.message?.includes('AggregateError') || errorObj.message?.includes('No Promise')) {
        errorMessage = "Unable to connect to Nostr relays. Please check your internet connection and try again.";
      } else if (errorObj.message?.includes('timeout')) {
        errorMessage = "Connection timeout. Please try again.";
      } else if (errorObj.message?.includes('User rejected')) {
        errorMessage = "Deletion was cancelled.";
      } else if (errorObj.message?.includes('not found on relays')) {
        errorMessage = "Deletion request was created but couldn't be verified. The log may be deleted after a delay.";
      } else if (errorObj.message) {
        errorMessage = errorObj.message;
      }
      
      toast({
        title: "Failed to delete log",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });
}