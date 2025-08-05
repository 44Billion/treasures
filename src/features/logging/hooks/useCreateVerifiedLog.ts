import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/shared/hooks/useToast';
import { useCurrentUser } from '@/features/auth/hooks/useCurrentUser';
import { useNostrPublish } from '@/shared/hooks/useNostrPublish';
import type { CreateLogData } from '@/types/geocache';
import { 
  NIP_GC_KINDS, 
  buildFoundLogTags
} from '@/features/geocache/utils/nip-gc';
import { createVerificationEvent } from '@/features/geocache/utils/verification';

interface CreateVerifiedLogData extends CreateLogData {
  verificationKey: string; // nsec for signing
}



export function useCreateVerifiedLog() {
  const queryClient = useQueryClient();
  const { user } = useCurrentUser();
  const { toast } = useToast();
  const { mutateAsync: publishEvent } = useNostrPublish();

  return useMutation({
    mutationFn: async (data: CreateVerifiedLogData) => {
      // Validate data
      if (!data.geocacheId) {
        throw new Error('Geocache ID is required');
      }
      if (!data.text?.trim()) {
        throw new Error('Log text is required');
      }
      if (!data.verificationKey) {
        throw new Error('Verification key is required');
      }
      if (!user?.pubkey) {
        throw new Error('User must be logged in to create verified logs');
      }
      if (!user?.signer) {
        throw new Error('User signer is required');
      }
      
      // Only found logs can be verified according to NIP-GC
      if (data.type !== 'found') {
        throw new Error('Only found logs can be verified');
      }
      
      // Step 1: Create verification event signed by the cache's verification key
      let verificationEvent;
      try {
        verificationEvent = await createVerificationEvent(
          data.verificationKey,
          user.pubkey,
          data.geocachePubkey!,
          data.geocacheDTag!
        );
      } catch (verificationError: unknown) {
        const errorObj = verificationError as { message?: string };
        
        // Re-throw with more context
        if (errorObj.message?.includes('Invalid verification key format')) {
          throw new Error('Invalid verification key format. Please check the QR code.');
        } else if (errorObj.message?.includes('Could not decode verification key')) {
          throw new Error('Could not decode verification key. Please check the QR code.');
        } else {
          throw new Error(`Failed to create verification: ${errorObj.message || 'Unknown error'}`);
        }
      }
      
      // Step 2: Build tags for the found log event
      const tags = buildFoundLogTags({
        geocachePubkey: data.geocachePubkey!,
        geocacheDTag: data.geocacheDTag!,
        images: data.images,
        verificationEvent: JSON.stringify(verificationEvent),
        geocacheKind: data.geocacheKind,
      });
      
      // Create found log event template with embedded verification event
      const logEventTemplate = {
        kind: NIP_GC_KINDS.FOUND_LOG,
        content: data.text.trim(),
        tags,
      };

      // Step 3: Publish the log event using the unified publishing hook
      // This handles all retry logic, timeouts, and error handling consistently
      let signedLogEvent;
      try {
        signedLogEvent = await publishEvent(logEventTemplate);
      } catch (publishError: unknown) {
        const errorObj = publishError as { message?: string };
        
        // Re-throw with context that this is a verified log
        if (errorObj.message?.includes('Event signing was cancelled')) {
          throw new Error('Verified log signing was cancelled.');
        } else if (errorObj.message?.includes('timeout')) {
          throw new Error('Connection timeout while publishing verified log. Your log may have been posted successfully.');
        } else {
          throw new Error(`Failed to publish verified log: ${errorObj.message || 'Unknown error'}`);
        }
      }
      
      return { 
        logEvent: signedLogEvent
      };
    },
    onSuccess: (result, variables) => {
      const { logEvent } = result;
      
      // Optimistically update the cache immediately
      queryClient.setQueryData(['geocache-logs', variables.geocacheDTag, variables.geocachePubkey], (oldData: unknown) => {
        // Create a new log entry from our log event
        // Extract client and relay info from the event tags
        const clientTag = logEvent.tags.find(t => t[0] === 'client')?.[1];
        const relayTags = logEvent.tags.filter(t => t[0] === 'relay').map(t => t[1]);
        
        const newLog = {
          id: logEvent.id,
          pubkey: logEvent.pubkey, // This is now the user's pubkey
          created_at: logEvent.created_at,
          geocacheId: variables.geocacheId,
          type: variables.type,
          text: variables.text.trim(),
          images: variables.images || [],
          client: clientTag, // Include the client info
          relays: relayTags, // Include relay tags
          isVerified: true, // Mark as verified (has embedded verification)
        };
        
        // Handle the case where oldData might be undefined or an empty array
        const existingLogs = Array.isArray(oldData) ? oldData : [];
        
        // Add to the beginning of the list (newest first) and remove duplicates
        const updatedLogs = [newLog, ...existingLogs.filter((log: { id: string }) => log.id !== logEvent.id)];
        
        return updatedLogs;
      });
      
      // Background refresh after delay (same as regular logs)
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['geocache-logs', variables.geocacheDTag, variables.geocachePubkey] });
        queryClient.invalidateQueries({ queryKey: ['geocache', variables.geocacheId] });
        queryClient.invalidateQueries({ queryKey: ['geocaches'] });
      }, 3000);
      
      // Show success toast
      toast({
        title: "Verified log posted!",
        description: "Your verified log has been added to the geocache.",
      });
    },
    onError: (error: unknown) => {
      let errorMessage = "Please try again later.";
      const errorObj = error as { message?: string };
      
      if (errorObj.message?.includes('Event signing was cancelled')) {
        errorMessage = "Verified log posting was cancelled.";
      } else if (errorObj.message?.includes('timeout')) {
        errorMessage = "Connection timeout. Your verified log may have been posted successfully.";
      } else if (errorObj.message?.includes('Invalid verification key format')) {
        errorMessage = "Invalid verification key format. Please check the QR code.";
      } else if (errorObj.message?.includes('Could not decode verification key')) {
        errorMessage = "Could not decode verification key. Please check the QR code.";
      } else if (errorObj.message?.includes('Failed to create verification event')) {
        errorMessage = "Failed to create verification. Please check the QR code and try again.";
      } else if (errorObj.message?.includes('relay connections failed')) {
        errorMessage = "Could not connect to Nostr relays. Your verified log may have been posted successfully.";
      } else if (errorObj.message?.includes('Failed to publish event after')) {
        errorMessage = errorObj.message; // Use the detailed retry message from useNostrPublish
      } else if (errorObj.message) {
        errorMessage = errorObj.message;
      }
      
      toast({
        title: "Failed to post verified log",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });
}