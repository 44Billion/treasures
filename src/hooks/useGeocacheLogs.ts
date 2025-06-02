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
      console.log('🔄 [GEOCACHE LOGS] Starting query for geocache:', {
        geocacheId,
        dTag: geocacheDTag,
        pubkey: geocachePubkey
      });
      
      try {
        const signal = AbortSignal.any([c.signal, AbortSignal.timeout(3000)]); // Fast 3 second timeout
      
      // Query for logs using the correct event kind from NIP-GC
      const filter: NostrFilter = {
        kinds: [NIP_GC_KINDS.LOG],
        limit: 200, // Reasonable limit
      };
      
      // If we have the cache pubkey and d-tag, use the a-tag filter
      if (geocachePubkey && geocacheDTag) {
        filter['#a'] = [createGeocacheCoordinate(geocachePubkey, geocacheDTag)];
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

      // Filter out verification events - these should not be visible in logs
      // Only actual user log entries should be displayed
      const filteredEvents = deduplicatedEvents.filter(event => {
        // Exclude NIP-32 label events (verification events created by cache verification key)
        if (event.kind === 1985) {
          console.log('Filtering out NIP-32 verification event:', event.id.slice(0, 8));
          return false;
        }
        
        // Exclude any events signed by the verification pubkey
        // These are internal verification events, not user logs
        if (verificationPubkey && event.pubkey === verificationPubkey) {
          console.log('Filtering out event signed by verification key:', {
            eventId: event.id.slice(0, 8),
            eventPubkey: event.pubkey,
            verificationPubkey
          });
          return false;
        }
        
        return true;
      });
      
      console.log(`Filtered out ${deduplicatedEvents.length - filteredEvents.length} verification events`);

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
              console.log('Found embedded verification:', {
                logId: event.id.slice(0, 8),
                embeddedVerificationId: embeddedVerification.id.slice(0, 8),
                logPubkey: event.pubkey,
                verificationPubkey: embeddedVerification.pubkey
              });
              
              // Verify the embedded verification event
              const isValid = verifyEmbeddedVerification(event, verificationPubkey);
              parsed.isVerified = isValid;
              if (isValid) {
                console.log('✅ Embedded verification is valid for log:', event.id.slice(0, 8));
              } else {
                console.log('❌ Embedded verification is invalid for log:', event.id.slice(0, 8));
              }
            }
          }
          
          return parsed;
        })
        .filter((log): log is GeocacheLog => log !== null);
      
      console.log('Parsing results:', {
        totalEvents: deduplicatedEvents.length,
        filteredEvents: filteredEvents.length,
        parsedSuccessfully: logs.length,
        failedToParse: filteredEvents.length - logs.length,
        verificationEventsFiltered: deduplicatedEvents.length - filteredEvents.length
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

// parseLogEvent is now imported from @/lib/nip-gc