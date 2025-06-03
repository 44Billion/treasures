import { NostrEvent, NostrFilter } from '@nostrify/nostrify';
import type { GeocacheLog } from '@/types/geocache';
import { useNostrBatchQuery } from '@/hooks/useUnifiedNostr';
import { NIP_GC_KINDS, parseLogEvent, createGeocacheCoordinate } from '@/lib/nip-gc';
import { hasEmbeddedVerification, verifyEmbeddedVerification, getEmbeddedVerification } from '@/lib/verification';

export function useGeocacheLogs(geocacheId: string, geocacheDTag?: string, geocachePubkey?: string, preferredRelays?: string[], verificationPubkey?: string) {
  // Create filter groups for batch query
  const filterGroups: NostrFilter[][] = [];
  
  if (geocachePubkey && geocacheDTag) {
    const geocacheCoordinate = createGeocacheCoordinate(geocachePubkey, geocacheDTag);
    
    // Found logs filter
    filterGroups.push([{
      kinds: [NIP_GC_KINDS.FOUND_LOG],
      '#a': [geocacheCoordinate],
      limit: 100,
    }]);
    
    // Comment logs filter
    filterGroups.push([{
      kinds: [NIP_GC_KINDS.COMMENT_LOG],
      '#a': [geocacheCoordinate],
      '#A': [geocacheCoordinate],
      limit: 100,
    }]);
  }

  const { data: events, ...queryResult } = useNostrBatchQuery(
    ['geocache-logs', geocacheDTag, geocachePubkey, preferredRelays, verificationPubkey],
    filterGroups,
    {
      enabled: !!(geocacheDTag && geocachePubkey),
      timeout: 6000, // Automatically optimized per browser
      relays: preferredRelays,
      staleTime: 30000, // 30 seconds
      gcTime: 600000, // 10 minutes
      refetchOnWindowFocus: false,
    }
  );

  // Process the events
  const processedLogs = (() => {
    if (!events || events.length === 0) return [];

    try {
      // Additional filtering for edge cases
      let filteredEvents = events;
      if (!geocachePubkey || !geocacheDTag) {
        filteredEvents = events.filter(event => {
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
      const uniqueEvents = filteredEvents.reduce((acc, event) => {
        if (!acc.has(event.id)) {
          acc.set(event.id, event);
        }
        return acc;
      }, new Map<string, NostrEvent>());

      const deduplicatedEvents = Array.from(uniqueEvents.values());

      // Filter out verification events - these should not be visible in logs
      // Only actual user log entries should be displayed
      const finalEvents = deduplicatedEvents.filter(event => {
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
      const logs: GeocacheLog[] = finalEvents
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
      console.error('Error processing geocache logs:', error);
      return [];
    }
  })();

  return {
    ...queryResult,
    data: processedLogs,
  };
}

// parseLogEvent is now imported from @/lib/nip-gc