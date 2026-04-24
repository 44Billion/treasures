import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useAppContext } from '@/hooks/useAppContext';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { parseBlossomServerList } from '@/lib/appBlossom';
import type { NostrEvent } from '@nostrify/nostrify';

/**
 * NostrSync - Syncs user's Nostr data when logged in.
 *
 * Syncs:
 * - NIP-65 relay list (kind 10002)
 * - NIP-51 search relay list (kind 10007)
 * - BUD-03 Blossom server list (kind 10063)
 */
export function NostrSync() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const { config, updateConfig } = useAppContext();

  // --- NIP-65 relay list (kind 10002) ---

  const { data: relayListEvent } = useQuery<NostrEvent | null>({
    queryKey: ['relayList', user?.pubkey ?? ''],
    queryFn: async ({ signal }) => {
      if (!user) return null;
      const events = await nostr.query(
        [{ kinds: [10002], authors: [user.pubkey], limit: 1 }],
        { signal },
      );
      return events[0] ?? null;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
  });

  useEffect(() => {
    if (!relayListEvent) return;

    if (relayListEvent.created_at > config.relayMetadata.updatedAt) {
      const fetchedRelays = relayListEvent.tags
        .filter(([name]) => name === 'r')
        .map(([, url, marker]) => ({
          url: url.replace(/\/+$/, ''),
          read: !marker || marker === 'read',
          write: !marker || marker === 'write',
        }));

      if (fetchedRelays.length > 0) {
        updateConfig((current) => ({
          ...current,
          relayMetadata: {
            relays: fetchedRelays,
            updatedAt: relayListEvent.created_at,
          },
        }));
      }
    }
  }, [relayListEvent, config.relayMetadata.updatedAt, updateConfig]);

  // --- NIP-51 search relay list (kind 10007) ---

  const { data: searchRelayListEvent } = useQuery<NostrEvent | null>({
    queryKey: ['searchRelayList', user?.pubkey ?? ''],
    queryFn: async ({ signal }) => {
      if (!user) return null;
      const events = await nostr.query(
        [{ kinds: [10007], authors: [user.pubkey], limit: 1 }],
        { signal },
      );
      return events[0] ?? null;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
  });

  useEffect(() => {
    if (!searchRelayListEvent) return;

    const currentUpdatedAt = config.searchRelayMetadata?.updatedAt ?? 0;
    if (searchRelayListEvent.created_at > currentUpdatedAt) {
      const fetchedRelays = searchRelayListEvent.tags
        .filter(([name]) => name === 'relay')
        .map(([, url]) => url)
        .filter(Boolean);

      updateConfig((current) => ({
        ...current,
        searchRelayMetadata: {
          relays: fetchedRelays,
          updatedAt: searchRelayListEvent.created_at,
        },
      }));
    }
  }, [searchRelayListEvent, config.searchRelayMetadata?.updatedAt, updateConfig]);

  // --- BUD-03 Blossom server list (kind 10063) ---

  const { data: blossomListEvent } = useQuery<NostrEvent | null>({
    queryKey: ['blossomServerList', user?.pubkey ?? ''],
    queryFn: async ({ signal }) => {
      if (!user) return null;
      const events = await nostr.query(
        [{ kinds: [10063], authors: [user.pubkey], limit: 1 }],
        { signal },
      );
      return events[0] ?? null;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
  });

  useEffect(() => {
    if (!blossomListEvent) return;

    if (blossomListEvent.created_at > config.blossomServerMetadata.updatedAt) {
      const servers = parseBlossomServerList(blossomListEvent);

      if (servers.length > 0) {
        updateConfig((current) => ({
          ...current,
          blossomServerMetadata: {
            servers,
            updatedAt: blossomListEvent.created_at,
          },
        }));
      }
    }
  }, [blossomListEvent, config.blossomServerMetadata.updatedAt, updateConfig]);

  return null;
}
