import { useNostr } from "@nostrify/react";
import { useMutation } from "@tanstack/react-query";
import { useCurrentUser } from "./useCurrentUser";
import { NRelay, NRelay1 } from '@nostrify/nostrify';

interface EventTemplate {
  kind: number;
  content?: string;
  tags?: string[][];
  created_at?: number;
}

interface PublishOptions {
  relays?: string[]; // Optional list of specific relays to publish to
}

export function useNostrPublishToRelays() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();

  return useMutation({
    mutationFn: async ({ event: eventTemplate, options }: { event: EventTemplate; options?: PublishOptions }) => {
      if (!user) {
        throw new Error("User is not logged in");
      }

      if (!user.signer) {
        throw new Error("No signer available. Please check your Nostr extension.");
      }

      try {
        const tags = eventTemplate.tags ?? [];

        // Add the client tag if it doesn't exist
        if (!tags.some((tag) => tag[0] === "client")) {
          tags.push(["client", "treasures"]);
        }

        const event = await user.signer.signEvent({
          kind: eventTemplate.kind,
          content: eventTemplate.content ?? "",
          tags,
          created_at: eventTemplate.created_at ?? Math.floor(Date.now() / 1000),
        });

        // If specific relays are provided, publish to those relays
        if (options?.relays && options.relays.length > 0) {
          
          // Create relay connections for the specified relays
          const relayPromises = options.relays.map(async (url) => {
            try {
              const relay = new NRelay1(url);
              await relay.event(event, { signal: AbortSignal.timeout(5000) });
              return { url, success: true };
            } catch (error) {
              return { url, success: false };
            }
          });

          const results = await Promise.all(relayPromises);
          const successCount = results.filter(r => r.success).length;
          
          if (successCount === 0) {
            throw new Error('Failed to publish to any of the specified relays');
          }
          
        }

        // Also publish to the default relays
        const result = await nostr.event(event, { signal: AbortSignal.timeout(10000) });
        
        // Verify the event was actually sent by querying for it
        const verifySignal = AbortSignal.timeout(5000);
        const verification = await nostr.query([{ ids: [event.id] }], { signal: verifySignal });
        
        if (verification.length === 0) {
          throw new Error('Event was signed but not found on relays. Please try again.');
        }
        
        return event; // Return the signed event
      } catch (error: unknown) {
        
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
    },
    onSuccess: (data) => {
    },
  });
}