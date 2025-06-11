import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/useToast';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useOfflineSync, useOfflineMode } from '@/hooks/useOfflineStorage';
import type { CreateLogData } from '@/types/geocache';
import { 
  NIP_GC_KINDS, 
  buildFoundLogTags,
  buildCommentLogTags, 
  validateCommentLogType,
  type ValidCommentLogType
} from '@/lib/nip-gc';

export function useCreateLog() {
  const queryClient = useQueryClient();
  const { mutateAsync: publishEvent } = useNostrPublish();
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
          const result = await publishEvent({
            kind: eventKind,
            content: data.text.trim(), // Plain text log message in content
            tags,
          });

          // Handle success
          toast({
            title: "Log posted!",
            description: "Your log has been added to the geocache.",
          });

          // Optimistically update the cache
          queryClient.setQueryData(['geocache-logs', data.geocacheDTag, data.geocachePubkey], (oldData: unknown) => {
            const clientTag = result.tags.find(t => t[0] === 'client')?.[1];
            const relayTags = result.tags.filter(t => t[0] === 'relay').map(t => t[1]);
            
            const newLog = {
              id: result.id,
              pubkey: result.pubkey,
              created_at: result.created_at,
              geocacheId: data.geocacheId,
              type: data.type,
              text: data.text.trim(),
              images: data.images || [],
              client: clientTag,
              relays: relayTags,
            };
            
            const existingLogs = Array.isArray(oldData) ? oldData : [];
            const updatedLogs = [newLog, ...existingLogs.filter((log: { id: string }) => log.id !== result.id)];
            
            return updatedLogs;
          });

          return result;
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

          // Handle error
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
      
      // Background refresh after delay
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['geocache-logs', variables.geocacheDTag, variables.geocachePubkey] });
        queryClient.invalidateQueries({ queryKey: ['geocache', variables.geocacheId] });
        queryClient.invalidateQueries({ queryKey: ['geocaches'] });
      }, 3000);
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