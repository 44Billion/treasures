import { useNostr } from "@nostrify/react";
import { useMutation } from "@tanstack/react-query";
import { useCurrentUser } from "./useCurrentUser";
import { TIMEOUTS } from "@/lib/constants";

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

        // Send to relays with timeout - set and forget approach
        try {
          await nostr.event(event, { signal: AbortSignal.timeout(TIMEOUTS.QUERY) });
        } catch (error) {
          const errorObj = error as { message?: string };
          // Be more forgiving with timeout and relay errors
          if (errorObj.message?.includes('timeout')) {
            console.warn('Event publish timed out, but may have succeeded:', errorObj.message);
            // Don't throw for timeouts - the event may have been published
          } else if (errorObj.message?.includes('relay')) {
            console.warn('Relay error during publish, but may have succeeded:', errorObj.message);
            // Don't throw for relay errors - the event may have been published
          } else {
            throw new Error(`Failed to publish event: ${errorObj.message || 'Unknown error'}`);
          }
        }
        
        return event; // Return the signed event
      } catch (error: unknown) {
        const errorObj = error as { message?: string };
        
        // Provide more specific error messages
        if (errorObj.message?.includes("timeout")) {
          throw new Error("Connection timeout. Your event may have been published successfully.");
        } else if (errorObj.message?.includes("User rejected") || errorObj.message?.includes("cancelled")) {
          throw new Error("Event signing was cancelled.");
        } else if (errorObj.message?.includes("Failed to publish")) {
          // Re-throw our custom publish error as-is
          throw error;
        } else if (errorObj.message?.includes("relay")) {
          throw new Error("Relay connection issue. Your event may have been published successfully.");
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