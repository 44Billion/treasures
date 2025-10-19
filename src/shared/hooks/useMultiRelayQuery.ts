import { useCallback } from 'react';
import { PRESET_RELAYS } from '@/shared/config/relays';
import { TIMEOUTS } from '@/shared/config/timeouts';
import type { NostrEvent } from '@nostrify/nostrify';

interface MultiRelayQueryOptions {
  onRelayAttempt?: (relayUrl: string, attempt: number) => void;
  timeout?: number;
}

/**
 * Hook for querying multiple relays with fallback logic
 * Used when primary relay doesn't have the data and user is not the owner
 */
export function useMultiRelayQuery() {
  const queryMultipleRelays = useCallback(async (
    filters: any[],
    options: MultiRelayQueryOptions = {}
  ): Promise<{ events: NostrEvent[], successRelay?: string }> => {
    const { onRelayAttempt, timeout = TIMEOUTS.QUERY } = options;

    // Try each relay in the preset list
    for (let i = 0; i < PRESET_RELAYS.length; i++) {
      const relay = PRESET_RELAYS[i];
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

    console.log(`No geocache found on any of the ${PRESET_RELAYS.length} relays`);
    return { events: [] };
  }, []);

  return { queryMultipleRelays };
}