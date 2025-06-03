import { useNostr } from "@nostrify/react";
import { useMutation } from "@tanstack/react-query";
import { useCurrentUser } from "./useCurrentUser";
import { NRelay1 } from '@nostrify/nostrify';
import { isSafari } from '@/lib/safariNostr';

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

        // Sign the event
        const event = await user.signer.signEvent({
          kind: eventTemplate.kind,
          content: eventTemplate.content ?? "",
          tags,
          created_at: eventTemplate.created_at ?? Math.floor(Date.now() / 1000),
        });

        // Determine timeout based on browser
        const publishTimeout = isSafari() ? 4000 : 8000;
        const verifyTimeout = isSafari() ? 3000 : 5000;

        let publishSuccess = false;
        let publishErrors: string[] = [];

        // Try to publish to specific relays first if provided
        if (options?.relays && options.relays.length > 0) {
          const relayPromises = options.relays.map(async (url) => {
            try {
              const relay = new NRelay1(url);
              await relay.event(event, { signal: AbortSignal.timeout(publishTimeout) });
              return { url, success: true, error: null };
            } catch (error) {
              const errorObj = error as { message?: string };
              return { url, success: false, error: errorObj.message || 'Unknown error' };
            }
          });

          const results = await Promise.allSettled(relayPromises);
          const successfulResults = results
            .filter((result): result is PromiseFulfilledResult<{ url: string; success: boolean; error: string | null }> => 
              result.status === 'fulfilled')
            .map(result => result.value)
            .filter(result => result.success);

          if (successfulResults.length > 0) {
            publishSuccess = true;
          } else {
            // Collect error messages
            results.forEach(result => {
              if (result.status === 'fulfilled' && result.value.error) {
                publishErrors.push(`${result.value.url}: ${result.value.error}`);
              } else if (result.status === 'rejected') {
                publishErrors.push(`Relay error: ${result.reason}`);
              }
            });
          }
        }

        // Also try to publish to default relays (but don't fail if this doesn't work)
        try {
          await nostr.event(event, { signal: AbortSignal.timeout(publishTimeout) });
          publishSuccess = true;
        } catch (error) {
          const errorObj = error as { message?: string };
          publishErrors.push(`Default relays: ${errorObj.message || 'Unknown error'}`);
        }

        // If no publishing succeeded, throw an error
        if (!publishSuccess) {
          throw new Error(`Failed to publish to any relays: ${publishErrors.join('; ')}`);
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