import { type NostrEvent, type NostrMetadata, NSchema as n } from '@nostrify/nostrify';
import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';
import { TIMEOUTS } from '@/shared/config/timeouts';

export function useAuthor(pubkey: string | undefined) {
  const { nostr } = useNostr();

  return useQuery<{ event?: NostrEvent; metadata?: NostrMetadata; hasProfile?: boolean }>({
    queryKey: ['author', pubkey ?? ''],
    queryFn: async (c) => {
      if (!pubkey) {
        return {};
      }

      try {
        const signal = AbortSignal.any([c.signal, AbortSignal.timeout(TIMEOUTS.QUERY)]);
        const events = await nostr.query(
          [{ kinds: [0], authors: [pubkey], limit: 1 }],
          { signal }
        );

        // If no event found, return empty object (user has no profile)
        // This is a valid state, not an error
        if (!events || events.length === 0) {
          return { hasProfile: false };
        }

        const event = events[0];

        try {
          const metadata = n.json().pipe(n.metadata()).parse(event?.content);
          return { metadata, event, hasProfile: true };
        } catch (parseError) {
          console.warn('Failed to parse metadata for pubkey', pubkey, parseError);
          // Event exists but content is invalid JSON
          return { event, hasProfile: true };
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
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000), // Exponential backoff, max 5s
    staleTime: 5 * 60 * 1000, // 5 minutes - cache author data longer
    gcTime: 15 * 60 * 1000, // 15 minutes - keep in memory longer
    // Return cached data while refetching in background
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    // Add a network timeout to prevent hanging
    networkMode: 'online',
    enabled: !!pubkey, // Only run if we have a pubkey
  });
}
