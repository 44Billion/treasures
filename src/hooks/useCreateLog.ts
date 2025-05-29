import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useToast } from '@/hooks/useToast';
import type { CreateLogData } from '@/types/geocache';

export function useCreateLog() {
  const queryClient = useQueryClient();
  const { mutateAsync: publishEvent } = useNostrPublish();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: CreateLogData) => {
      console.log('Creating log for geocache:', data.geocacheId);
      
      // Validate data
      if (!data.geocacheId) {
        throw new Error('Geocache ID is required');
      }
      if (!data.text?.trim()) {
        throw new Error('Log text is required');
      }
      
      // Create the log event
      const content = JSON.stringify({
        type: data.type,
        text: data.text.trim(),
        images: data.images || [],
      });

      const event = await publishEvent({
        kind: 30078, // Application-specific data
        content,
        tags: [
          ['d', `geocache-log-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`], // Unique identifier for each log
          ['t', 'geocache-log'], // Type tag for filtering
          ['geocache-id', data.geocacheId], // KEEP for backward compatibility
          ['geocache-dtag', data.geocacheDTag || data.geocacheId], // NEW: Reference the stable d-tag
          ['type', data.type], // Log type for filtering
        ],
      });

      console.log('Log event created:', event.id);
      return event;
    },
    onSuccess: (event, variables) => {
      toast({
        title: "Log posted!",
        description: "Your log has been added to the geocache.",
      });
      
      // Optimistically update the cache immediately
      queryClient.setQueryData(['geocache-logs', variables.geocacheId], (oldData: unknown) => {
        if (!oldData) return oldData;
        
        // Create a new log entry from our event
        const newLog = {
          id: event.id,
          pubkey: event.pubkey,
          created_at: event.created_at,
          geocacheId: variables.geocacheId,
          type: variables.type,
          text: variables.text.trim(),
          images: variables.images || [],
        };
        
        // Add to the beginning of the list (newest first) and remove duplicates
        const existingLogs = (oldData as { id: string }[]) || [];
        const updatedLogs = [newLog, ...existingLogs.filter((log: { id: string }) => log.id !== event.id)];
        
        console.log('Optimistically updated cache with new log:', newLog.id);
        return updatedLogs;
      });
      
      // Wait longer for the event to propagate, then do a background refresh
      setTimeout(() => {
        // Invalidate to trigger a background refresh (users won't see loading state)
        queryClient.invalidateQueries({ 
          queryKey: ['geocache-logs', variables.geocacheId],
          refetchType: 'all' // Refetch both active and inactive queries
        });
        queryClient.invalidateQueries({ queryKey: ['geocache', variables.geocacheId] });
        queryClient.invalidateQueries({ queryKey: ['geocaches'] });
      }, 5000); // Increased from 2000ms to 5000ms
    },
    onError: (error: unknown) => {
      console.error('Failed to create log:', error);
      
      let errorMessage = "Please try again later.";
      const errorObj = error as { message?: string };
      
      if (errorObj.message?.includes('not found on relays')) {
        errorMessage = "Log was created but couldn't be verified. It may appear after a delay.";
      } else if (errorObj.message) {
        errorMessage = errorObj.message;
      }
      
      toast({
        title: "Failed to post log",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });
}