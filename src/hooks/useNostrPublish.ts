import { useNostr } from "@nostrify/react";
import { useMutation } from "@tanstack/react-query";

import { useCurrentUser } from "./useCurrentUser";

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
          tags.push(["client", "nostrcache"]);
        }

        const event = await user.signer.signEvent({
          kind: t.kind,
          content: t.content ?? "",
          tags,
          created_at: t.created_at ?? Math.floor(Date.now() / 1000),
        });

        // Send to relays and wait for confirmation
        const result = await nostr.event(event, { signal: AbortSignal.timeout(10000) });
        
        console.log('Event publish result:', result);
        
        // Verify the event was actually sent by querying for it
        const verifySignal = AbortSignal.timeout(5000);
        const verification = await nostr.query([{ ids: [event.id] }], { signal: verifySignal });
        
        if (verification.length === 0) {
          console.error('Event verification failed - event not found on relays');
          throw new Error('Event was signed but not found on relays. Please try again.');
        }
        
        console.log('Event verified on relays:', event.id);
        return event; // Return the signed event
      } catch (error: unknown) {
        console.error("Failed to publish event:", error);
        
        const errorObj = error as { message?: string };
        // Provide more specific error messages
        if (errorObj.message?.includes("timeout")) {
          throw new Error("Connection timeout. Please check your internet connection.");
        } else if (errorObj.message?.includes("User rejected")) {
          throw new Error("Event signing was cancelled.");
        } else if (errorObj.message?.includes("relay")) {
          throw new Error("Failed to connect to Nostr relays. Please try again.");
        }
        
        throw error;
      }
    },
    onError: (error) => {
      console.error("Failed to publish event:", error);
    },
    onSuccess: (data) => {
      console.log("Event published successfully:", data);
    },
  });
}