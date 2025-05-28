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
      // Create the log event
      const content = JSON.stringify({
        type: data.type,
        text: data.text,
        images: data.images || [],
      });

      const event = await publishEvent({
        kind: 30078, // Application-specific data
        content,
        tags: [
          ['d', 'geocache-log'], // Identifier for log data
          ['geocache', data.geocacheId], // Reference to the geocache
          ['type', data.type], // Log type for filtering
        ],
      });

      return event;
    },
    onSuccess: (event, variables) => {
      toast({
        title: "Log posted!",
        description: "Your log has been added to the geocache.",
      });
      
      // Invalidate queries to refresh the logs
      queryClient.invalidateQueries({ queryKey: ['geocache-logs', variables.geocacheId] });
      queryClient.invalidateQueries({ queryKey: ['geocache', variables.geocacheId] });
      queryClient.invalidateQueries({ queryKey: ['geocaches'] });
    },
    onError: (error) => {
      console.error('Failed to create log:', error);
      toast({
        title: "Failed to post log",
        description: "Please try again later.",
        variant: "destructive",
      });
    },
  });
}