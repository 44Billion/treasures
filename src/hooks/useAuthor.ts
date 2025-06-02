import { type NostrEvent, type NostrMetadata, NSchema as n } from '@nostrify/nostrify';
import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';

export function useAuthor(pubkey: string | undefined) {
  const { nostr } = useNostr();

  return useQuery<{ event?: NostrEvent; metadata?: NostrMetadata; hasProfile?: boolean }>({
    queryKey: ['author', pubkey ?? ''],
    queryFn: async ({ signal }) => {
      if (!pubkey) {
        return {};
      }

      const [event] = await nostr.query(
        [{ kinds: [0], authors: [pubkey!], limit: 1 }],
        { signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]) }, // Increased to 5s for better success rate
      );

      // If no event found, return empty object (user has no profile)
      // This is a valid state, not an error
      if (!event) {
        return { hasProfile: false };
      }

      try {
        const metadata = n.json().pipe(n.metadata()).parse(event.content);
        return { metadata, event, hasProfile: true };
      } catch {
        // Event exists but content is invalid JSON
        return { event, hasProfile: true };
      }
    },
    retry: (failureCount, error) => {
      // Don't retry if it's just a "no profile found" case
      const errorObj = error as { message?: string };
      if (errorObj.message?.includes('No event found')) {
        return false;
      }
      // Retry network errors up to 2 times
      return failureCount < 2;
    },
    retryDelay: 1000, // 1 second delay between retries
    staleTime: 5 * 60 * 1000, // 5 minutes - cache author data longer
    gcTime: 15 * 60 * 1000, // 15 minutes - keep in memory longer
    // Return cached data while refetching in background
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    // Add a network timeout to prevent hanging
    networkMode: 'online',
  });
}
