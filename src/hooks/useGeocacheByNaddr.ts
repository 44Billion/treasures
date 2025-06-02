import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';
import { NostrEvent, NostrFilter } from '@nostrify/nostrify';
import type { Geocache } from '@/types/geocache';
import { parseNaddr } from '@/lib/naddr-utils';
import { isSafari, createSafariNostr } from '@/lib/safariNostr';
import { 
  NIP_GC_KINDS, 
  parseGeocacheEvent, 
  createGeocacheCoordinate 
} from '@/lib/nip-gc';

export function useGeocacheByNaddr(naddr: string) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['geocache-by-naddr', naddr, isSafari()],
    queryFn: async (c) => {
      
      try {
        // Parse the naddr to get pubkey and dTag
        const parsed = parseNaddr(naddr);
        if (!parsed) {
          throw new Error('Invalid naddr format');
        }
        
        const { pubkey, dTag, relays } = parsed;
        
        // Create signal for non-Safari queries
        const signal = AbortSignal.any([c.signal, AbortSignal.timeout(8000)]);
        
        // Query by pubkey and d-tag
        const filter: NostrFilter = {
          kinds: [37515], // Geocache listing events
          authors: [pubkey],
          '#d': [dTag],
          limit: 1,
        };

        let events: NostrEvent[];
        
        if (isSafari()) {
          const safariClient = createSafariNostr(relays || [
            'wss://ditto.pub/relay'
          ]);
          
          try {
            events = await safariClient.query([filter], { timeout: 5000, maxRetries: 2 });
            safariClient.close();
          } catch (error) {
            safariClient.close();
            throw error;
          }
        } else {
          events = await nostr.query([filter], { signal });
        }
        

        if (events.length === 0) {
          return null;
        }

        const geocache = parseGeocacheEvent(events[0]);
        if (!geocache) {
          return null;
        }


        // Quick log count fetch
        
        // Get logs for this specific geocache
        const logFilter: NostrFilter = {
          kinds: [NIP_GC_KINDS.LOG],
          '#a': [createGeocacheCoordinate(geocache.pubkey, geocache.dTag)],
          limit: isSafari() ? 50 : 200, // Smaller limit for Safari
        };

        let logEvents: NostrEvent[];
        
        if (isSafari()) {
          const safariClient = createSafariNostr(relays || [
            'wss://ditto.pub/relay'
          ]);
          
          try {
            logEvents = await safariClient.query([logFilter], { timeout: 4000, maxRetries: 1 });
            safariClient.close();
          } catch (error) {
            safariClient.close();
            logEvents = [];
          }
        } else {
          logEvents = await nostr.query([logFilter], { signal });
        }
      
        let foundCount = 0;
        const logCount = logEvents.length;
        
        logEvents.forEach(event => {
          // Get type from tags
          const logType = event.tags.find(t => t[0] === 'log-type')?.[1];
          if (logType === 'found') {
            foundCount++;
          }
        });

        const result = {
          ...geocache,
          foundCount,
          logCount,
        };

        return result;
      } catch (error) {
        throw error;
      }
    },
    enabled: !!naddr,
    retry: 2, // Reduced retry attempts
    retryDelay: 1000, // Fixed 1 second delay 
    staleTime: 30000, // 30 seconds
    gcTime: 300000, // 5 minutes
    refetchOnWindowFocus: false,
  });
}