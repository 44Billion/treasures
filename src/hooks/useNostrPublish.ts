import { useNostr } from "@nostrify/react";
import { useMutation } from "@tanstack/react-query";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { TIMEOUTS } from "@/config";
import { hapticSuccess, hapticError } from "@/utils/haptics";
import { ensureClientTag } from "@/lib/clientTag";
import { resilientPublish } from "@/lib/resilientPublish";

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
        const tags = [...(t.tags ?? [])];

        // Add the NIP-89 client tag if one isn't already present. Dev builds
        // (http://) are intentionally skipped — see `getClientTag`.
        ensureClientTag(tags);

        // Sign the event
        const event = await user.signer.signEvent({
          kind: t.kind,
          content: t.content ?? "",
          tags,
          created_at: t.created_at ?? Math.floor(Date.now() / 1000),
        });

        // Send to relays with retry + offline queueing (shared primitive).
        const { status } = await resilientPublish(nostr, event);

        // If the event was queued for offline delivery, there's nothing to
        // verify yet — report success so the offline flush can deliver later.
        if (status === 'queued') {
          return event;
        }

        // Verify the event was published by querying for it
        console.log('[useNostrPublish] Verifying event publication', { eventId: event.id });
        const verifyStartTime = Date.now();
        try {
          const verification = await nostr.query(
            [{ ids: [event.id] }],
            { signal: AbortSignal.timeout(TIMEOUTS.FAST_QUERY) }
          );
          const verifyDuration = Date.now() - verifyStartTime;

          if (verification.length === 0) {
            console.warn('[useNostrPublish] Event not found in verification query', {
              eventId: event.id,
              duration: verifyDuration
            });
          } else {
            console.log('[useNostrPublish] Event successfully verified', {
              eventId: event.id,
              duration: verifyDuration
            });
          }
        } catch (verifyError) {
          const verifyDuration = Date.now() - verifyStartTime;
          console.warn('[useNostrPublish] Verification query failed', {
            eventId: event.id,
            error: verifyError,
            duration: verifyDuration
          });
        }

        return event; // Return the signed event
      } catch (error: unknown) {
        const errorObj = error as { message?: string };
        const errorMessage = errorObj.message || 'Unknown error';
        
        // Handle signing and other errors
        if (errorMessage.includes("User rejected") || 
            errorMessage.includes("cancelled") || 
            errorMessage.includes("denied") ||
            errorMessage.includes("user denied") ||
            errorMessage.includes("user cancelled") ||
            errorMessage.includes("user rejected")) {
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
      hapticError();
    },
    onSuccess: (data) => {
      console.log('Event published successfully:', data.id);
      hapticSuccess();
    },
  });
}