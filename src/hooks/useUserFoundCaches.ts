import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';
import { NostrEvent, NostrFilter } from '@nostrify/nostrify';
import { useCurrentUser } from './useCurrentUser';
import { useNostrQueryRelays } from './useNostrQueryRelays';
import type { GeocacheLog, Geocache } from '@/types/geocache';

interface FoundCache {
  id: string;
  dTag: string;
  pubkey: string;
  name: string;
  foundAt: number;
  logId: string;
  logText: string;
  location: {
    lat: number;
    lng: number;
  };
  difficulty: number;
  terrain: number;
  size: string;
  type: string;
  foundCount?: number;
  logCount?: number;
}

export function useUserFoundCaches(targetPubkey?: string) {
  const { user } = useCurrentUser();
  const { nostr } = useNostr();
  const { queryWithRelays } = useNostrQueryRelays();

  // Use provided pubkey or fall back to current user's pubkey
  const pubkey = targetPubkey || user?.pubkey;

  return useQuery({
    queryKey: ['user-found-caches', pubkey],
    queryFn: async (c) => {
      if (!pubkey) {
        return [];
      }

      console.log('🔄 [USER FOUND CACHES] Starting query for user:', pubkey.slice(0, 8));
      
      try {
        const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);
        
        // First, get all "found" logs by the user
        const logFilter: NostrFilter = {
          kinds: [37516], // Geocache log events
          authors: [pubkey],
          limit: 500,
        };
        
        console.log('Querying user logs with filter:', logFilter);
        
        const logEvents = await queryWithRelays([logFilter], { signal });
        console.log('Found', logEvents.length, 'log events');
        
        // Parse and filter for "found" logs
        const foundLogs: (GeocacheLog & { geocachePubkey?: string; geocacheDTag?: string })[] = [];
        
        for (const event of logEvents) {
          const parsed = parseLogEvent(event);
          if (parsed && parsed.type === 'found') {
            // Extract geocache info from a-tag
            const aTag = event.tags.find(t => t[0] === 'a')?.[1];
            if (aTag) {
              const [, pubkey, dTag] = aTag.split(':');
              foundLogs.push({
                ...parsed,
                geocachePubkey: pubkey,
                geocacheDTag: dTag,
              });
            }
          }
        }
        
        console.log('Found', foundLogs.length, 'found logs');
        
        if (foundLogs.length === 0) {
          return [];
        }
        
        // Get unique geocache references
        const geocacheRefs = Array.from(new Set(
          foundLogs.map(log => `${log.geocachePubkey}:${log.geocacheDTag}`)
        ));
        
        console.log('Fetching', geocacheRefs.length, 'unique geocaches');
        
        // Fetch the actual geocache events
        const geocacheFilters: NostrFilter[] = geocacheRefs.map(ref => {
          const [pubkey, dTag] = ref.split(':');
          return {
            kinds: [37515], // Geocache events
            authors: [pubkey],
            '#d': [dTag],
            limit: 1,
          };
        });
        
        const geocacheEvents = await queryWithRelays(geocacheFilters, { signal });
        console.log('Found', geocacheEvents.length, 'geocache events');
        
        // Parse geocaches
        const geocaches = new Map<string, Geocache>();
        for (const event of geocacheEvents) {
          const parsed = parseGeocacheEvent(event);
          if (parsed) {
            const ref = `${parsed.pubkey}:${parsed.dTag}`;
            geocaches.set(ref, parsed);
          }
        }
        
        // Now fetch log counts for each geocache
        console.log('Fetching log counts for geocaches...');
        
        const logCountFilters: NostrFilter[] = geocacheRefs.map(ref => {
          const [pubkey, dTag] = ref.split(':');
          return {
            kinds: [37516], // Log events
            '#a': [`37515:${pubkey}:${dTag}`],
            limit: 1000, // Get all logs to count them
          };
        });
        
        const allLogEvents = await queryWithRelays(logCountFilters, { signal });
        console.log('Found', allLogEvents.length, 'total log events for all geocaches');
        
        // Group logs by geocache and count them
        const logCounts = new Map<string, { total: number; found: number }>();
        
        for (const logEvent of allLogEvents) {
          const aTag = logEvent.tags.find(t => t[0] === 'a')?.[1];
          if (aTag) {
            const [, pubkey, dTag] = aTag.split(':');
            const ref = `${pubkey}:${dTag}`;
            
            const logType = logEvent.tags.find(t => t[0] === 'log-type')?.[1];
            
            if (!logCounts.has(ref)) {
              logCounts.set(ref, { total: 0, found: 0 });
            }
            
            const counts = logCounts.get(ref)!;
            counts.total++;
            
            if (logType === 'found') {
              counts.found++;
            }
          }
        }
        
        console.log('Log counts calculated:', Object.fromEntries(logCounts));
        
        // Combine found logs with geocache data and counts
        const foundCaches: FoundCache[] = [];
        
        for (const log of foundLogs) {
          const ref = `${log.geocachePubkey}:${log.geocacheDTag}`;
          const geocache = geocaches.get(ref);
          const counts = logCounts.get(ref) || { total: 0, found: 0 };
          
          if (geocache) {
            foundCaches.push({
              id: geocache.id,
              dTag: geocache.dTag,
              pubkey: geocache.pubkey,
              name: geocache.name,
              foundAt: log.created_at,
              logId: log.id,
              logText: log.text,
              location: geocache.location,
              difficulty: geocache.difficulty,
              terrain: geocache.terrain,
              size: geocache.size,
              type: geocache.type,
              foundCount: counts.found,
              logCount: counts.total,
            });
          }
        }
        
        // Sort by found date (newest first)
        foundCaches.sort((a, b) => b.foundAt - a.foundAt);
        
        console.log('✅ [USER FOUND CACHES] Final result:', foundCaches.length, 'found caches');
        
        return foundCaches;
        
      } catch (error) {
        console.error('❌ [USER FOUND CACHES] Query failed:', error);
        throw error;
      }
    },
    enabled: !!pubkey,
    retry: 1,
    retryDelay: 1000,
    staleTime: 60000, // 1 minute
    gcTime: 300000, // 5 minutes
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });
}

