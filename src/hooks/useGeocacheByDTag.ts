import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';
import { NostrEvent, NostrFilter } from '@nostrify/nostrify';
import type { Geocache } from '@/types/geocache';

export function useGeocacheByDTag(dTag: string) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['geocache-by-dtag', dTag],
    queryFn: async (c) => {
      console.log('🔍 [GEOCACHE BY DTAG] Starting query for d-tag:', dTag);
      
      try {
        // Fast timeout - let the fastest relay win
        const signal = AbortSignal.any([c.signal, AbortSignal.timeout(3000)]);
        
        // Query by d-tag - this is the stable identifier
        const filter: NostrFilter = {
          kinds: [37515], // Geocache listing events
          '#d': [dTag], // Find by d-tag
          limit: 1,
        };

        const events = await nostr.query([filter], { signal });
        console.log('🎯 [GEOCACHE BY DTAG] Query returned:', events.length, 'events');

        if (events.length === 0) {
          console.log('❌ [GEOCACHE BY DTAG] No geocache found with d-tag:', dTag);
          return null;
        }

        const geocache = parseGeocacheEvent(events[0]);
        if (!geocache) {
          console.log('❌ [GEOCACHE BY DTAG] Failed to parse geocache event');
          return null;
        }

        console.log('✅ [GEOCACHE BY DTAG] Successfully loaded geocache:', geocache.name);

        // Quick log count fetch
        console.log('📊 [GEOCACHE BY DTAG] Fetching log counts...');
        
        // Get logs for this specific geocache
        const logFilter: NostrFilter = {
          kinds: [37516], // Geocache log events
          '#a': [`37515:${geocache.pubkey}:${geocache.dTag}`],
          limit: 200, // Reasonable limit
        };

        const logEvents = await nostr.query([logFilter], { signal });
      
        let foundCount = 0;
        const logCount = logEvents.length;
        
        logEvents.forEach(event => {
          // Try to get type from tags first (new format)
          const logType = event.tags.find(t => t[0] === 'log-type')?.[1];
          if (logType === 'found') {
            foundCount++;
          } else {
            // Fall back to legacy JSON format
            try {
              const data = JSON.parse(event.content);
              if (data.type === 'found') foundCount++;
            } catch (error) {
              // Ignore parse errors for log count
            }
          }
        });

        const result = {
          ...geocache,
          foundCount,
          logCount,
        };

        console.log('✅ [GEOCACHE BY DTAG] Final result:', {
          dTag: result.dTag,
          name: result.name,
          logCount: result.logCount,
          foundCount: result.foundCount
        });

        return result;
      } catch (error) {
        console.error('❌ [GEOCACHE BY DTAG] Query failed:', error);
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

function parseGeocacheEvent(event: NostrEvent): Geocache | null {
  try {
    // Only process kind 37515 events
    if (event.kind !== 37515) return null;
    
    const dTag = event.tags.find(t => t[0] === 'd')?.[1];
    if (!dTag) return null;

    // Try to parse from tags first (new format)
    const name = event.tags.find(t => t[0] === 'name')?.[1];
    const difficulty = event.tags.find(t => t[0] === 'difficulty')?.[1];
    const terrain = event.tags.find(t => t[0] === 'terrain')?.[1];
    const size = event.tags.find(t => t[0] === 'size')?.[1];
    const cacheType = event.tags.find(t => t[0] === 'cache-type')?.[1];
    const hint = event.tags.find(t => t[0] === 'hint')?.[1];
    const locationTag = event.tags.find(t => t[0] === 'location')?.[1];
    const images = event.tags.filter(t => t[0] === 'image').map(t => t[1]);

    // If we have the new tag format, use it
    if (name && locationTag && difficulty && terrain && size && cacheType) {
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
        description: event.content, // Description is now in content field
        hint: hint,
        location: location,
        difficulty: parseInt(difficulty) || 1,
        terrain: parseInt(terrain) || 1,
        size: size as any,
        type: cacheType as any,
        images: images,
      };
    }

    // Fall back to legacy JSON format for backward compatibility
    try {
      const data = JSON.parse(event.content);
      
      // Handle different location formats
      let location: { lat: number; lng: number } | null = null;
      
      if (!data.location) {
        console.warn(`Geocache "${data.name || 'unnamed'}" has no location data`);
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
      console.error('Failed to parse legacy geocache JSON:', error);
      return null;
    }
  } catch (error) {
    console.error('Failed to parse geocache event:', error);
    return null;
  }
}