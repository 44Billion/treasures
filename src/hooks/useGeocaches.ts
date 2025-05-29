import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';
import { NostrEvent, NostrFilter } from '@nostrify/nostrify';
import type { Geocache } from '@/types/geocache';

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
    queryKey: ['geocaches', options],
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(3000)]);
      
      // Build filter for geocache events
      const filter: NostrFilter = {
        kinds: [30078], // Application-specific data
        '#t': ['geocache'], // Type tag for filtering (allows multiple unique geocaches)
        limit: options.limit || 50,
      };

      if (options.authorPubkey) {
        filter.authors = [options.authorPubkey];
      }

      const events = await nostr.query([filter], { signal });
      
      // Parse and filter geocaches (no need for complex edit handling now)
      let geocaches: Geocache[] = events
        .map(parseGeocacheEvent)
        .filter((g): g is Geocache => g !== null);
      
      console.log('Found', geocaches.length, 'geocaches');

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

      // Get log counts for each geocache
      const geocacheIds = geocaches.map(g => g.id);
      if (geocacheIds.length > 0) {
        const logFilter: NostrFilter = {
          kinds: [30078],
          '#d': ['geocache-log'],
          '#geocache': geocacheIds,
        };

        const logEvents = await nostr.query([logFilter], { signal });
        
        // Count logs per geocache
        const logCounts = new Map<string, { total: number; found: number }>();
        logEvents.forEach(event => {
          const geocacheId = event.tags.find(t => t[0] === 'geocache')?.[1];
          if (!geocacheId) return;

          const data = parseLogData(event);
          if (!data) return;

          const current = logCounts.get(geocacheId) || { total: 0, found: 0 };
          current.total++;
          if (data.type === 'found') current.found++;
          logCounts.set(geocacheId, current);
        });

        // Add counts to geocaches
        geocaches = geocaches.map(g => ({
          ...g,
          logCount: logCounts.get(g.id)?.total || 0,
          foundCount: logCounts.get(g.id)?.found || 0,
        }));
      }

      return geocaches;
    },
  });
}

function parseGeocacheEvent(event: NostrEvent): Geocache | null {
  try {
    // Check if this is a geocache event (support both old and new formats)
    const dTag = event.tags.find(t => t[0] === 'd')?.[1];
    const tTag = event.tags.find(t => t[0] === 't')?.[1];
    
    const isGeocache = (dTag === 'geocache') || (tTag === 'geocache') || 
                      (dTag?.startsWith('geocache-'));
    
    if (!isGeocache) return null;

    const data = JSON.parse(event.content);
    
    return {
      id: event.id,
      pubkey: event.pubkey,
      created_at: event.created_at,
      name: data.name,
      description: data.description,
      hint: data.hint,
      location: data.location,
      difficulty: data.difficulty,
      terrain: data.terrain,
      size: data.size,
      type: data.type,
      images: data.images,
    };
  } catch (error) {
    console.error('Failed to parse geocache event:', error);
    return null;
  }
}

function parseLogData(event: NostrEvent): { type: string } | null {
  try {
    const data = JSON.parse(event.content);
    return { type: data.type };
  } catch {
    return null;
  }
}