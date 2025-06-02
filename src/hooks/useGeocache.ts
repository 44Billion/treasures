import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';
import { NostrEvent, NostrFilter } from '@nostrify/nostrify';
import type { Geocache } from '@/types/geocache';
import { isSafari, createSafariNostr } from '@/lib/safariNostr';
import { 
  NIP_GC_KINDS, 
  parseGeocacheEvent, 
  parseLogEvent, 
  createGeocacheCoordinate 
} from '@/lib/nip-gc';

export function useGeocache(id: string) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['geocache', id, isSafari()],
    queryFn: async (c) => {
      
      try {
        // Create signal for non-Safari queries
        const signal = AbortSignal.any([c.signal, AbortSignal.timeout(8000)]);
        
        // Primary strategy: Direct ID lookup
        const filter: NostrFilter = {
          ids: [id],
          kinds: [37515], // Geocache listing events
          limit: 1,
        };

        let events: NostrEvent[];
        
        if (isSafari()) {
          const safariClient = createSafariNostr([
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
          const safariClient = createSafariNostr([
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

          id: result.id.slice(0, 8),
          name: result.name,
          logCount: result.logCount,
          foundCount: result.foundCount
        });

        return result;
      } catch (error) {
        throw error;
      }
    },
    enabled: !!id,
    retry: 2, // Reduced retry attempts
    retryDelay: 1000, // Fixed 1 second delay 
    staleTime: 30000, // 30 seconds
    gcTime: 300000, // 5 minutes
    refetchOnWindowFocus: false,
  });
}


// parseGeocacheEvent is now imported from @/lib/nip-gc
