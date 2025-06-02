import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';
import { NostrEvent, NostrFilter } from '@nostrify/nostrify';
import type { Geocache } from '@/types/geocache';
import { isSafari, createSafariNostr } from '@/lib/safariNostr';
import { NIP_GC_KINDS, parseGeocacheEvent, parseLogEvent } from '@/lib/nip-gc';

interface UseGeocachesOptions {
  limit?: number;
  search?: string;
  difficulty?: number;
  terrain?: number;
  authorPubkey?: string;
}

export function useGeocaches(options: UseGeocachesOptions = {}) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['geocaches', options, isSafari()],
    staleTime: 60000, // 1 minute
    gcTime: 300000, // 5 minutes
    queryFn: async () => {
      
      try {
        // Build filter for geocache events
        const filter: NostrFilter = {
          kinds: [NIP_GC_KINDS.GEOCACHE],
          limit: options.limit || (isSafari() ? 20 : 50), // Smaller limit for Safari
        };

        if (options.authorPubkey) {
          filter.authors = [options.authorPubkey];
        }

        
        let events: NostrEvent[];
        
        if (isSafari()) {
          const safariClient = createSafariNostr([
            'wss://ditto.pub/relay'
          ]);
          
          try {
            events = await safariClient.query([filter], { timeout: 6000, maxRetries: 2 });
            safariClient.close();
          } catch (error) {
            safariClient.close();
            throw error;
          }
        } else {
          // Standard query for non-Safari browsers
          events = await Promise.race([
            nostr.query([filter]),
            new Promise<never>((_, reject) => 
              setTimeout(() => reject(new Error('Query timeout')), 15000)
            )
          ]);
        }
        
        
        // Parse and filter geocaches
        let geocaches: Geocache[] = events
          .map(parseGeocacheEvent)
          .filter((g): g is Geocache => g !== null);
        

        // Apply client-side filters
        if (options.search) {
          const searchLower = options.search.toLowerCase();
          geocaches = geocaches.filter(g => 
            g.name.toLowerCase().includes(searchLower) ||
            g.description.toLowerCase().includes(searchLower)
          );
        }

        if (options.difficulty !== undefined) {
          geocaches = geocaches.filter(g => g.difficulty === options.difficulty);
        }

        if (options.terrain !== undefined) {
          geocaches = geocaches.filter(g => g.terrain === options.terrain);
        }

        // Sort by creation date (newest first)
        geocaches.sort((a, b) => b.created_at - a.created_at);

        // Log count fetching with Safari compatibility
        if (geocaches.length > 0) {
          try {
            // Limit the number of caches we query logs for
            const limitedCaches = geocaches.slice(0, isSafari() ? 5 : 10);
            const logFilter: NostrFilter = {
              kinds: [NIP_GC_KINDS.LOG],
              '#a': limitedCaches.map(g => `${NIP_GC_KINDS.GEOCACHE}:${g.pubkey}:${g.dTag}`),
              limit: isSafari() ? 100 : 500,
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
                logEvents = []; // Continue without log counts
              }
            } else {
              logEvents = await Promise.race([
                nostr.query([logFilter]),
                new Promise<never>((_, reject) => 
                  setTimeout(() => reject(new Error('Log query timeout')), 10000)
                )
              ]);
            }
            
            // Count logs per geocache
            const logCounts = new Map<string, { total: number; found: number }>();
            
            logEvents.forEach(event => {
              const aTag = event.tags.find(tag => tag[0] === 'a')?.[1];
              if (!aTag) return;
              
              const log = parseLogEvent(event);
              if (log) {
                const current = logCounts.get(aTag) || { total: 0, found: 0 };
                current.total++;
                if (log.type === 'found') current.found++;
                logCounts.set(aTag, current);
              }
            });

            // Add counts to geocaches
            geocaches = geocaches.map(g => {
              const coord = `${NIP_GC_KINDS.GEOCACHE}:${g.pubkey}:${g.dTag}`;
              const counts = logCounts.get(coord) || { total: 0, found: 0 };
              return {
                ...g,
                logCount: counts.total,
                foundCount: counts.found,
              };
            });
          } catch (error) {
            // Continue without log counts if there's an error
          }
        }

        return geocaches;
      } catch (error) {
        throw error;
      }
    },
  });
}

// parseGeocacheEvent and parseLogEvent are now imported from @/lib/nip-gc