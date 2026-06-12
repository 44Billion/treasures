import { useCallback } from 'react';
import { PRESET_RELAYS } from '@/lib/appRelays';
import { TIMEOUTS } from '@/config/timeouts';
import type { NostrEvent } from '@nostrify/nostrify';

interface MultiRelayQueryOptions {
  onRelayAttempt?: (relayUrl: string, attempt: number) => void;
  timeout?: number;
  /**
   * Extra relays to iterate over in addition to PRESET_RELAYS.
   * Typically the viewing user's NIP-65 relays (config.relayMetadata.relays).
   * Duplicates with PRESET_RELAYS are removed (normalized by URL).
   */
  extraRelays?: { url: string; name?: string }[];
}

/** Normalize a relay URL for deduplication (lowercase, strip trailing slash). */
function normalizeRelayUrl(url: string): string {
  return url.toLowerCase().replace(/\/+$/, '');
}

/**
 * Build the ordered, deduplicated list of relays to attempt:
 * PRESET_RELAYS first, then any extra (user) relays not already present.
 */
export function buildMultiRelayList(
  extraRelays: { url: string; name?: string }[] = [],
): { url: string; name: string; source: 'preset' | 'user' }[] {
  const seen = new Set<string>();
  const result: { url: string; name: string; source: 'preset' | 'user' }[] = [];

  for (const relay of PRESET_RELAYS) {
    const norm = normalizeRelayUrl(relay.url);
    if (seen.has(norm)) continue;
    seen.add(norm);
    result.push({ url: relay.url, name: relay.name, source: 'preset' });
  }

  for (const relay of extraRelays) {
    if (!relay?.url) continue;
    const norm = normalizeRelayUrl(relay.url);
    if (seen.has(norm)) continue;
    seen.add(norm);
    // Derive a friendly short name from the host if none provided
    let name = relay.name;
    if (!name) {
      try {
        name = new URL(relay.url).host;
      } catch {
        name = relay.url;
      }
    }
    result.push({ url: relay.url, name, source: 'user' });
  }

  return result;
}

/**
 * Hook for querying multiple relays with fallback logic.
 * Iterates over PRESET_RELAYS and, optionally, the viewing user's own relays
 * (passed via `extraRelays`). Used when the primary relay doesn't have the data.
 */
export function useMultiRelayQuery() {
  const queryMultipleRelays = useCallback(async (
    filters: any[],
    options: MultiRelayQueryOptions = {}
  ): Promise<{ events: NostrEvent[], successRelay?: string }> => {
    const { onRelayAttempt, timeout = TIMEOUTS.QUERY, extraRelays = [] } = options;

    const relayList = buildMultiRelayList(extraRelays);

    for (let i = 0; i < relayList.length; i++) {
      const relay = relayList[i]!;
      const relayUrl = relay.url;

      // Notify about relay attempt
      onRelayAttempt?.(relayUrl, i + 1);

      try {
        // Create direct connection to this relay
        const { NRelay1 } = await import('@nostrify/nostrify');
        const fallbackRelay = new NRelay1(relayUrl);

        try {
          const signal = AbortSignal.timeout(timeout);
          const events = await fallbackRelay.query(filters, { signal });

          // Close the relay connection
          fallbackRelay.close();

          if (events && events.length > 0) {
            console.log(`✅ Found geocache on ${relay.name} relay`);
            return { events, successRelay: relayUrl };
          }
          // No events found - continue to next relay silently
        } catch (queryError) {
          // Silently continue to next relay - don't log individual errors
          // The final error screen will handle the case when all relays fail
          fallbackRelay.close();
          // Continue to next relay
        }
      } catch (connectionError) {
        // Silently continue to next relay - don't log individual errors
        // The final error screen will handle the case when all relays fail
        // Continue to next relay
      }
    }

    console.log(`No geocache found on any of the ${relayList.length} relays`);
    return { events: [] };
  }, []);

  return { queryMultipleRelays };
}
