import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';
import { NostrEvent, NostrFilter } from '@nostrify/nostrify';
import type { GeocacheLog } from '@/types/geocache';

export function useGeocacheLogs(geocacheId: string) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['geocache-logs', geocacheId],
    queryFn: async (c) => {
      console.log('🔄 [GEOCACHE LOGS] Starting query for geocache:', geocacheId);
      
      try {
        const signal = AbortSignal.any([c.signal, AbortSignal.timeout(3000)]); // Fast 3 second timeout
      
      // Use the working strategy from last time: t-tag + local filtering
      const workingFilter: NostrFilter = {
        kinds: [30078],
        '#t': ['geocache-log'],
        limit: 200, // Reasonable limit
      };
      
      console.log('Working filter:', JSON.stringify(workingFilter));
      let events = await nostr.query([workingFilter], { signal });
      console.log('Query returned:', events.length, 'events');
      
      // Filter by geocache tag locally (this was working well)
      events = events.filter(event => 
        event.tags.some(tag => tag[0] === 'geocache' && tag[1] === geocacheId)
      );
      console.log('After local geocache filtering:', events.length, 'events');
      console.log('Raw log events received:', events.length);
      
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
    // Check if this is a log event (support both old and new formats)
    const dTag = event.tags.find(t => t[0] === 'd')?.[1];
    const tTag = event.tags.find(t => t[0] === 't')?.[1];
    
    const isGeocacheLog = (dTag === 'geocache-log') || (tTag === 'geocache-log') || 
                         (dTag?.startsWith('geocache-log-'));
    
    if (!isGeocacheLog) {
      console.log('Skipping non-log event with d/t tags:', dTag, tTag);
      return null;
    }

    const geocacheId = event.tags.find(t => t[0] === 'geocache')?.[1];
    if (!geocacheId) {
      console.log('Log event missing geocache tag:', event);
      return null;
    }

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