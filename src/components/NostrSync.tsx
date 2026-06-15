import { useNostr } from '@nostrify/react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useAppContext } from '@/hooks/useAppContext';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { parseBlossomServerList } from '@/lib/appBlossom';
import { EncryptedSettingsSchema, type EncryptedSettings } from '@/lib/schemas';
import type { NostrEvent } from '@nostrify/nostrify';

/** NIP-78 (kind 30078) addressable application-data event. */
const SETTINGS_KIND = 30078;
/** `d` tag identifying the single Treasures metadata event. */
const SETTINGS_D_TAG = 'treasures/metadata';

/**
 * NostrSync - Syncs user's Nostr data when logged in.
 *
 * Syncs:
 * - NIP-65 relay list (kind 10002)
 * - NIP-51 search relay list (kind 10007)
 * - BUD-03 Blossom server list (kind 10063)
 * - NIP-78 encrypted app settings (kind 30078, `treasures/metadata`)
 */
export function NostrSync() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const { config, updateConfig } = useAppContext();
  const queryClient = useQueryClient();

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

  // --- NIP-78 encrypted app settings (kind 30078) ---
  //
  // Fetched here on login (mirroring the relay/blossom syncs above) so the
  // value is seeded into the same TanStack Query cache keys that
  // `useEncryptedSettings` reads from. This makes the first settings read
  // (e.g. the notification cursor) instant and avoids a redundant round-trip.

  const { data: settingsEvent } = useQuery<NostrEvent | null>({
    queryKey: ['encryptedSettings', user?.pubkey ?? ''],
    queryFn: async ({ signal }) => {
      if (!user) return null;
      const events = await nostr.query(
        [{ kinds: [SETTINGS_KIND], authors: [user.pubkey], '#d': [SETTINGS_D_TAG], limit: 1 }],
        { signal },
      );
      if (events.length === 0) return null;
      // Most recent wins if multiple relays disagree.
      return events.reduce((latest, current) =>
        current.created_at > latest.created_at ? current : latest,
      );
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
  });

  useEffect(() => {
    if (!settingsEvent || !user) return;
    if (!settingsEvent.content || !user.signer.nip44) return;

    let cancelled = false;

    (async () => {
      try {
        const decrypted = await user.signer.nip44!.decrypt(user.pubkey, settingsEvent.content);
        const json = JSON.parse(decrypted);
        const result = EncryptedSettingsSchema.safeParse(json);
        if (!result.success) {
          console.warn('Encrypted settings failed validation during sync:', result.error.issues);
        }
        const parsed = (result.success ? result.data : (json ?? {})) as EncryptedSettings;

        if (cancelled) return;

        // Seed the parsed-settings cache so `useEncryptedSettings` resolves
        // immediately without re-decrypting.
        queryClient.setQueryData(['parsedSettings', settingsEvent.id], parsed);

        // Mirror the relay toggles into AppConfig so the effective relay set
        // reflects the user's cross-device preference. Only apply when present
        // and different, so we never clobber the local default needlessly.
        updateConfig((current) => {
          const updates: Partial<typeof current> = {};
          let changed = false;
          if (
            typeof parsed.useAppRelays === 'boolean' &&
            parsed.useAppRelays !== current.useAppRelays
          ) {
            updates.useAppRelays = parsed.useAppRelays;
            changed = true;
          }
          if (
            typeof parsed.useUserRelays === 'boolean' &&
            parsed.useUserRelays !== current.useUserRelays
          ) {
            updates.useUserRelays = parsed.useUserRelays;
            changed = true;
          }
          return changed ? { ...current, ...updates } : current;
        });
      } catch (error) {
        console.error('Failed to decrypt settings during sync:', error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [settingsEvent, user, queryClient, updateConfig]);

  return null;
}
