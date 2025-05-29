import { NostrEvent, NostrFilter, NRelay1 } from '@nostrify/nostrify';
import { useNostr } from '@nostrify/react';

export interface NostrEventWithRelay extends NostrEvent {
  sourceRelay?: string;
}

export function useNostrQueryRelays() {
  const { nostr } = useNostr();

  const queryWithRelays = async (
    filters: NostrFilter[],
    options?: {
      signal?: AbortSignal;
      relays?: string[];
    }
  ): Promise<NostrEventWithRelay[]> => {
    const allEvents: NostrEventWithRelay[] = [];
    const eventIds = new Set<string>();

    // Query the specified relays if provided
    if (options?.relays && options.relays.length > 0) {
      console.log('Querying specific relays:', options.relays);
      
      const relayPromises = options.relays.map(async (url) => {
        try {
          const relay = new NRelay1(url);
          const events = await relay.query(filters, { signal: options.signal });
          console.log(`Got ${events.length} events from ${url}`);
          // Add source relay to each event
          return events.map(event => ({ ...event, sourceRelay: url }));
        } catch (error) {
          console.error(`Failed to query ${url}:`, error);
          return [];
        }
      });

      const relayResults = await Promise.all(relayPromises);
      
      // Merge results and deduplicate
      for (const events of relayResults) {
        for (const event of events) {
          if (!eventIds.has(event.id)) {
            eventIds.add(event.id);
            allEvents.push(event);
          }
        }
      }
    }

    // Also query the default relays
    try {
      const defaultEvents = await nostr.query(filters, { signal: options?.signal });
      console.log(`Got ${defaultEvents.length} events from default relays`);
      
      for (const event of defaultEvents) {
        if (!eventIds.has(event.id)) {
          eventIds.add(event.id);
          // For default relays, we don't know the specific relay
          allEvents.push({ ...event, sourceRelay: undefined });
        }
      }
    } catch (error) {
      console.error('Failed to query default relays:', error);
    }

    console.log(`Total unique events: ${allEvents.length}`);
    return allEvents;
  };

  return { queryWithRelays };
}