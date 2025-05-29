import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';
import { NostrEvent, NostrFilter } from '@nostrify/nostrify';
import type { GeocacheLog } from '@/types/geocache';

export function useGeocacheLogs(geocacheId: string, geocacheDTag?: string, geocachePubkey?: string) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['geocache-logs', geocacheId, geocacheDTag, geocachePubkey],
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
      let events = await nostr.query([filter], { signal });
      console.log('Query returned:', events.length, 'events');
      
      // If we didn't have pubkey/dtag, filter locally
      if (!geocachePubkey || !geocacheDTag) {
        events = events.filter(event => {
          const aTag = event.tags.find(tag => tag[0] === 'a')?.[1];
          if (!aTag) return false;
          
          // Check if this log is for our geocache
          const [, pubkey, dTag] = aTag.split(':');
          return (dTag === geocacheDTag) || (geocacheId && aTag.includes(geocacheId));
        });
        console.log('After local filtering:', events.length, 'events');
      }
      
      // Log first few events for debugging
      if (events.length > 0) {
        console.log('Sample event:', events[0]);
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
      const logs: GeocacheLog[] = deduplicatedEvents
        .map(parseLogEvent)
        .filter((log): log is GeocacheLog => log !== null);

      console.log('Parsed logs:', logs.length);

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
    enabled: !!geocacheId,
    retry: 1, // Quick retry
    retryDelay: 500, // Fast retry 
    staleTime: 15000, // 15 seconds
    gcTime: 300000, // 5 minutes
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });
}

function parseLogEvent(event: NostrEvent): GeocacheLog | null {
  try {
    // Only process kind 37516 events
    if (event.kind !== 37516) return null;

    // Get the geocache reference from the a-tag
    const aTag = event.tags.find(t => t[0] === 'a')?.[1];
    if (!aTag) {
      console.log('Log event missing a-tag reference:', event);
      return null;
    }

    // Extract geocache ID from the a-tag
    const [, pubkey, dTag] = aTag.split(':');
    const geocacheId = `${pubkey}:${dTag}`; // Use a composite ID

    const data = JSON.parse(event.content);
    console.log('Parsed log data:', { geocacheId, type: data.type, text: data.text?.substring(0, 50) });
    
    return {
      id: event.id,
      pubkey: event.pubkey,
      created_at: event.created_at,
      geocacheId,
      type: data.type || 'note',
      text: data.text || '',
      images: data.images || [],
    };
  } catch (error) {
    console.error('Failed to parse log event:', error, event);
    return null;
  }
}