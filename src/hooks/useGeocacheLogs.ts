import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';
import { NostrEvent, NostrFilter } from '@nostrify/nostrify';
import type { GeocacheLog } from '@/types/geocache';
import { useNostrQueryRelays } from './useNostrQueryRelays';

export function useGeocacheLogs(geocacheId: string, geocacheDTag?: string, geocachePubkey?: string, preferredRelays?: string[]) {
  const { nostr } = useNostr();
  const { queryWithRelays } = useNostrQueryRelays();

  return useQuery({
    queryKey: ['geocache-logs', geocacheDTag, geocachePubkey, preferredRelays],
    queryFn: async (c) => {
      console.log('🔄 [GEOCACHE LOGS] Starting query for geocache:', {
        geocacheId,
        dTag: geocacheDTag,
        pubkey: geocachePubkey
      });
      
      try {
        const signal = AbortSignal.any([c.signal, AbortSignal.timeout(3000)]); // Fast 3 second timeout
      
      // Query for logs using the new event kind
      const filter: NostrFilter = {
        kinds: [37516], // Geocache log events
        limit: 200, // Reasonable limit
      };
      
      // If we have the cache pubkey and d-tag, use the a-tag filter
      if (geocachePubkey && geocacheDTag) {
        filter['#a'] = [`37515:${geocachePubkey}:${geocacheDTag}`];
      }
      
      console.log('Working filter:', JSON.stringify(filter));
      console.log('Using preferred relays:', preferredRelays);
      
      // Use the custom query function that queries both preferred and default relays
      let events = await queryWithRelays([filter], { 
        signal, 
        relays: preferredRelays 
      });
      console.log('Query returned:', events.length, 'events');
      
      // Additional filtering for edge cases
      if (!geocachePubkey || !geocacheDTag) {
        events = events.filter(event => {
          const aTag = event.tags.find(tag => tag[0] === 'a')?.[1];
          if (!aTag) return false;
          
          // Check if this log is for our geocache
          const [, pubkey, dTag] = aTag.split(':');
          return (dTag === geocacheDTag) || (geocacheId && aTag.includes(geocacheId));
        });
        console.log('After additional filtering:', events.length, 'events');
      }
      
      // Log first few events for debugging
      if (events.length > 0) {
        console.log('Sample events:', events.slice(0, 3));
        console.log('All event IDs:', events.map(e => e.id.slice(0, 8)));
      }
    
      // Remove duplicates by event ID (multiple relays may return the same event)
      const uniqueEvents = events.reduce((acc, event) => {
        if (!acc.has(event.id)) {
          acc.set(event.id, event);
        }
        return acc;
      }, new Map<string, NostrEvent>());

      const deduplicatedEvents = Array.from(uniqueEvents.values());
      console.log(`Removed ${events.length - deduplicatedEvents.length} duplicate events`);

      // Parse log events
      const parsedLogs = deduplicatedEvents.map(event => {
        const parsed = parseLogEvent(event);
        if (parsed && 'sourceRelay' in event) {
          parsed.sourceRelay = (event as NostrEvent & { sourceRelay?: string }).sourceRelay;
        }
        return parsed;
      });
      const logs: GeocacheLog[] = parsedLogs.filter((log): log is GeocacheLog => log !== null);
      
      console.log('Parsing results:', {
        totalEvents: deduplicatedEvents.length,
        parsedSuccessfully: logs.length,
        failedToParse: parsedLogs.filter(l => l === null).length
      });

      // Sort by creation date (newest first)
      logs.sort((a, b) => b.created_at - a.created_at);

      console.log('✅ [GEOCACHE LOGS] Final result:', {
        geocacheId,
        geocacheDTag,
        logsFound: logs.length,
        logIds: logs.map(l => l.id.slice(0, 8))
      });

      return logs;
    } catch (error) {
      console.error('❌ [GEOCACHE LOGS] Query failed:', error);
      throw error;
    }
    },
    enabled: !!(geocacheDTag && geocachePubkey),
    retry: 1, // Quick retry
    retryDelay: 500, // Fast retry 
    staleTime: 30000, // 30 seconds - increased to reduce refetches
    gcTime: 600000, // 10 minutes - increased to keep data longer
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });
}

function parseLogEvent(event: NostrEvent): GeocacheLog | null {
  try {
    // Only process kind 37516 events
    if (event.kind !== 37516) {
      console.log('Skipping non-log event kind:', event.kind);
      return null;
    }

    // Get the geocache reference from the a-tag
    const aTag = event.tags.find(t => t[0] === 'a')?.[1];
    if (!aTag) {
      console.log('Log event missing a-tag reference:', event);
      return null;
    }

    // Extract geocache ID from the a-tag
    const [, pubkey, dTag] = aTag.split(':');
    const geocacheId = `${pubkey}:${dTag}`; // Use a composite ID

    // Parse from tags
    const logType = event.tags.find(t => t[0] === 'log-type')?.[1];
    const images = event.tags.filter(t => t[0] === 'image').map(t => t[1]);
    const client = event.tags.find(t => t[0] === 'client')?.[1];
    const relayTags = event.tags.filter(t => t[0] === 'relay').map(t => t[1]);

    if (!logType) {
      console.warn('Log event missing log-type tag:', event);
      return null;
    }

    console.log('Parsed log data from tags:', { 
      geocacheId, 
      type: logType, 
      text: event.content.substring(0, 50),
      client: client 
    });
    
    return {
      id: event.id,
      pubkey: event.pubkey,
      created_at: event.created_at,
      geocacheId,
      type: logType as "found" | "dnf" | "note" | "maintenance" | "disabled" | "enabled" | "archived",
      text: event.content, // Text is in content field
      images: images,
      client: client,
      relays: relayTags,
    };
  } catch (error) {
    console.error('Failed to parse log event:', error, event);
    return null;
  }
}