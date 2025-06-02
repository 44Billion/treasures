import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';
import { NostrEvent, NostrFilter } from '@nostrify/nostrify';
import type { Geocache } from '@/types/geocache';
import { decodeHint } from '@/lib/rot13';
import { isSafari, createSafariNostr } from '@/lib/safariNostr';
import { 
  NIP_GC_KINDS, 
  parseGeocacheEvent, 
  parseLogEvent, 
  createGeocacheCoordinate 
} from '@/lib/nip-gc';

// Simple heuristic to detect if text is likely ROT13 encoded
// ROT13 encoded text often has unusual character patterns
function isRot13Encoded(text: string): boolean {
  // If the text contains common English words, it's probably not encoded
  const commonWords = ['the', 'and', 'to', 'of', 'a', 'in', 'is', 'it', 'you', 'that', 'he', 'was', 'for', 'on', 'are', 'as', 'with', 'his', 'they', 'i', 'at', 'be', 'this', 'have', 'from', 'or', 'one', 'had', 'by', 'word', 'but', 'not', 'what', 'all'];
  const lowerText = text.toLowerCase();
  
  const foundCommonWords = commonWords.filter(word => 
    lowerText.includes(word) || lowerText.includes(' ' + word + ' ')
  ).length;
  
  // If we find multiple common English words, it's likely plaintext
  if (foundCommonWords >= 2) {
    return false;
  }
  
  // If it's a very short hint (under 5 chars), assume plaintext
  if (text.length < 5) {
    return false;
  }
  
  // Otherwise, assume it might be encoded (this is a conservative approach)
  // We could improve this heuristic later
  return true;
}

export function useGeocacheByDTag(dTag: string) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['geocache-by-dtag', dTag, isSafari()],
    queryFn: async (c) => {
      
      try {
        // Create signal for non-Safari queries
        const signal = AbortSignal.any([c.signal, AbortSignal.timeout(8000)]);
        
        // Query by d-tag - this is the stable identifier
        const filter: NostrFilter = {
          kinds: [37515], // Geocache listing events
          '#d': [dTag], // Find by d-tag
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

          dTag: result.dTag,
          name: result.name,
          logCount: result.logCount,
          foundCount: result.foundCount
        });

        return result;
      } catch (error) {
        throw error;
      }
    },
    enabled: !!dTag,
    retry: 2, // Reduced retry attempts
    retryDelay: 1000, // Fixed 1 second delay 
    staleTime: 30000, // 30 seconds
    gcTime: 300000, // 5 minutes
    refetchOnWindowFocus: false,
  });
}


// parseGeocacheEvent is now imported from @/lib/nip-gc
