/**
 * Hook for handling cache invalidation when geocaches are deleted upstream
 */

import { useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { NostrEvent } from '@nostrify/nostrify';
import { useNostr } from '@nostrify/react';
import { offlineStorage } from '@/lib/offlineStorage';
import { useOfflineMode } from './useOfflineStorage';
import { NIP_GC_KINDS, createGeocacheCoordinate } from '@/lib/nip-gc';
import { TIMEOUTS, QUERY_LIMITS, POLLING_INTERVALS } from '@/lib/constants';

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
    staleTime: 60000, // 1 minute
    gcTime: 1800000, // 30 minutes
    enabled: isOnline && isConnected,
    refetchInterval: POLLING_INTERVALS.DELETION_EVENTS, // Check every 2 minutes
  });

  // Process deletion events and invalidate caches
  const processDeletions = useCallback(async (deletions: DeletionEvent[]) => {
    if (deletions.length === 0) return;

    console.log(`Processing ${deletions.length} deletion events...`);
    
    let invalidatedCount = 0;
    const invalidatedIds = new Set<string>();
    
    for (const deletion of deletions) {
      try {
        // Only process deletions from the last 7 days to avoid stale deletions
        const sevenDaysAgo = Math.floor((Date.now() - 7 * 24 * 60 * 60 * 1000) / 1000);
        if (deletion.created_at < sevenDaysAgo) {
          continue;
        }

        // Remove deleted events from offline storage
        for (const eventId of deletion.deletedEventIds) {
          if (!invalidatedIds.has(eventId)) {
            await offlineStorage.removeEvent(eventId);
            await offlineStorage.removeGeocache(eventId);
            invalidatedIds.add(eventId);
            invalidatedCount++;
          }
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
              if (cacheCoordinate === coordinate && !invalidatedIds.has(cache.id)) {
                await offlineStorage.removeGeocache(cache.id);
                await offlineStorage.removeEvent(cache.id);
                invalidatedIds.add(cache.id);
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
      
      // Only invalidate specific queries, not all geocache data
      for (const invalidatedId of invalidatedIds) {
        queryClient.removeQueries({ queryKey: ['geocache', invalidatedId] });
        queryClient.removeQueries({ queryKey: ['geocache-logs', invalidatedId] });
      }
      
      // Refetch main geocaches list to reflect deletions
      queryClient.invalidateQueries({ 
        queryKey: ['geocaches'],
        refetchType: 'active' // Only refetch if actively being used
      });
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
      // Get geocaches that haven't been validated in the last 7 days (increased from 24 hours)
      const unvalidatedCaches = await offlineStorage.getUnvalidatedGeocaches(7 * 24 * 60 * 60 * 1000);
      if (unvalidatedCaches.length === 0) return;

      // Limit validation batch size for performance - smaller batches
      const sample = unvalidatedCaches.slice(0, Math.min(QUERY_LIMITS.BATCH_SIZE, 5));
      const eventIds = sample.map(cache => cache.id);
      
      console.log(`Validating ${eventIds.length} cached geocaches...`);
      
      const signal = AbortSignal.timeout(TIMEOUTS.QUERY);
      
      try {
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

        // Only remove geocaches that definitely no longer exist
        // Be conservative - only remove if we got a successful response but the cache wasn't found
        if (deletedIds.length > 0 && existingEvents.length > 0) {
          console.log(`Found ${deletedIds.length} geocaches that no longer exist upstream`);
          
          for (const deletedId of deletedIds) {
            await invalidateGeocache(deletedId);
          }
        } else if (deletedIds.length > 0) {
          console.log(`Skipping removal of ${deletedIds.length} geocaches - query may have failed`);
        }

        console.log(`Validation complete: ${existingIds.size} confirmed, ${deletedIds.length} removed`);
      } catch (queryError) {
        console.warn('Validation query failed, skipping cache removal:', queryError);
        // Don't remove caches if the query failed - network might be unreliable
      }
    } catch (error) {
      console.warn('Failed to validate cached geocaches:', error);
    }
  }, [isOnline, isConnected, nostr, invalidateGeocache]);

  // Periodic validation of cached data
  useEffect(() => {
    if (!isOnline || !isConnected) return;

    // Validate caches using background sync interval
    const interval = setInterval(validateCachedGeocaches, POLLING_INTERVALS.BACKGROUND_SYNC);
    
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
 * Create a deletion event template for a geocache
 * Note: This returns an unsigned event template that needs to be signed before publishing
 */
export function createDeletionEventTemplate(geocacheEvent: NostrEvent, reason?: string) {
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

  return deletionEventTemplate;
}