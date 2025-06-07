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
import { TIMEOUTS, RETRY_CONFIG } from '@/lib/constants';

interface CreateVerifiedLogData extends CreateLogData {
  verificationKey: string; // nsec for signing
}

/**
 * Publish verified log with robust retry logic
 * Verified logs are critical, so we need to be very patient
 */
async function publishVerifiedLogWithRetries(
  nostr: any, 
  signedLogEvent: any
): Promise<void> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= RETRY_CONFIG.VERIFIED_LOG_MAX_RETRIES; attempt++) {
    try {
      console.log(`Publishing verified log attempt ${attempt}/${RETRY_CONFIG.VERIFIED_LOG_MAX_RETRIES}`);
      
      // Use longer timeout for verified logs
      const signal = AbortSignal.timeout(RETRY_CONFIG.VERIFIED_LOG_TIMEOUT);
      await nostr.event(signedLogEvent, { signal });
      
      console.log('Verified log published successfully on attempt', attempt);
      return; // Success!
      
    } catch (error) {
      const errorObj = error as { message?: string };
      lastError = new Error(errorObj.message || 'Unknown error');
      
      console.warn(`Verified log publish attempt ${attempt} failed:`, errorObj.message);
      
      // If this is the last attempt, don't wait
      if (attempt === RETRY_CONFIG.VERIFIED_LOG_MAX_RETRIES) {
        break;
      }
      
      // Exponential backoff with jitter
      const baseDelay = RETRY_CONFIG.VERIFIED_LOG_BASE_DELAY;
      const exponentialDelay = baseDelay * Math.pow(2, attempt - 1);
      const jitter = Math.random() * 1000; // Add up to 1 second of jitter
      const totalDelay = exponentialDelay + jitter;
      
      console.log(`Waiting ${Math.round(totalDelay)}ms before retry ${attempt + 1}`);
      await new Promise(resolve => setTimeout(resolve, totalDelay));
    }
  }
  
  // If we get here, all attempts failed
  const errorMessage = lastError?.message || 'Unknown error';
  
  // For verified logs, we still want to provide helpful error messages
  if (errorMessage.includes('timeout')) {
    throw new Error('Publishing timed out after multiple attempts. The verified log may have been posted successfully. Please check the cache logs in a few minutes.');
  } else if (errorMessage.includes('relay')) {
    throw new Error('Could not connect to Nostr relays after multiple attempts. Please check your internet connection and try again.');
  } else {
    throw new Error(`Failed to publish verified log after ${RETRY_CONFIG.VERIFIED_LOG_MAX_RETRIES} attempts: ${errorMessage}`);
  }
}

/**
 * Verify that the event was actually published to the relay
 * This gives us confidence that the verified log is available
 */
async function verifyEventWasPublished(
  nostr: any, 
  signedLogEvent: any
): Promise<void> {
  console.log('Verifying that verified log was published...');
  
  // Wait a moment for the relay to process the event
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const signal = AbortSignal.timeout(TIMEOUTS.FAST_QUERY);
      const verification = await nostr.query([{ ids: [signedLogEvent.id] }], { signal });
      
      if (verification.length > 0) {
        console.log('Verified log confirmed on relay');
        return; // Success!
      }
      
      console.log(`Verification attempt ${attempt}: Event not found yet`);
      
      // Wait before next attempt
      if (attempt < 3) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
    } catch (error) {
      console.warn(`Verification attempt ${attempt} failed:`, error);
      
      // Wait before next attempt
      if (attempt < 3) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }
  
  // If verification fails, warn but don't fail the entire operation
  console.warn('Could not verify that the event was published, but it may still be successful');
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
      // For verified logs, we need to be very patient and persistent
      await publishVerifiedLogWithRetries(nostr, signedLogEvent);
      
      // Step 4: Verify the event was actually published
      await verifyEventWasPublished(nostr, signedLogEvent);
      
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
      } else if (errorObj.message?.includes('multiple attempts')) {
        errorMessage = errorObj.message; // Use the detailed retry message
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