import { useNostr } from "@nostrify/react";
import { useMutation } from "@tanstack/react-query";
import { useCurrentUser } from "./useCurrentUser";
import { TIMEOUTS, RETRY_CONFIG } from "@/lib/constants";
import { getAdaptiveTimeout } from "@/lib/networkUtils";

interface EventTemplate {
  kind: number;
  content?: string;
  tags?: string[][];
  created_at?: number;
}

export function useNostrPublish() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();

  return useMutation({
    mutationFn: async (t: EventTemplate) => {
      if (!user) {
        throw new Error("User is not logged in");
      }

      if (!user.signer) {
        throw new Error("No signer available. Please check your Nostr extension.");
      }

      try {
        const tags = t.tags ?? [];

        // Add the client tag if it doesn't exist
        if (!tags.some((tag) => tag[0] === "client")) {
          tags.push(["client", "treasures"]);
        }

        // Sign the event
        const event = await user.signer.signEvent({
          kind: t.kind,
          content: t.content ?? "",
          tags,
          created_at: t.created_at ?? Math.floor(Date.now() / 1000),
        });

        // Send to relays with retry logic and better error handling
        let lastError: Error | null = null;
        let publishSuccess = false;
        
        for (let attempt = 1; attempt <= RETRY_CONFIG.MAX_RETRIES; attempt++) {
          try {
            // Adaptive timeout that considers network conditions and retry attempts
            const timeout = getAdaptiveTimeout(TIMEOUTS.QUERY + (attempt - 1) * 2000);
            await nostr.event(event, { signal: AbortSignal.timeout(timeout) });
            publishSuccess = true;
            break;
          } catch (error) {
            const errorObj = error as { message?: string };
            const errorMessage = errorObj.message || 'Unknown error';
            
            lastError = new Error(errorMessage);
            
            // Don't retry for certain types of errors
            if (errorMessage.includes('User rejected') || 
                errorMessage.includes('cancelled') ||
                errorMessage.includes('signEvent')) {
              throw error;
            }
            
            // Log the attempt
            console.warn(`Publish attempt ${attempt}/${RETRY_CONFIG.MAX_RETRIES} failed:`, errorMessage);
            
            // Wait before retrying (except on last attempt)
            if (attempt < RETRY_CONFIG.MAX_RETRIES) {
              await new Promise(resolve => setTimeout(resolve, RETRY_CONFIG.BASE_DELAY * attempt));
            }
          }
        }
        
        // If all retries failed, throw the last error with better messaging
        if (!publishSuccess && lastError) {
          const errorMessage = lastError.message;
          
          if (errorMessage.includes('no promise in promise.any resolved')) {
            throw new Error("All relay connections failed after multiple attempts. Please check your internet connection and try again.");
          } else if (errorMessage.includes('timeout')) {
            throw new Error("Connection timeout after multiple attempts. Your event may have been published successfully.");
          } else if (errorMessage.includes('WebSocket')) {
            throw new Error("Relay connection failed after multiple attempts. Please check your internet connection and try again.");
          } else if (errorMessage.includes('relay')) {
            throw new Error("Relay error occurred after multiple attempts. Your event may have been published successfully.");
          } else if (errorMessage.includes('network')) {
            throw new Error("Network error after multiple attempts. Please check your internet connection and try again.");
          } else {
            throw new Error(`Failed to publish event after ${RETRY_CONFIG.MAX_RETRIES} attempts: ${errorMessage}`);
          }
        }
        
        // Verify the event was published by querying for it
        if (publishSuccess) {
          try {
            const verification = await nostr.query(
              [{ ids: [event.id] }], 
              { signal: AbortSignal.timeout(TIMEOUTS.FAST_QUERY) }
            );
            
            if (verification.length === 0) {
              console.warn('Event not found in verification query, but publish succeeded');
            } else {
              console.log('Event successfully verified on relay');
            }
          } catch (verifyError) {
            console.warn('Verification query failed, but publish succeeded:', verifyError);
          }
        }
        
        return event; // Return the signed event
      } catch (error: unknown) {
        const errorObj = error as { message?: string };
        const errorMessage = errorObj.message || 'Unknown error';
        
        // Handle signing and other errors
        if (errorMessage.includes("User rejected") || errorMessage.includes("cancelled")) {
          throw new Error("Event signing was cancelled.");
        } else if (errorMessage.includes("Failed to publish") || errorMessage.includes("All relay connections failed")) {
          // Re-throw our custom publish errors as-is
          throw error;
        } else if (errorMessage.includes("No signer") || errorMessage.includes("not logged in")) {
          // Re-throw auth errors as-is
          throw error;
        } else if (errorMessage.includes("signEvent")) {
          throw new Error("Failed to sign event. Please check your Nostr extension.");
        }
        
        // For any other unexpected errors, provide a generic message
        console.error('Unexpected publish error:', error);
        throw new Error("An unexpected error occurred while publishing. Please try again.");
      }
    },
    onError: (error) => {
      console.error('Publish error:', error);
    },
    onSuccess: (data) => {
      console.log('Event published successfully:', data.id);
    },
  });
}