/**
 * Offline-aware Nostr hooks that work seamlessly online and offline
 */

import { useCallback } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { NostrEvent, NostrFilter } from '@nostrify/nostrify';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from './useCurrentUser';
import { useOfflineSync, useOfflineMode } from './useOfflineStorage';
import { offlineStorage } from '@/lib/offlineStorage';
import { isSafari, createSafariNostr } from '@/lib/safariNostr';

// Enhanced useNostr hook with offline support
export function useOfflineNostr() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const { queueAction } = useOfflineSync();
  const { isOnline } = useOfflineMode();

  // Offline-aware query function
  const query = useCallback(async (
    filters: NostrFilter[],
    options: { signal?: AbortSignal; timeout?: number } = {}
  ): Promise<NostrEvent[]> => {
    if (isOnline) {
      try {
        let events: NostrEvent[];
        
        if (isSafari()) {
          // Use Safari-optimized client
          const safariClient = createSafariNostr(['wss://relay.damus.io', 'wss://nos.lol']);
          try {
            events = await safariClient.query(filters, { 
              timeout: options.timeout || 5000
            });
            safariClient.close();
          } catch (error) {
            safariClient.close();
            throw error;
          }
        } else {
          events = await nostr.query(filters, options);
        }

        // Store events offline for future use
        for (const event of events) {
          try {
            await offlineStorage.storeEvent(event);
          } catch (error) {
            console.warn('Failed to store event offline:', error);
          }
        }

        return events;
      } catch (error) {
        console.warn('Online query failed, falling back to offline data:', error);
        // Fall back to offline data
        return await queryOffline(filters);
      }
    } else {
      // Offline mode - query from local storage
      return await queryOffline(filters);
    }
  }, [isOnline, nostr]);

  // Query offline data
  const queryOffline = useCallback(async (filters: NostrFilter[]): Promise<NostrEvent[]> => {
    const allEvents: NostrEvent[] = [];

    for (const filter of filters) {
      if (filter.kinds) {
        for (const kind of filter.kinds) {
          const events = await offlineStorage.getEventsByKind(kind);
          allEvents.push(...events);
        }
      } else {
        // If no kinds specified, we can't efficiently query offline
        console.warn('Offline query without kinds filter is not supported');
      }
    }

    // Apply basic filtering (this is a simplified implementation)
    return allEvents.filter(event => {
      return filters.some(filter => {
        // Check kinds
        if (filter.kinds && !filter.kinds.includes(event.kind)) {
          return false;
        }

        // Check authors
        if (filter.authors && !filter.authors.includes(event.pubkey)) {
          return false;
        }

        // Check IDs
        if (filter.ids && !filter.ids.includes(event.id)) {
          return false;
        }

        // Check since/until
        if (filter.since && event.created_at < filter.since) {
          return false;
        }
        if (filter.until && event.created_at > filter.until) {
          return false;
        }

        return true;
      });
    }).slice(0, filters[0]?.limit || 100); // Apply limit from first filter
  }, []);

  // Offline-aware event publishing
  const publishEvent = useCallback(async (
    eventTemplate: Partial<NostrEvent>
  ): Promise<NostrEvent> => {
    if (!user?.signer) {
      throw new Error('User not logged in or no signer available');
    }

    // First, sign the event
    const signedEvent = await user.signer.signEvent({
      kind: eventTemplate.kind || 1,
      content: eventTemplate.content || '',
      tags: eventTemplate.tags || [],
      created_at: eventTemplate.created_at || Math.floor(Date.now() / 1000),
    });

    if (isOnline) {
      try {
        await nostr.event(signedEvent);
        
        // Store the published event offline
        try {
          await offlineStorage.storeEvent(signedEvent);
        } catch (error) {
          console.warn('Failed to store published event offline:', error);
        }

        return signedEvent;
      } catch (error) {
        console.warn('Online publish failed, queuing for later:', error);
        // Queue for offline sync
        await queueAction('publish_event', { event: signedEvent });
        throw error; // Re-throw to indicate failure
      }
    } else {
      // Offline mode - queue for later
      await queueAction('publish_event', { event: signedEvent });
      return signedEvent;
    }
  }, [isOnline, nostr, queueAction, user]);

  return {
    query,
    event: publishEvent,
    isOnline,
  };
}

// Hook for offline-aware geocache queries
export function useOfflineGeocaches() {
  const { query } = useOfflineNostr();
  const { isOnline } = useOfflineMode();

  return useQuery({
    queryKey: ['geocaches', 'offline-aware', isOnline],
    queryFn: async () => {
      const events = await query([
        {
          kinds: [30001], // Assuming geocaches are kind 30001
          limit: 100,
        }
      ]);

      // Transform events to geocache format
      return events.map(event => {
        const dTag = event.tags.find(tag => tag[0] === 'd')?.[1] || '';
        const coordTag = event.tags.find(tag => tag[0] === 'g');
        const coordinates = coordTag ? coordTag[1].split(',').map(Number) as [number, number] : undefined;
        
        return {
          id: event.id,
          event,
          lastUpdated: Date.now(),
          coordinates,
          difficulty: parseInt(event.tags.find(tag => tag[0] === 'difficulty')?.[1] || '1'),
          terrain: parseInt(event.tags.find(tag => tag[0] === 'terrain')?.[1] || '1'),
          type: event.tags.find(tag => tag[0] === 'type')?.[1] || 'traditional',
        };
      });
    },
    staleTime: isOnline ? 5 * 60 * 1000 : Infinity, // 5 minutes online, never stale offline
    gcTime: 30 * 60 * 1000, // 30 minutes
  });
}

// Hook for offline-aware profile queries
export function useOfflineProfile(pubkey: string) {
  const { query } = useOfflineNostr();
  const { isOnline } = useOfflineMode();

  return useQuery({
    queryKey: ['profile', pubkey, 'offline-aware', isOnline],
    queryFn: async () => {
      if (!pubkey) return null;

      const events = await query([
        {
          kinds: [0],
          authors: [pubkey],
          limit: 1,
        }
      ]);

      if (events.length === 0) return null;

      const event = events[0];
      try {
        const metadata = JSON.parse(event.content);
        return {
          pubkey,
          metadata,
          lastUpdated: Date.now(),
        };
      } catch (error) {
        console.error('Failed to parse profile metadata:', error);
        return null;
      }
    },
    enabled: !!pubkey,
    staleTime: isOnline ? 10 * 60 * 1000 : Infinity, // 10 minutes online, never stale offline
    gcTime: 60 * 60 * 1000, // 1 hour
  });
}

// Hook for offline-aware log creation
export function useOfflineCreateLog() {
  const { event: publishEvent } = useOfflineNostr();
  const { queueAction } = useOfflineSync();
  const { isOnline } = useOfflineMode();

  return useMutation({
    mutationFn: async ({
      geocacheId,
      content,
      type = 'found',
    }: {
      geocacheId: string;
      content: string;
      type?: string;
    }) => {
      const eventTemplate = {
        kind: 1,
        content,
        tags: [
          ['e', geocacheId],
          ['type', type],
          ['client', 'treasures'],
        ],
      };

      if (isOnline) {
        return await publishEvent(eventTemplate);
      } else {
        // Queue for offline sync
        await queueAction('create_log', { geocacheId, content, type });
        
        // Return a temporary event
        return {
          id: `temp-log-${Date.now()}`,
          kind: 1,
          content,
          tags: eventTemplate.tags,
          created_at: Math.floor(Date.now() / 1000),
          pubkey: '',
          sig: 'pending',
        } as NostrEvent;
      }
    },
  });
}