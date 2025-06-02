import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useToast } from '@/hooks/useToast';

export function useDeleteGeocache() {
  const queryClient = useQueryClient();
  const { mutateAsync: publishEvent } = useNostrPublish();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (geocacheId: string) => {
      // Create a deletion event
      const event = await publishEvent({
        kind: 5, // Event deletion request
        content: '',
        tags: [
          ['e', geocacheId], // Reference to the event to delete
        ],
      });

      return event;
    },
    onSuccess: (event, geocacheId) => {
      toast({
        title: "Geocache deleted",
        description: "Your geocache has been removed.",
      });
      
      // Invalidate queries to refresh the data
      queryClient.invalidateQueries({ queryKey: ['geocache', geocacheId] });
      queryClient.invalidateQueries({ queryKey: ['geocaches'] });
    },
    onError: (error) => {
      toast({
        title: "Failed to delete geocache",
        description: "Please try again later.",
        variant: "destructive",
      });
    },
  });
}