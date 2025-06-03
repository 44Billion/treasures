import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNostrPublishToRelays } from '@/hooks/useNostrPublishToRelays';
import { useToast } from '@/hooks/useToast';
import { useOfflineSync, useOfflineMode } from '@/hooks/useOfflineStorage';
import type { CreateLogData, GeocacheLog } from '@/types/geocache';
import { 
  NIP_GC_KINDS, 
  buildFoundLogTags,
  buildCommentLogTags, 
  validateCommentLogType,
  type ValidCommentLogType
} from '@/lib/nip-gc';

export function useCreateLog() {
  const queryClient = useQueryClient();
  const { mutateAsync: publishEvent } = useNostrPublishToRelays();
  const { toast } = useToast();
  const { queueAction } = useOfflineSync();
  const { isOnline } = useOfflineMode();

  return useMutation({
    mutationFn: async (data: CreateLogData) => {
      
      // Validate data
      if (!data.geocacheId) {
        throw new Error('Geocache ID is required');
      }
      if (!data.text?.trim()) {
        throw new Error('Log text is required');
      }
      
      // Determine event kind and build tags based on log type
      let eventKind: number;
      let tags: string[][];
      
      if (data.type === 'found') {
        // Found logs use kind 7516
        eventKind = NIP_GC_KINDS.FOUND_LOG;
        tags = buildFoundLogTags({
          geocachePubkey: data.geocachePubkey!,
          geocacheDTag: data.geocacheDTag!,
          images: data.images,
          verificationEvent: data.verificationEvent,
        });
      } else {
        // All other log types use kind 1111 (comment logs)
        if (data.type !== 'note' && !validateCommentLogType(data.type)) {
          throw new Error(`Invalid comment log type: ${data.type}`);
        }
        
        eventKind = NIP_GC_KINDS.COMMENT_LOG;
        tags = buildCommentLogTags({
          geocachePubkey: data.geocachePubkey!,
          geocacheDTag: data.geocacheDTag!,
          logType: data.type as ValidCommentLogType | 'note',
          images: data.images,
        });
      }
      
      if (isOnline) {
        try {
          const event = await publishEvent({
            event: {
              kind: eventKind,
              content: data.text.trim(), // Plain text log message in content
              tags,
            },
            options: {
              relays: data.preferredRelays, // Use the geocache's preferred relays if provided
            },
          });

          return event;
        } catch (error) {
          // If online publishing fails, queue for offline sync
          console.warn('Online log creation failed, queuing for later:', error);
          await queueAction('create_log', {
            geocacheId: data.geocacheId,
            content: data.text.trim(),
            type: data.type,
            geocachePubkey: data.geocachePubkey,
            geocacheDTag: data.geocacheDTag,
            images: data.images,
            preferredRelays: data.preferredRelays,
          });
          throw error;
        }
      } else {
        // Offline mode - queue for later sync
        await queueAction('create_log', {
          geocacheId: data.geocacheId,
          content: data.text.trim(),
          type: data.type,
          geocachePubkey: data.geocachePubkey,
          geocacheDTag: data.geocacheDTag,
          images: data.images,
          preferredRelays: data.preferredRelays,
        });
        
        // Return a mock event for optimistic updates
        const mockEvent = {
          id: `offline-${Date.now()}`,
          pubkey: 'offline-user',
          created_at: Math.floor(Date.now() / 1000),
          kind: eventKind,
          content: data.text.trim(),
          tags,
          sig: 'offline-signature',
        };
        
        return mockEvent;
      }
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
      console.error('Create log error:', error);
      
      let errorMessage = "Please try again later.";
      const errorObj = error as { message?: string };
      
      if (errorObj.message?.includes('not found on relays')) {
        errorMessage = "Log was created but couldn't be verified. It may appear after a delay.";
      } else if (errorObj.message?.includes('timeout')) {
        errorMessage = "Connection timeout. Please check your internet connection and try again.";
      } else if (errorObj.message?.includes('cancelled') || errorObj.message?.includes('rejected')) {
        errorMessage = "Log posting was cancelled.";
      } else if (errorObj.message?.includes('Failed to publish')) {
        errorMessage = "Could not connect to Nostr relays. Please try again.";
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