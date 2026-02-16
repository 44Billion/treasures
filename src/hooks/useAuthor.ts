import { type NostrEvent, type NostrMetadata, NSchema as n } from '@nostrify/nostrify';
import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';
import { TIMEOUTS } from '@/config/timeouts';

export function useAuthor(pubkey: string | undefined) {
  const { nostr } = useNostr();

  return useQuery<{ event?: NostrEvent; metadata?: NostrMetadata; hasProfile?: boolean }>({
    queryKey: ['author', pubkey ?? ''],
    queryFn: async (c) => {
      if (!pubkey) {
        return {};
      }

      let events: NostrEvent[] = [];
      let usedFallback = false;

      try {
        // Use FAST_QUERY timeout for author data to prevent blocking UI
        const signal = AbortSignal.any([c.signal, AbortSignal.timeout(TIMEOUTS.FAST_QUERY)]);
        events = await nostr.query(
          [{ kinds: [0], authors: [pubkey], limit: 1 }],
          { signal }
        );

        // If no event found, try relay.ditto.pub fallback
        if (!events || events.length === 0) {
          console.log(`🔄 [useAuthor] No kind 0 metadata found for ${pubkey.slice(0, 8)}... on selected relay, trying relay.ditto.pub fallback`);

          try {
            // Create a direct connection to relay.ditto.pub for fallback
            const { NRelay1 } = await import('@nostrify/nostrify');
            const fallbackRelay = new NRelay1('wss://relay.ditto.pub');

            const fallbackSignal = AbortSignal.timeout(TIMEOUTS.FAST_QUERY);
            const fallbackEvents = await fallbackRelay.query([{
              kinds: [0],
              authors: [pubkey],
              limit: 1,
            }], { signal: fallbackSignal });

            events = fallbackEvents;
            usedFallback = true;

            if (events.length > 0) {
              console.log(`✅ [useAuthor] Found kind 0 metadata for ${pubkey.slice(0, 8)}... on relay.ditto.pub fallback`);
            } else {
              console.log(`❌ [useAuthor] No kind 0 metadata found for ${pubkey.slice(0, 8)}... on relay.ditto.pub either`);
            }

            // Close the fallback relay connection
            fallbackRelay.close();
          } catch (fallbackError) {
            console.warn(`⚠️ [useAuthor] Fallback to relay.ditto.pub failed for ${pubkey.slice(0, 8)}...:`, fallbackError);
          }
        } else {
          console.log(`✅ [useAuthor] Found kind 0 metadata for ${pubkey.slice(0, 8)}... on selected relay`);
        }

        // If no event found, return empty object (user has no profile)
        // This is a valid state, not an error
        if (!events || events.length === 0) {
          return { hasProfile: false };
        }

        const event = events[0];

        try {
          const metadata = n.json().pipe(n.metadata()).parse(event?.content);
          return { metadata, event, hasProfile: true, usedFallback };
        } catch (parseError) {
          console.warn('Failed to parse metadata for pubkey', pubkey, parseError);
          // Event exists but content is invalid JSON
          return { event, hasProfile: true, usedFallback };
        }
      } catch (error) {
        console.warn('Failed to fetch author data for pubkey', pubkey, error);
        // Network or other error - return empty state
        return { hasProfile: false };
      }
    },
    retry: (failureCount, error) => {
      // Don't retry if it's just a "no profile found" case
      const errorObj = error as { message?: string };
      if (errorObj.message?.includes('No event found') || errorObj.message?.includes('timeout')) {
        return failureCount < 1; // Only retry once for timeouts
      }
      // Retry network errors up to 2 times
      return failureCount < 2;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 3000), // Faster backoff, max 3s
    staleTime: 5 * 60 * 1000, // 5 minutes - cache author data longer
    gcTime: 15 * 60 * 1000, // 15 minutes - keep in memory longer
    // Return cached data while refetching in background
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    // Add a network timeout to prevent hanging
    networkMode: 'online',
    enabled: !!pubkey, // Only run if we have a pubkey
    // Use background refetch to avoid blocking UI
    refetchOnMount: false,
    // Reduce initial loading impact
    placeholderData: { hasProfile: false }, // Provide immediate placeholder
  });
}
