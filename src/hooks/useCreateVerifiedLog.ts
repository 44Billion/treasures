import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/useToast';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import type { CreateLogData, GeocacheLog } from '@/types/geocache';
import { 
  NIP_GC_KINDS, 
  buildFoundLogTags,
  buildVerificationEventTags,
  buildVerificationEventContent
} from '@/lib/nip-gc';
import { createVerificationEvent } from '@/lib/verification';
import { TIMEOUTS } from '@/lib/constants';

interface CreateVerifiedLogData extends CreateLogData {
  verificationKey: string; // nsec for signing
}

export function useCreateVerifiedLog() {
  const queryClient = useQueryClient();
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const { toast } = useToast();

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
      const verificationEvent = await createVerificationEvent(
        data.verificationKey,
        user.pubkey,
        data.geocachePubkey!,
        data.geocacheDTag!
      );
      
      // Step 2: Build tags for the found log event
      const tags = buildFoundLogTags({
        geocachePubkey: data.geocachePubkey!,
        geocacheDTag: data.geocacheDTag!,
        images: data.images,
        verificationEvent: JSON.stringify(verificationEvent),
      });
      
      // Create found log event template with embedded verification event
      const logEventTemplate = {
        kind: NIP_GC_KINDS.FOUND_LOG,
        content: data.text.trim(),
        tags,
      };

      // Sign the log event with the user's key
      const signedLogEvent = await user.signer.signEvent({
        ...logEventTemplate,
        created_at: Math.floor(Date.now() / 1000)
      });
      
      // Step 3: Publish the log event (with embedded verification)
      // Use the same streamlined approach as regular logs - set and forget
      try {
        await nostr.event(signedLogEvent, { signal: AbortSignal.timeout(TIMEOUTS.QUERY) });
      } catch (error) {
        const errorObj = error as { message?: string };
        // Don't fail for timeout or relay issues - just log and continue
        if (errorObj.message?.includes('timeout') || errorObj.message?.includes('relay')) {
          console.warn('Verified log publish may have timed out, but this is normal:', errorObj.message);
        } else {
          throw new Error(`Failed to publish verified log: ${errorObj.message || 'Unknown error'}`);
        }
      }
      
      return { 
        logEvent: signedLogEvent, 
        verificationEvent: verificationEvent 
      };
    },
    onSuccess: (result, variables) => {
      const { logEvent, verificationEvent } = result;
      
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
      
      if (errorObj.message?.includes('not found on relays')) {
        errorMessage = "Log was created but couldn't be verified. It may appear after a delay.";
      } else if (errorObj.message?.includes('timeout')) {
        errorMessage = "Connection timeout. Your log may have been posted successfully.";
      } else if (errorObj.message?.includes('cancelled') || errorObj.message?.includes('rejected')) {
        errorMessage = "Log posting was cancelled.";
      } else if (errorObj.message?.includes('Invalid private key')) {
        errorMessage = "Invalid verification key. Please check the QR code or verification link.";
      } else if (errorObj.message?.includes('Failed to publish') && errorObj.message?.includes('relay')) {
        errorMessage = "Could not connect to Nostr relays. Your log may have been posted successfully.";
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