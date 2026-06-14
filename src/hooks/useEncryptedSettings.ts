import { useRef } from 'react';
import { useNostr } from '@nostrify/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { NostrFilter } from '@nostrify/nostrify';

import { useCurrentUser } from './useCurrentUser';
import { fetchFreshEvent } from '@/lib/fetchFreshEvent';
import { ensureClientTag } from '@/lib/clientTag';
import { EncryptedSettingsSchema, type EncryptedSettings } from '@/lib/schemas';
import { TIMEOUTS } from '@/config';

/** NIP-78 (kind 30078) addressable application-data event. */
const SETTINGS_KIND = 30078;
/** `d` tag identifying the single Treasures metadata event. */
const SETTINGS_D_TAG = 'treasures/metadata';

/**
 * Timestamp (ms) of the last local encrypted-settings write this session.
 * Consumers that mirror relay state can use this to avoid overwriting a local
 * edit with a stale relay event.
 */
let lastWriteTs: number = 0;

/**
 * Manage cross-device app settings using NIP-78 (kind 30078).
 *
 * Settings are stored in a single addressable event under the
 * `treasures/metadata` `d` tag, with the content NIP-44 encrypted to the user
 * themselves. This keeps settings (e.g. the notification read cursor) private
 * while syncing them across devices.
 *
 * Requires a signer with NIP-44 support (`user.signer.nip44`). When the signer
 * does not support NIP-44, reads/writes are no-ops and `hasNip44Support` is
 * false.
 */
export function useEncryptedSettings() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();

  // Query the raw encrypted settings event.
  const query = useQuery({
    queryKey: ['encryptedSettings', user?.pubkey],
    queryFn: async (c) => {
      if (!user) return null;

      const filter: NostrFilter = {
        kinds: [SETTINGS_KIND],
        authors: [user.pubkey],
        '#d': [SETTINGS_D_TAG],
        limit: 1,
      };

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(TIMEOUTS.QUERY)]);
      const events = await nostr.query([filter], { signal });
      if (events.length === 0) return null;

      // Most recent wins if multiple relays disagree.
      return events.reduce((latest, current) =>
        current.created_at > latest.created_at ? current : latest,
      );
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes — window-focus refetch picks up cross-device changes
    gcTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: true,
    refetchOnReconnect: false,
  });

  // Decrypt + parse the settings from the event content.
  const settings = useQuery({
    queryKey: ['parsedSettings', query.data?.id],
    queryFn: async () => {
      const event = query.data;
      if (!event || !user) return null;

      if (!event.content || !user.signer.nip44) {
        return null;
      }

      try {
        const decrypted = await user.signer.nip44.decrypt(user.pubkey, event.content);
        const json = JSON.parse(decrypted);
        const result = EncryptedSettingsSchema.safeParse(json);
        if (!result.success) {
          console.warn('Encrypted settings failed validation, using partial data:', result.error.issues);
          // Return whatever is there rather than wiping everything.
          return (json ?? {}) as EncryptedSettings;
        }
        return result.data as EncryptedSettings;
      } catch (error) {
        console.error('Failed to decrypt settings:', error);
        return null;
      }
    },
    enabled: !!query.data && !!user,
    staleTime: 0, // Always re-derive when the upstream event changes
    gcTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  // Tracks the latest optimistic settings so rapid successive mutations don't
  // overwrite each other by reading stale cache data.
  const pendingSettings = useRef<EncryptedSettings | null>(null);

  const updateSettings = useMutation({
    mutationFn: async (patch: Partial<EncryptedSettings>) => {
      if (!user) throw new Error('User not logged in');
      if (!user.signer.nip44) throw new Error('NIP-44 encryption not supported by signer');

      // Prefer the latest pending settings (rapid successive mutations).
      // Otherwise fetch fresh from relays to avoid cross-device stale reads.
      let currentSettings: EncryptedSettings;
      if (pendingSettings.current) {
        currentSettings = pendingSettings.current;
      } else {
        const freshEvent = await fetchFreshEvent(nostr, {
          kinds: [SETTINGS_KIND],
          authors: [user.pubkey],
          '#d': [SETTINGS_D_TAG],
        });
        if (freshEvent?.content) {
          try {
            const decrypted = await user.signer.nip44.decrypt(user.pubkey, freshEvent.content);
            const json = JSON.parse(decrypted);
            const result = EncryptedSettingsSchema.safeParse(json);
            currentSettings = result.success
              ? (result.data as EncryptedSettings)
              : ((json ?? {}) as EncryptedSettings);
          } catch {
            currentSettings = settings.data ?? {};
          }
        } else {
          currentSettings = settings.data ?? {};
        }
      }

      const updatedSettings: EncryptedSettings = {
        ...currentSettings,
        ...patch,
        lastSync: Date.now(),
      };

      // Optimistically track so the next rapid mutation sees this immediately.
      pendingSettings.current = updatedSettings;

      const plaintext = JSON.stringify(updatedSettings);
      const encrypted = await user.signer.nip44.encrypt(user.pubkey, plaintext);

      const tags: string[][] = [['d', SETTINGS_D_TAG]];
      ensureClientTag(tags);

      const unsignedEvent = {
        kind: SETTINGS_KIND,
        content: encrypted,
        tags,
        created_at: Math.floor(Date.now() / 1000),
      };

      const signedEvent = await user.signer.signEvent(unsignedEvent);

      // Mark that we just wrote so any relay-mirroring logic can skip us.
      lastWriteTs = Date.now();

      // Publish in the background.
      nostr.event(signedEvent, { signal: AbortSignal.timeout(TIMEOUTS.PUBLISH) }).catch((error) => {
        console.error('Failed to publish encrypted settings:', error);
      });

      return { updatedSettings, signedEvent };
    },
    // Update the cache in-place instead of invalidating, which would trigger a
    // relay refetch that can return the OLD event before the new one propagates
    // and clobber the value the user just set. Key the parsed cache by the new
    // signed event id so the derived query picks it up.
    onSuccess: ({ updatedSettings, signedEvent }) => {
      queryClient.setQueryData(['encryptedSettings', user?.pubkey], signedEvent);
      queryClient.setQueryData(['parsedSettings', signedEvent.id], updatedSettings);
      pendingSettings.current = null;
    },
  });

  // Initialize settings if they don't exist yet.
  const initializeSettings = async (initialSettings: Partial<EncryptedSettings>) => {
    if (settings.data !== null || !user?.signer.nip44) {
      return; // Already initialized or no encryption support
    }
    try {
      await updateSettings.mutateAsync(initialSettings);
    } catch (error) {
      console.warn('Failed to initialize encrypted settings:', error);
    }
  };

  return {
    settings: settings.data,
    isLoading: query.isLoading || settings.isLoading,
    isError: query.isError || settings.isError,
    error: query.error || settings.error,
    updateSettings,
    initializeSettings,
    hasNip44Support: !!user?.signer.nip44,
    lastSync: settings.data?.lastSync,
    /** True if a local write happened in the last 10s. */
    recentlyWritten: () => Date.now() - lastWriteTs < 10_000,
  };
}
