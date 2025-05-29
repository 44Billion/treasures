import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';
import { NostrEvent, NostrFilter } from '@nostrify/nostrify';
import type { Geocache } from '@/types/geocache';

export function useGeocache(id: string) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['geocache', id],
    queryFn: async (c) => {
      console.log('🔍 [GEOCACHE] Starting query for ID:', id);
      
      try {
        // Fast timeout - let the fastest relay win
        const signal = AbortSignal.any([c.signal, AbortSignal.timeout(3000)]); // Back to 3 seconds
        
        // Primary strategy: Direct ID lookup (this was working great!)
        const filter: NostrFilter = {
          ids: [id],
          kinds: [30078],
          limit: 1,
        };

        const events = await nostr.query([filter], { signal });
        console.log('🎯 [GEOCACHE] Query returned:', events.length, 'events');

        if (events.length === 0) {
          console.log('❌ [GEOCACHE] No geocache found with ID:', id);
          return null;
        }

        const geocache = parseGeocacheEvent(events[0]);
        if (!geocache) {
          console.log('❌ [GEOCACHE] Failed to parse geocache event');
          return null;
        }

        console.log('✅ [GEOCACHE] Successfully loaded geocache:', geocache.name);

        // Quick log count fetch (also let fastest relay win)
        console.log('📊 [GEOCACHE] Fetching log counts...');
        
        // Try new log format first
        let logFilter: NostrFilter = {
          kinds: [30078],
          '#t': ['geocache-log'],
          '#geocache': [id],
          limit: 100,
        };

        let logEvents = await nostr.query([logFilter], { signal });
        
        // If new format returns nothing, try old format for backward compatibility
        if (logEvents.length === 0) {
          logFilter = {
            kinds: [30078],
            '#d': ['geocache-log'],
            '#geocache': [id],
            limit: 100,
          };
          logEvents = await nostr.query([logFilter], { signal });
        }
      
        let foundCount = 0;
        let logCount = logEvents.length;
        
        logEvents.forEach(event => {
          try {
            const data = JSON.parse(event.content);
            if (data.type === 'found') foundCount++;
          } catch (error) {
            // Ignore parse errors for log count
          }
        });

        const result = {
          ...geocache,
          foundCount,
          logCount,
        };

        console.log('✅ [GEOCACHE] Final result:', {
          id: result.id.slice(0, 8),
          name: result.name,
          logCount: result.logCount,
          foundCount: result.foundCount
        });

        return result;
      } catch (error) {
        console.error('❌ [GEOCACHE] Query failed:', error);
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