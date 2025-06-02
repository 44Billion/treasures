import { useMemo } from 'react';
import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';
import { NostrEvent, NostrFilter } from '@nostrify/nostrify';
import type { Geocache } from '@/types/geocache';
import { isSafari, createSafariNostr } from '@/lib/safariNostr';
import type { ComparisonOperator } from '@/components/ui/comparison-filter';
import { 
  NIP_GC_KINDS, 
  parseGeocacheEvent, 
  parseLogEvent, 
  createGeocacheCoordinate 
} from '@/lib/nip-gc';

interface UseGeocachesOptions {
  limit?: number;
  search?: string;
  difficulty?: number;
  difficultyOperator?: ComparisonOperator;
  terrain?: number;
  terrainOperator?: ComparisonOperator;
  authorPubkey?: string;
}

export function useAdvancedGeocaches(options: UseGeocachesOptions = {}) {
  const { nostr } = useNostr();
  
  const queryKey = useMemo(() => [
    'geocaches-advanced', 
    options, 
    isSafari()
  ], [options]);

  return useQuery({
    queryKey,
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
        
        
        // Parse and filter geocaches using consolidated utility
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

        // Apply comparison filters for difficulty
        if (options.difficulty !== undefined && options.difficultyOperator && options.difficultyOperator !== 'all') {
          geocaches = geocaches.filter(g => 
            applyComparison(g.difficulty, options.difficultyOperator!, options.difficulty!)
          );
        }

        // Apply comparison filters for terrain
        if (options.terrain !== undefined && options.terrainOperator && options.terrainOperator !== 'all') {
          geocaches = geocaches.filter(g => 
            applyComparison(g.terrain, options.terrainOperator!, options.terrain!)
          );
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
              '#a': limitedCaches.map(g => createGeocacheCoordinate(g.pubkey, g.dTag)),
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
              const coord = createGeocacheCoordinate(g.pubkey, g.dTag);
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

function applyComparison(value: number, operator: ComparisonOperator, target: number): boolean {
  switch (operator) {
    case 'eq':
      return value === target;
    case 'gt':
      return value > target;
    case 'gte':
      return value >= target;
    case 'lt':
      return value < target;
    case 'lte':
      return value <= target;
    case 'all':
    default:
      return true;
  }
}


// parseGeocacheEvent and parseLogEvent are now imported from @/lib/nip-gc
