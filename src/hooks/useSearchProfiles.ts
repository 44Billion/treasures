import { useMemo } from 'react';
import { useNostr } from '@nostrify/react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { NSchema as n } from '@nostrify/nostrify';
import type { NostrEvent, NostrMetadata } from '@nostrify/nostrify';
import { useDebounce } from '@/hooks/useDebounce';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { TIMEOUTS } from '@/config/timeouts';

export interface SearchProfile {
  pubkey: string;
  metadata: NostrMetadata;
  event: NostrEvent;
}

/**
 * Search cached author profiles in the TanStack Query cache.
 * Scans all ['author', pubkey] entries for name/display_name/nip05 matches.
 */
function searchCachedProfiles(
  queryClient: ReturnType<typeof useQueryClient>,
  query: string,
  limit: number = 10,
): SearchProfile[] {
  const lowerQuery = query.toLowerCase();
  const results: SearchProfile[] = [];

  const cache = queryClient.getQueryCache().findAll({ queryKey: ['author'] });

  for (const entry of cache) {
    const data = entry.state.data as { event?: NostrEvent; metadata?: NostrMetadata } | undefined;
    if (!data?.event || !data?.metadata) continue;

    const { metadata, event } = data;
    const name = metadata.name?.toLowerCase() ?? '';
    const displayName = metadata.display_name?.toLowerCase() ?? '';
    const nip05 = metadata.nip05?.toLowerCase() ?? '';

    if (name.includes(lowerQuery) || displayName.includes(lowerQuery) || nip05.includes(lowerQuery)) {
      results.push({ pubkey: event.pubkey, metadata, event });
    }
  }

  // Sort alphabetically by name
  results.sort((a, b) => {
    const aName = (a.metadata.display_name || a.metadata.name || '').toLowerCase();
    const bName = (b.metadata.display_name || b.metadata.name || '').toLowerCase();
    return aName.localeCompare(bName);
  });

  return results.slice(0, limit);
}

/** Search for profiles by username/nip05 using NIP-50 search. */
export function useSearchProfiles(query: string) {
  const { nostr } = useNostr();
  const queryClient = useQueryClient();
  const { user } = useCurrentUser();

  const debouncedQuery = useDebounce(query, 300);

  // Fetch the current user's follow list (kind 3)
  const { data: followData } = useQuery({
    queryKey: ['follow-list', user?.pubkey ?? ''],
    queryFn: async ({ signal }) => {
      if (!user) return [];
      const [event] = await nostr.query(
        [{ kinds: [3], authors: [user.pubkey], limit: 1 }],
        { signal: AbortSignal.any([signal, AbortSignal.timeout(TIMEOUTS.QUERY)]) },
      );
      if (!event) return [];
      return event.tags.filter(([name]) => name === 'p').map(([, pk]) => pk);
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  const followedPubkeys = useMemo(
    () => new Set(followData ?? []),
    [followData],
  );

  const relayResults = useQuery<SearchProfile[]>({
    queryKey: ['search-profiles', debouncedQuery],
    queryFn: async ({ signal }) => {
      if (!debouncedQuery.trim()) return [];

      const events = await nostr.query(
        [{ kinds: [0], search: debouncedQuery.trim(), limit: 10 }],
        { signal: AbortSignal.any([signal, AbortSignal.timeout(TIMEOUTS.QUERY)]) },
      );

      const profiles: SearchProfile[] = [];

      for (const event of events) {
        try {
          const metadata = n.json().pipe(n.metadata()).parse(event.content);
          profiles.push({ pubkey: event.pubkey, metadata, event });
        } catch {
          // Skip invalid metadata
        }
      }

      // Deduplicate by pubkey (keep latest event)
      const seen = new Map<string, SearchProfile>();
      for (const profile of profiles) {
        const existing = seen.get(profile.pubkey);
        if (!existing || profile.event.created_at > existing.event.created_at) {
          seen.set(profile.pubkey, profile);
        }
      }

      return Array.from(seen.values());
    },
    enabled: debouncedQuery.trim().length >= 1,
    staleTime: 30 * 1000,
    placeholderData: (prev) => prev,
  });

  // Sort followed profiles first, fall back to cache when relay returns nothing
  const data = useMemo(() => {
    const relayData = relayResults.data;

    const sortByFollowed = (profiles: SearchProfile[]) =>
      [...profiles].sort((a, b) => {
        const aFollowed = followedPubkeys.has(a.pubkey) ? 0 : 1;
        const bFollowed = followedPubkeys.has(b.pubkey) ? 0 : 1;
        return aFollowed - bFollowed;
      });

    if (relayData && relayData.length > 0) {
      return sortByFollowed(relayData);
    }

    if (debouncedQuery.trim().length >= 1) {
      return sortByFollowed(searchCachedProfiles(queryClient, debouncedQuery.trim()));
    }

    return relayData;
  }, [relayResults.data, debouncedQuery, queryClient, followedPubkeys]);

  return {
    ...relayResults,
    data,
    followedPubkeys,
  };
}
