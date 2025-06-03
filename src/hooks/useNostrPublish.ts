import { useNostr } from "@nostrify/react";
import { useMutation } from "@tanstack/react-query";
import { useCurrentUser } from "./useCurrentUser";
import { isSafari } from '@/lib/safariNostr';

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

        // Determine timeout based on browser
        const publishTimeout = isSafari() ? 4000 : 8000;
        const verifyTimeout = isSafari() ? 3000 : 5000;

        // Send to relays with appropriate timeout
        try {
          await nostr.event(event, { signal: AbortSignal.timeout(publishTimeout) });
        } catch (error) {
          const errorObj = error as { message?: string };
          throw new Error(`Failed to publish event: ${errorObj.message || 'Unknown error'}`);
        }

        // For Safari, skip verification to avoid additional timeouts
        if (isSafari()) {
          return event;
        }

        // For other browsers, do a quick verification (but don't fail if it doesn't work)
        try {
          const verification = await nostr.query([{ ids: [event.id] }], { 
            signal: AbortSignal.timeout(verifyTimeout) 
          });
          
          if (verification.length === 0) {
            console.warn('Event published but not immediately found on relays (this is normal)');
          }
        } catch (verifyError) {
          // Don't fail the whole operation if verification fails
          console.warn('Event verification failed (this is normal):', verifyError);
        }
        
        return event; // Return the signed event
      } catch (error: unknown) {
        const errorObj = error as { message?: string };
        
        // Provide more specific error messages
        if (errorObj.message?.includes("timeout")) {
          throw new Error("Connection timeout. Please check your internet connection and try again.");
        } else if (errorObj.message?.includes("User rejected") || errorObj.message?.includes("cancelled")) {
          throw new Error("Event signing was cancelled.");
        } else if (errorObj.message?.includes("Failed to publish")) {
          // Re-throw our custom publish error as-is
          throw error;
        } else if (errorObj.message?.includes("relay")) {
          throw new Error("Failed to connect to Nostr relays. Please try again.");
        }
        
        throw error;
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