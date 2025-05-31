import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';
import { NostrEvent, NostrFilter } from '@nostrify/nostrify';
import type { Geocache } from '@/types/geocache';
import { decodeHint } from '@/lib/rot13';
import { isSafari, createSafariNostr } from '@/lib/safariNostr';

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
      console.log('🔍 [GEOCACHE BY DTAG] Starting query for d-tag:', dTag);
      
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
          console.log('🍎 [GEOCACHE BY DTAG] Using Safari client for individual cache');
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
            console.warn('🍎 [GEOCACHE BY DTAG] Safari log query failed, continuing without counts');
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

    // Parse from tags
    const name = event.tags.find(t => t[0] === 'name')?.[1];
    const difficulty = event.tags.find(t => t[0] === 'difficulty')?.[1];
    const terrain = event.tags.find(t => t[0] === 'terrain')?.[1];
    const size = event.tags.find(t => t[0] === 'size')?.[1];
    const cacheType = event.tags.find(t => t[0] === 'cache-type')?.[1];
    const hint = event.tags.find(t => t[0] === 'hint')?.[1];
    const locationTag = event.tags.find(t => t[0] === 'location')?.[1];
    const images = event.tags.filter(t => t[0] === 'image').map(t => t[1]);
    const relays = event.tags.filter(t => t[0] === 'relay').map(t => t[1]);
    const client = event.tags.find(t => t[0] === 'client')?.[1];

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
      hint: hint ? (isRot13Encoded(hint) ? decodeHint(hint) : hint) : undefined,
      location: location,
      difficulty: parseInt(difficulty) || 1,
      terrain: parseInt(terrain) || 1,
      size: size as "micro" | "small" | "regular" | "large",
      type: cacheType as "traditional" | "multi" | "mystery" | "earth" | "virtual" | "letterbox" | "event",
      images: images,
      relays: relays,
      client: client,
    };
  } catch (error) {
    console.error('Failed to parse geocache event:', error);
    return null;
  }
}