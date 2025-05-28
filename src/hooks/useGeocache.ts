import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';
import { NostrEvent, NostrFilter } from '@nostrify/nostrify';
import type { Geocache } from '@/types/geocache';

export function useGeocache(id: string) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['geocache', id],
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(2000)]);
      
      // Query for the specific geocache event
      const filter: NostrFilter = {
        ids: [id],
        kinds: [30078],
        limit: 1,
      };

      const events = await nostr.query([filter], { signal });
      
      if (events.length === 0) {
        return null;
      }

      const geocache = parseGeocacheEvent(events[0]);
      if (!geocache) {
        return null;
      }

      // Get log counts
      const logFilter: NostrFilter = {
        kinds: [30078],
        '#d': ['geocache-log'],
        '#geocache': [id],
      };

      const logEvents = await nostr.query([logFilter], { signal });
      
      let foundCount = 0;
      let logCount = logEvents.length;
      
      logEvents.forEach(event => {
        try {
          const data = JSON.parse(event.content);
          if (data.type === 'found') foundCount++;
        } catch {}
      });

      return {
        ...geocache,
        foundCount,
        logCount,
      };
    },
    enabled: !!id,
  });
}

function parseGeocacheEvent(event: NostrEvent): Geocache | null {
  try {
    // Check if this is a geocache event
    const dTag = event.tags.find(t => t[0] === 'd')?.[1];
    if (dTag !== 'geocache') return null;

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