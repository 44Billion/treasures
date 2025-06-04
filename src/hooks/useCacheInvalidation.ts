/**
 * Hook for handling cache invalidation when geocaches are deleted upstream
 */

import { useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { NostrEvent, NostrFilter } from '@nostrify/nostrify';
import { useNostr } from '@nostrify/react';
import { offlineStorage } from '@/lib/offlineStorage';
import { useOfflineMode } from './useOfflineStorage';
import { NIP_GC_KINDS, createGeocacheCoordinate } from '@/lib/nip-gc';
import { TIMEOUTS, QUERY_LIMITS } from '@/lib/constants';

interface DeletionEvent {
  id: string;
  pubkey: string;
  deletedEventIds: string[];
  deletedCoordinates: string[];
  reason?: string;
  created_at: number;
}

/**
 * Hook to monitor for deletion events and invalidate cached geocaches
 */
export function useCacheInvalidation() {
  const { nostr } = useNostr();
  const { isOnline, isConnected } = useOfflineMode();
  const queryClient = useQueryClient();

  // Query for deletion events (kind 5)
  const { data: deletionEvents = [] } = useQuery({
    queryKey: ['deletion-events', isOnline && isConnected],
    queryFn: async (c): Promise<DeletionEvent[]> => {
      if (!isOnline || !isConnected) {
        return [];
      }

      try {
        const signal = AbortSignal.any([c.signal, AbortSignal.timeout(TIMEOUTS.QUERY)]);
        const events = await nostr.query([{
          kinds: [5], // Deletion events
          since: Math.floor((Date.now() - 7 * 24 * 60 * 60 * 1000) / 1000), // Last 7 days
        }], { signal });

        return events.map(parseDeletionEvent).filter((d): d is DeletionEvent => d !== null);
      } catch (error) {
        console.warn('Failed to fetch deletion events:', error);
        return [];
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    enabled: isOnline && isConnected,
    refetchInterval: 10 * 60 * 1000, // Check every 10 minutes
  });

  // Process deletion events and invalidate caches
  const processDeletions = useCallback(async (deletions: DeletionEvent[]) => {
    if (deletions.length === 0) return;

    console.log(`Processing ${deletions.length} deletion events...`);
    
    let invalidatedCount = 0;
    
    for (const deletion of deletions) {
      try {
        // Remove deleted events from offline storage
        for (const eventId of deletion.deletedEventIds) {
          await offlineStorage.removeEvent(eventId);
          await offlineStorage.removeGeocache(eventId);
          invalidatedCount++;
        }

        // Handle coordinate-based deletions (for replaceable events)
        for (const coordinate of deletion.deletedCoordinates) {
          // Parse coordinate format: kind:pubkey:d-tag
          const [kind, pubkey, dTag] = coordinate.split(':');
          if (kind === NIP_GC_KINDS.GEOCACHE.toString() && pubkey === deletion.pubkey) {
            // Find and remove geocaches with matching coordinate
            const allCaches = await offlineStorage.getAllGeocaches();
            for (const cache of allCaches) {
              const cacheCoordinate = createGeocacheCoordinate(cache.event.pubkey, 
                cache.event.tags.find(t => t[0] === 'd')?.[1] || '');
              if (cacheCoordinate === coordinate) {
                await offlineStorage.removeGeocache(cache.id);
                await offlineStorage.removeEvent(cache.id);
                invalidatedCount++;
              }
            }
          }
        }
      } catch (error) {
        console.warn('Failed to process deletion event:', deletion.id, error);
      }
    }

    if (invalidatedCount > 0) {
      console.log(`Invalidated ${invalidatedCount} cached items due to upstream deletions`);
      
      // Invalidate React Query caches
      queryClient.invalidateQueries({ queryKey: ['geocaches'] });
      queryClient.invalidateQueries({ queryKey: ['offline-geocaches'] });
      
      // Also invalidate specific geocache queries
      queryClient.invalidateQueries({ queryKey: ['geocache'] });
    }
  }, [queryClient]);

  // Process deletions when they change
  useEffect(() => {
    if (deletionEvents.length > 0) {
      processDeletions(deletionEvents);
    }
  }, [deletionEvents, processDeletions]);

  // Manual invalidation function for specific geocaches
  const invalidateGeocache = useCallback(async (geocacheId: string) => {
    try {
      await offlineStorage.removeGeocache(geocacheId);
      await offlineStorage.removeEvent(geocacheId);
      
      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['geocaches'] });
      queryClient.invalidateQueries({ queryKey: ['geocache', geocacheId] });
      queryClient.invalidateQueries({ queryKey: ['offline-geocaches'] });
      
      console.log(`Manually invalidated geocache: ${geocacheId}`);
    } catch (error) {
      console.warn('Failed to invalidate geocache:', geocacheId, error);
    }
  }, [queryClient]);

  // Check for stale caches and validate against network
  const validateCachedGeocaches = useCallback(async () => {
    if (!isOnline || !isConnected) return;

    try {
      // Get geocaches that haven't been validated in the last 24 hours
      const unvalidatedCaches = await offlineStorage.getUnvalidatedGeocaches();
      if (unvalidatedCaches.length === 0) return;

      // Limit validation batch size for performance
      const sample = unvalidatedCaches.slice(0, QUERY_LIMITS.BATCH_SIZE);
      const eventIds = sample.map(cache => cache.id);
      
      console.log(`Validating ${eventIds.length} cached geocaches...`);
      
      const signal = AbortSignal.timeout(TIMEOUTS.QUERY);
      const existingEvents = await nostr.query([{
        ids: eventIds,
        kinds: [NIP_GC_KINDS.GEOCACHE],
      }], { signal });

      const existingIds = new Set(existingEvents.map(e => e.id));
      const deletedIds = eventIds.filter(id => !existingIds.has(id));

      // Update validation timestamps for existing geocaches
      for (const existingId of existingIds) {
        await offlineStorage.updateGeocacheValidation(existingId);
      }

      // Remove geocaches that no longer exist
      if (deletedIds.length > 0) {
        console.log(`Found ${deletedIds.length} geocaches that no longer exist upstream`);
        
        for (const deletedId of deletedIds) {
          await invalidateGeocache(deletedId);
        }
      }

      console.log(`Validation complete: ${existingIds.size} confirmed, ${deletedIds.length} removed`);
    } catch (error) {
      console.warn('Failed to validate cached geocaches:', error);
    }
  }, [isOnline, isConnected, nostr, invalidateGeocache]);

  // Periodic validation of cached data
  useEffect(() => {
    if (!isOnline || !isConnected) return;

    // Validate caches every 30 minutes
    const interval = setInterval(validateCachedGeocaches, 30 * 60 * 1000);
    
    // Also validate on mount
    validateCachedGeocaches();

    return () => clearInterval(interval);
  }, [isOnline, isConnected, validateCachedGeocaches]);

  return {
    deletionEvents,
    invalidateGeocache,
    validateCachedGeocaches,
    isMonitoring: isOnline && isConnected,
  };
}

/**
 * Parse a deletion event (kind 5) into a structured format
 */
function parseDeletionEvent(event: NostrEvent): DeletionEvent | null {
  if (event.kind !== 5) return null;

  const deletedEventIds: string[] = [];
  const deletedCoordinates: string[] = [];

  for (const tag of event.tags) {
    if (tag[0] === 'e' && tag[1]) {
      deletedEventIds.push(tag[1]);
    } else if (tag[0] === 'a' && tag[1]) {
      deletedCoordinates.push(tag[1]);
    }
  }

  if (deletedEventIds.length === 0 && deletedCoordinates.length === 0) {
    return null; // Invalid deletion event
  }

  return {
    id: event.id,
    pubkey: event.pubkey,
    deletedEventIds,
    deletedCoordinates,
    reason: event.content || undefined,
    created_at: event.created_at,
  };
}

/**
 * Hook to create deletion events for geocaches
 */
export function useDeleteGeocache() {
  const { nostr } = useNostr();
  const queryClient = useQueryClient();

  return useCallback(async (geocacheEvent: NostrEvent, reason?: string) => {
    try {
      // Create deletion event template
      const deletionEventTemplate = {
        kind: 5,
        content: reason || 'Geocache deleted by author',
        tags: [
          ['e', geocacheEvent.id],
          ['k', geocacheEvent.kind.toString()],
        ],
        created_at: Math.floor(Date.now() / 1000),
      };

      // If it's a replaceable event, also add 'a' tag
      if (geocacheEvent.kind === NIP_GC_KINDS.GEOCACHE) {
        const dTag = geocacheEvent.tags.find(t => t[0] === 'd')?.[1];
        if (dTag) {
          const coordinate = createGeocacheCoordinate(geocacheEvent.pubkey, dTag);
          deletionEventTemplate.tags.push(['a', coordinate]);
        }
      }

      // Publish deletion event (this will be signed by the nostr client)
      await nostr.event(deletionEventTemplate);

      // Immediately invalidate local caches
      await offlineStorage.removeGeocache(geocacheEvent.id);
      await offlineStorage.removeEvent(geocacheEvent.id);
      
      queryClient.invalidateQueries({ queryKey: ['geocaches'] });
      queryClient.invalidateQueries({ queryKey: ['geocache', geocacheEvent.id] });
      queryClient.invalidateQueries({ queryKey: ['offline-geocaches'] });

      console.log(`Published deletion event for geocache: ${geocacheEvent.id}`);
    } catch (error) {
      console.error('Failed to delete geocache:', error);
      throw error;
    }
  }, [nostr, queryClient]);
}