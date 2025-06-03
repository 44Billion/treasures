import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';
import { NostrEvent, NostrFilter } from '@nostrify/nostrify';
import type { GeocacheLog } from '@/types/geocache';
import { useNostrQueryRelays } from './useNostrQueryRelays';
import { NIP_GC_KINDS, parseLogEvent, createGeocacheCoordinate } from '@/lib/nip-gc';
import { hasEmbeddedVerification, verifyEmbeddedVerification, getEmbeddedVerification } from '@/lib/verification';

export function useGeocacheLogs(geocacheId: string, geocacheDTag?: string, geocachePubkey?: string, preferredRelays?: string[], verificationPubkey?: string) {
  const { nostr } = useNostr();
  const { queryWithRelays } = useNostrQueryRelays();

  return useQuery({
    queryKey: ['geocache-logs', geocacheDTag, geocachePubkey, preferredRelays, verificationPubkey],
    queryFn: async (c) => {
      try {
        const signal = AbortSignal.any([c.signal, AbortSignal.timeout(3000)]); // Fast 3 second timeout
      
      // Query for both found logs (7516) and comment logs (1111) according to NIP-GC
      const foundLogFilter: NostrFilter = {
        kinds: [NIP_GC_KINDS.FOUND_LOG],
        limit: 100,
      };
      
      const commentLogFilter: NostrFilter = {
        kinds: [NIP_GC_KINDS.COMMENT_LOG],
        limit: 100,
      };
      
      // If we have the cache pubkey and d-tag, use the appropriate filters
      if (geocachePubkey && geocacheDTag) {
        const geocacheCoordinate = createGeocacheCoordinate(geocachePubkey, geocacheDTag);
        
        // Found logs use 'a' tag
        foundLogFilter['#a'] = [geocacheCoordinate];
        
        // Comment logs use both 'a' and 'A' tags (NIP-22 structure)
        commentLogFilter['#a'] = [geocacheCoordinate];
        commentLogFilter['#A'] = [geocacheCoordinate];
      }
      
      // Query both types of logs
      const [foundEvents, commentEvents] = await Promise.all([
        queryWithRelays([foundLogFilter], { signal, relays: preferredRelays }),
        queryWithRelays([commentLogFilter], { signal, relays: preferredRelays }),
      ]);
      
      // Combine all events
      let events = [...foundEvents, ...commentEvents];
      
      // Additional filtering for edge cases
      if (!geocachePubkey || !geocacheDTag) {
        events = events.filter(event => {
          if (event.kind === NIP_GC_KINDS.FOUND_LOG) {
            const aTag = event.tags.find(tag => tag[0] === 'a')?.[1];
            if (!aTag) return false;
            const [, pubkey, dTag] = aTag.split(':');
            return (dTag === geocacheDTag) || (geocacheId && aTag.includes(geocacheId));
          } else if (event.kind === NIP_GC_KINDS.COMMENT_LOG) {
            const aTag = event.tags.find(tag => tag[0] === 'a')?.[1];
            const ATag = event.tags.find(tag => tag[0] === 'A')?.[1];
            if (!aTag && !ATag) return false;
            
            // Check both a and A tags for geocache reference
            const checkTag = (tag: string) => {
              const [, pubkey, dTag] = tag.split(':');
              return (dTag === geocacheDTag) || (geocacheId && tag.includes(geocacheId));
            };
            
            return (aTag && checkTag(aTag)) || (ATag && checkTag(ATag));
          }
          return false;
        });
      }
    
      // Remove duplicates by event ID (multiple relays may return the same event)
      const uniqueEvents = events.reduce((acc, event) => {
        if (!acc.has(event.id)) {
          acc.set(event.id, event);
        }
        return acc;
      }, new Map<string, NostrEvent>());

      const deduplicatedEvents = Array.from(uniqueEvents.values());

      // Filter out verification events - these should not be visible in logs
      // Only actual user log entries should be displayed
      const filteredEvents = deduplicatedEvents.filter(event => {
        // Exclude verification events (kind 7517)
        if (event.kind === NIP_GC_KINDS.VERIFICATION) {
          return false;
        }
        
        // Exclude any events signed by the verification pubkey
        // These are internal verification events, not user logs
        if (verificationPubkey && event.pubkey === verificationPubkey) {
          return false;
        }
        
        return true;
      });

      // Parse log events using consolidated utility
      const logs: GeocacheLog[] = filteredEvents
        .map(event => {
          const parsed = parseLogEvent(event);
          if (parsed && 'sourceRelay' in event) {
            parsed.sourceRelay = (event as NostrEvent & { sourceRelay?: string }).sourceRelay;
          }
          
          // Check if this log has embedded verification
          if (parsed && verificationPubkey) {
            const embeddedVerification = getEmbeddedVerification(event);
            if (embeddedVerification) {
              // Verify the embedded verification event
              const isValid = verifyEmbeddedVerification(event, verificationPubkey);
              parsed.isVerified = isValid;
            }
          }
          
          return parsed;
        })
        .filter((log): log is GeocacheLog => log !== null);

      // Sort by creation date (newest first)
      logs.sort((a, b) => b.created_at - a.created_at);

      return logs;
    } catch (error) {
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

// parseLogEvent is now imported from @/lib/nip-gc