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

        await nostr.event(event, { signal: AbortSignal.timeout(10000) }); // Increased timeout
        
        return event; // Return the signed event
      } catch (error: any) {
        console.error("Failed to publish event:", error);
        
        // Provide more specific error messages
        if (error.message?.includes("timeout")) {
          throw new Error("Connection timeout. Please check your internet connection.");
        } else if (error.message?.includes("User rejected")) {
          throw new Error("Event signing was cancelled.");
        } else if (error.message?.includes("relay")) {
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