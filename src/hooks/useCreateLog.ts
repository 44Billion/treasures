import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/useToast';
import { useNostrPublish } from '@/hooks/useNostrPublish';

import type { CreateLogData } from '@/types/geocache';
import { 
  NIP_GC_KINDS, 
  buildFoundLogTags,
  buildCommentLogTags, 
  validateCommentLogType,
  type ValidCommentLogType
} from '@/utils/nip-gc';

export function useCreateLog() {
  const queryClient = useQueryClient();
  const { mutateAsync: publishEvent } = useNostrPublish();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: CreateLogData) => {
      // Validate data
      if (!data.geocacheId) {
        throw new Error('Geocache ID is required');
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
          geocacheKind: data.geocacheKind,
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
          geocacheKind: data.geocacheKind,
        });
      }
      
      try {
        const result = await publishEvent({
          kind: eventKind,
          content: (data.text || '').trim(),
          tags,
        });

        return result;
      } catch (error) {
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
    },
    onSuccess: (event, variables) => {
      toast({
        title: "Log posted!",
        description: "Your log has been added to the treasure.",
      });

      // Build the new log entry
      const clientTag = event.tags.find(t => t[0] === 'client')?.[1];
      const relayTags = event.tags.filter(t => t[0] === 'relay').map(t => t[1]);

      const newLog = {
        id: event.id,
        pubkey: event.pubkey,
        created_at: event.created_at,
        geocacheId: variables.geocacheId,
        type: variables.type,
        text: (variables.text || '').trim(),
        images: variables.images || [],
        client: clientTag,
        relays: relayTags,
      };

      // Update all matching log queries (regardless of verificationPubkey/kind/wot segments)
      queryClient.setQueriesData(
        { queryKey: ['geocache-logs', variables.geocacheDTag, variables.geocachePubkey] },
        (oldData: unknown) => {
          const existingLogs = Array.isArray(oldData) ? oldData : [];
          return [newLog, ...existingLogs.filter((log: { id: string }) => log.id !== event.id)];
        }
      );
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