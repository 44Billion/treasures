import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';
import { NostrEvent, NostrFilter } from '@nostrify/nostrify';
import type { Geocache } from '@/types/geocache';
import { isSafari, createSafariNostr } from '@/lib/safariNostr';

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
      console.log('Starting geocache query...');
      
      try {
        // Build filter for geocache events
        const filter: NostrFilter = {
          kinds: [37515], // Geocache listing events
          limit: options.limit || (isSafari() ? 20 : 50), // Smaller limit for Safari
        };

        if (options.authorPubkey) {
          filter.authors = [options.authorPubkey];
        }

        console.log('Filter:', filter);
        
        let events: NostrEvent[];
        
        if (isSafari()) {
          console.log('Using Safari-specific Nostr client...');
          const safariClient = createSafariNostr([
            'wss://relay.damus.io',
            'wss://nos.lol',
            'wss://relay.nostr.band'
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
        
        console.log('Raw events from query:', events.length, 'events');
        
        // Parse and filter geocaches
        let geocaches: Geocache[] = events
          .map(parseGeocacheEvent)
          .filter((g): g is Geocache => g !== null);
        
        console.log('Found', geocaches.length, 'geocaches after parsing');

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
              kinds: [37516], // Geocache log events
              '#a': limitedCaches.map(g => `37515:${g.pubkey}:${g.dTag}`),
              limit: isSafari() ? 100 : 500,
            };

            let logEvents: NostrEvent[];
            
            if (isSafari()) {
              const safariClient = createSafariNostr([
                'wss://relay.damus.io',
                'wss://nos.lol'
              ]);
              
              try {
                logEvents = await safariClient.query([logFilter], { timeout: 4000, maxRetries: 1 });
                safariClient.close();
              } catch (error) {
                safariClient.close();
                console.warn('Safari log query failed:', error);
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
              
              const data = parseLogData(event);
              if (data) {
                const current = logCounts.get(aTag) || { total: 0, found: 0 };
                current.total++;
                if (data.type === 'found') current.found++;
                logCounts.set(aTag, current);
              }
            });

            // Add counts to geocaches
            geocaches = geocaches.map(g => {
              const coord = `37515:${g.pubkey}:${g.dTag}`;
              const counts = logCounts.get(coord) || { total: 0, found: 0 };
              return {
                ...g,
                logCount: counts.total,
                foundCount: counts.found,
              };
            });
          } catch (error) {
            console.warn('Error fetching log counts:', error);
            // Continue without log counts if there's an error
          }
        }

        return geocaches;
      } catch (error) {
        console.error('Error in geocache query:', error);
        throw error;
      }
    },
  });
}

function parseGeocacheEvent(event: NostrEvent): Geocache | null {
  try {
    // Only process kind 37515 events
    if (event.kind !== 37515) return null;
    
    const dTag = event.tags.find(t => t[0] === 'd')?.[1];
    if (!dTag) return null;

    // Parse from tags
    const name = event.tags.find(t => t[0] === 'name')?.[1];
    const difficulty = event.tags.find(t => t[0] === 'difficulty')?.[1];
    const terrain = event.tags.find(t => t[0] === 'terrain')?.[1];
    const size = event.tags.find(t => t[0] === 'size')?.[1];
    const cacheType = event.tags.find(t => t[0] === 'cache-type')?.[1];
    const hint = event.tags.find(t => t[0] === 'hint')?.[1];
    const locationTag = event.tags.find(t => t[0] === 'location')?.[1];
    const images = event.tags.filter(t => t[0] === 'image').map(t => t[1]);

    // Validate required fields
    if (!name || !locationTag || !difficulty || !terrain || !size || !cacheType) {
      console.warn('Geocache event missing required tags:', { name, locationTag, difficulty, terrain, size, cacheType });
      return null;
    }

    // Parse location from tag
    const [latStr, lngStr] = locationTag.split(',').map(s => s.trim());
    const location = {
      lat: parseFloat(latStr),
      lng: parseFloat(lngStr)
    };

    // Validate coordinates
    if (isNaN(location.lat) || isNaN(location.lng) ||
        location.lat < -90 || location.lat > 90 || 
        location.lng < -180 || location.lng > 180) {
      console.warn(`Geocache "${name}" has invalid coordinates:`, location);
      return null;
    }

    return {
      id: event.id,
      pubkey: event.pubkey,
      created_at: event.created_at,
      dTag: dTag,
      name: name,
      description: event.content, // Description is in content field
      hint: hint,
      location: location,
      difficulty: parseInt(difficulty) || 1,
      terrain: parseInt(terrain) || 1,
      size: size as "micro" | "small" | "regular" | "large",
      type: cacheType as "traditional" | "multi" | "mystery" | "earth" | "virtual" | "letterbox" | "event",
      images: images,
    };
  } catch (error) {
    console.error('Failed to parse geocache event:', error, event);
    return null;
  }
}

function parseLogData(event: NostrEvent): { type: string } | null {
  // Get type from tags
  const logType = event.tags.find(t => t[0] === 'log-type')?.[1];
  if (logType) {
    return { type: logType };
  }
  
  console.warn('Log event missing log-type tag');
  return null;
}