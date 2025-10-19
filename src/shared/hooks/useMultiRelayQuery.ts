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
        console.log(`🔄 [MultiRelay] Trying relay ${i + 1}/${PRESET_RELAYS.length}: ${relay.name} (${relayUrl})`);
        
        // Create direct connection to this relay
        const { NRelay1 } = await import('@nostrify/nostrify');
        const fallbackRelay = new NRelay1(relayUrl);
        
        try {
          const signal = AbortSignal.timeout(timeout);
          const events = await fallbackRelay.query(filters, { signal });
          
          // Close the relay connection
          fallbackRelay.close();
          
          if (events && events.length > 0) {
            console.log(`✅ [MultiRelay] Found ${events.length} events on ${relay.name}`);
            return { events, successRelay: relayUrl };
          } else {
            console.log(`⚪ [MultiRelay] No events found on ${relay.name}`);
          }
        } catch (queryError) {
          console.warn(`❌ [MultiRelay] Query failed on ${relay.name}:`, queryError);
          fallbackRelay.close();
          // Continue to next relay
        }
      } catch (connectionError) {
        console.warn(`❌ [MultiRelay] Connection failed to ${relay.name}:`, connectionError);
        // Continue to next relay
      }
    }
    
    console.log(`❌ [MultiRelay] All ${PRESET_RELAYS.length} relays exhausted, no events found`);
    return { events: [] };
  }, []);

  return { queryMultipleRelays };
}