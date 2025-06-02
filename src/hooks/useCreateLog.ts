import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNostrPublishToRelays } from '@/hooks/useNostrPublishToRelays';
import { useToast } from '@/hooks/useToast';
import type { CreateLogData, GeocacheLog } from '@/types/geocache';
import { 
  NIP_GC_KINDS, 
  buildLogTags, 
  validateLogType,
  type ValidLogType
} from '@/lib/nip-gc';

export function useCreateLog() {
  const queryClient = useQueryClient();
  const { mutateAsync: publishEvent } = useNostrPublishToRelays();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: CreateLogData) => {
      
      // Validate data
      if (!data.geocacheId) {
        throw new Error('Geocache ID is required');
      }
      if (!data.text?.trim()) {
        throw new Error('Log text is required');
      }
      
      // Validate log type according to NIP-GC
      if (!validateLogType(data.type)) {
        throw new Error(`Invalid log type: ${data.type}`);
      }
      
      // Build tags using consolidated utility
      const tags = buildLogTags({
        geocachePubkey: data.geocachePubkey!,
        geocacheDTag: data.geocacheDTag!,
        logType: data.type as ValidLogType,
        images: data.images,
      });
      
      const event = await publishEvent({
        event: {
          kind: NIP_GC_KINDS.LOG,
          content: data.text.trim(), // Plain text log message in content
          tags,
        },
        options: {
          relays: data.preferredRelays, // Use the geocache's preferred relays if provided
        },
      });

      return event;
    },
    onSuccess: (event, variables) => {
      toast({
        title: "Log posted!",
        description: "Your log has been added to the geocache.",
      });
      
      // Optimistically update the cache immediately
      queryClient.setQueryData(['geocache-logs', variables.geocacheDTag, variables.geocachePubkey], (oldData: unknown) => {
        // Create a new log entry from our event
        // Extract client and relay info from the event tags
        const clientTag = event.tags.find(t => t[0] === 'client')?.[1];
        const relayTags = event.tags.filter(t => t[0] === 'relay').map(t => t[1]);
        
        const newLog = {
          id: event.id,
          pubkey: event.pubkey,
          created_at: event.created_at,
          geocacheId: variables.geocacheId,
          type: variables.type,
          text: variables.text.trim(),
          images: variables.images || [],
          client: clientTag, // Include the client info
          relays: relayTags, // Include relay tags
        };
        
        // Handle the case where oldData might be undefined or an empty array
        const existingLogs = Array.isArray(oldData) ? oldData : [];
        
        // Add to the beginning of the list (newest first) and remove duplicates
        const updatedLogs = [newLog, ...existingLogs.filter((log: { id: string }) => log.id !== event.id)];
        
        return updatedLogs;
      });
      
      // Wait longer for the event to propagate, then do a background refresh
      setTimeout(async () => {
        // Instead of invalidating, manually refetch and merge results
        const queryKey = ['geocache-logs', variables.geocacheDTag, variables.geocachePubkey];
        const currentData = queryClient.getQueryData(queryKey) as GeocacheLog[] | undefined;
        
        // Refetch the data
        try {
          await queryClient.refetchQueries({ 
            queryKey,
            type: 'active'
          });
          
          // After refetch, merge the data to ensure we don't lose any logs
          const newData = queryClient.getQueryData(queryKey) as GeocacheLog[] | undefined;
          if (currentData && newData) {
            // Create a map of all logs by ID to deduplicate
            const logMap = new Map();
            
            // Add all current logs
            currentData.forEach(log => logMap.set(log.id, log));
            
            // Add all new logs (will update if already exists)
            newData.forEach(log => logMap.set(log.id, log));
            
            // Convert back to array and sort by created_at
            const mergedLogs = Array.from(logMap.values())
              .sort((a, b) => b.created_at - a.created_at);
            
            // Update the cache with merged data
            queryClient.setQueryData(queryKey, mergedLogs);
          }
        } catch (error) {
        }
        
        // Still invalidate the other queries
        queryClient.invalidateQueries({ queryKey: ['geocache', variables.geocacheId] });
        queryClient.invalidateQueries({ queryKey: ['geocaches'] });
      }, 5000); // Increased from 2000ms to 5000ms
    },
    onError: (error: unknown) => {
      
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