function parseLogEvent(event: NostrEvent): GeocacheLog | null {
  try {
    if (event.kind !== 37516) {
      return null;
    }

    const aTag = event.tags.find(t => t[0] === 'a')?.[1];
    if (!aTag) {
      return null;
    }

    const [, pubkey, dTag] = aTag.split(':');
    const geocacheId = `${pubkey}:${dTag}`;

    const logType = event.tags.find(t => t[0] === 'log-type')?.[1];
    const images = event.tags.filter(t => t[0] === 'image').map(t => t[1]);
    const client = event.tags.find(t => t[0] === 'client')?.[1];
    const relayTags = event.tags.filter(t => t[0] === 'relay').map(t => t[1]);

    if (!logType) {
      return null;
    }
    
    return {
      id: event.id,
      pubkey: event.pubkey,
      created_at: event.created_at,
      geocacheId,
      type: logType as "found" | "dnf" | "note" | "maintenance" | "disabled" | "enabled" | "archived",
      text: event.content,
      images: images,
      client: client,
      relays: relayTags,
    };
  } catch (error) {
    console.error('Failed to parse log event:', error);
    return null;
  }
}

function parseGeocacheEvent(event: NostrEvent): Geocache | null {
  try {
    if (event.kind !== 37515) {
      return null;
    }

    const dTag = event.tags.find(t => t[0] === 'd')?.[1];
    
    if (!dTag) {
      return null;
    }

    // Try to parse as JSON first
    let data: any;
    try {
      data = JSON.parse(event.content);
    } catch (jsonError) {
      // If JSON parsing fails, try to extract data from tags
      console.log('Content is not JSON, extracting from tags for event:', event.id.slice(0, 8));
      
      const nameTag = event.tags.find(t => t[0] === 'name')?.[1];
      const descriptionTag = event.tags.find(t => t[0] === 'description')?.[1];
      const locationTag = event.tags.find(t => t[0] === 'location')?.[1];
      const difficultyTag = event.tags.find(t => t[0] === 'difficulty')?.[1];
      const terrainTag = event.tags.find(t => t[0] === 'terrain')?.[1];
      const sizeTag = event.tags.find(t => t[0] === 'size')?.[1];
      const typeTag = event.tags.find(t => t[0] === 'type')?.[1];
      const hintTag = event.tags.find(t => t[0] === 'hint')?.[1];
      
      if (!nameTag || !locationTag) {
        console.warn('Missing required tags for geocache:', event.id.slice(0, 8));
        return null;
      }
      
      // Parse location from tag (should be "lat,lng" format)
      const [lat, lng] = locationTag.split(',').map(Number);
      if (isNaN(lat) || isNaN(lng)) {
        console.warn('Invalid location format:', locationTag);
        return null;
      }
      
      data = {
        name: nameTag,
        description: descriptionTag || '',
        hint: hintTag,
        location: { lat, lng },
        difficulty: difficultyTag ? parseInt(difficultyTag) : 1,
        terrain: terrainTag ? parseInt(terrainTag) : 1,
        size: sizeTag || 'regular',
        type: typeTag || 'traditional',
        images: event.tags.filter(t => t[0] === 'image').map(t => t[1]),
      };
    }

    return {
      id: event.id,
      pubkey: event.pubkey,
      created_at: event.created_at,
      dTag,
      name: data.name,
      description: data.description,
      hint: data.hint,
      location: data.location,
      difficulty: data.difficulty,
      terrain: data.terrain,
      size: data.size,
      type: data.type,
      images: data.images,
      foundCount: data.foundCount,
      logCount: data.logCount,
    };
  } catch (error) {
    console.error('Failed to parse geocache event:', error, event);
    return null;
  }
}

export type { FoundCache };