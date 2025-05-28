import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';
import { NostrEvent, NostrFilter } from '@nostrify/nostrify';
import type { GeocacheLog } from '@/types/geocache';

export function useGeocacheLogs(geocacheId: string) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['geocache-logs', geocacheId],
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(2000)]);
      
      // Query for logs of this geocache
      const filter: NostrFilter = {
        kinds: [30078],
        '#d': ['geocache-log'],
        '#geocache': [geocacheId],
        limit: 100,
      };

      const events = await nostr.query([filter], { signal });
      
      // Parse log events
      const logs: GeocacheLog[] = events
        .map(parseLogEvent)
        .filter((log): log is GeocacheLog => log !== null);

      // Sort by creation date (newest first)
      logs.sort((a, b) => b.created_at - a.created_at);

      return logs;
    },
    enabled: !!geocacheId,
  });
}

function parseLogEvent(event: NostrEvent): GeocacheLog | null {
  try {
    // Check if this is a log event
    const dTag = event.tags.find(t => t[0] === 'd')?.[1];
    if (dTag !== 'geocache-log') return null;

    const geocacheId = event.tags.find(t => t[0] === 'geocache')?.[1];
    if (!geocacheId) return null;

    const data = JSON.parse(event.content);
    
    return {
      id: event.id,
      pubkey: event.pubkey,
      created_at: event.created_at,
      geocacheId,
      type: data.type,
      text: data.text,
      images: data.images,
    };
  } catch (error) {
    console.error('Failed to parse log event:', error);
    return null;
  }
}