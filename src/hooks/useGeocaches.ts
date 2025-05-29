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
        kinds: [37515], // Geocache listing events
        limit: options.limit || 50,
      };

      if (options.authorPubkey) {
        filter.authors = [options.authorPubkey];
      }

      const events = await nostr.query([filter], { signal });
      
      console.log('Raw events from query:', events.length, 'events');
      console.log('Event kinds:', events.map(e => e.kind));
      if (events.length > 0) {
        console.log('Sample event:', events[0]);
        // Log content of first few events to debug
        events.slice(0, 3).forEach((event, i) => {
          try {
            const content = JSON.parse(event.content);
            console.log(`Event ${i} content:`, content);
          } catch (e) {
            console.log(`Event ${i} has invalid JSON content`);
          }
        });
      }
      
      // Parse and filter geocaches (no need for complex edit handling now)
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

      // Get log counts for each geocache
      if (geocaches.length > 0) {
        // Create filters for logs of each geocache
        const logFilters: NostrFilter[] = geocaches.map(geocache => ({
          kinds: [37516], // Geocache log events
          '#a': [`37515:${geocache.pubkey}:${geocache.dTag}`],
          limit: 100, // Limit per cache
        }));

        const logEvents = await nostr.query(logFilters, { signal });
        
        // Count logs per geocache
        const logCounts = new Map<string, { total: number; found: number }>();
        
        logEvents.forEach(event => {
          // Find which geocache this log belongs to
          const aTag = event.tags.find(tag => tag[0] === 'a')?.[1];
          if (!aTag) return;
          
          const [, pubkey, dTag] = aTag.split(':');
          const geocache = geocaches.find(g => g.pubkey === pubkey && g.dTag === dTag);
          if (!geocache) return;
          
          const data = parseLogData(event);
          if (data) {
            const current = logCounts.get(geocache.id) || { total: 0, found: 0 };
            current.total++;
            if (data.type === 'found') current.found++;
            logCounts.set(geocache.id, current);
          }
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
    // Only process kind 37515 events
    if (event.kind !== 37515) return null;
    
    const dTag = event.tags.find(t => t[0] === 'd')?.[1];
    if (!dTag) return null;

    const data = JSON.parse(event.content);
    
    // Handle different location formats
    let location: { lat: number; lng: number } | null = null;
    
    if (!data.location) {
      console.warn(`Geocache "${data.name || 'unnamed'}" has no location data, skipping`);
      return null;
    }
    
    // Check if location is already in the correct format
    if (typeof data.location.lat === 'number' && typeof data.location.lng === 'number') {
      location = data.location;
    }
    // Handle GeoJSON FeatureCollection format
    else if (data.location.type === 'FeatureCollection' && data.location.features?.length > 0) {
      const feature = data.location.features[0];
      if (feature.geometry?.coordinates?.length >= 2) {
        // GeoJSON uses [lng, lat] order
        location = {
          lng: feature.geometry.coordinates[0],
          lat: feature.geometry.coordinates[1]
        };
      }
    }
    // Handle GeoJSON Point format
    else if (data.location.type === 'Point' && data.location.coordinates?.length >= 2) {
      // GeoJSON uses [lng, lat] order
      location = {
        lng: data.location.coordinates[0],
        lat: data.location.coordinates[1]
      };
    }
    
    if (!location) {
      console.warn(`Geocache "${data.name || 'unnamed'}" has invalid location format:`, data.location);
      return null;
    }
    
    // Validate coordinates are within valid ranges
    if (location.lat < -90 || location.lat > 90 || location.lng < -180 || location.lng > 180) {
      console.warn(`Geocache "${data.name || 'unnamed'}" has invalid coordinates:`, location);
      return null;
    }
    
    return {
      id: event.id,
      pubkey: event.pubkey,
      created_at: event.created_at,
      dTag: dTag,
      name: data.name || 'Unnamed Cache',
      description: data.description || '',
      hint: data.hint,
      location: location,
      difficulty: data.difficulty || 1,
      terrain: data.terrain || 1,
      size: data.size || 'regular',
      type: data.type || 'traditional',
      images: data.images || [],
    };
  } catch (error) {
    console.error('Failed to parse geocache event:', error, event);
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