import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { NostrEvent, NostrFilter } from '@nostrify/nostrify';
import type { GeocacheLog } from '@/types/geocache';
import { NIP_GC_KINDS, parseLogEvent, createGeocacheCoordinate } from '@/lib/nip-gc';
import { hasEmbeddedVerification, verifyEmbeddedVerification, getEmbeddedVerification } from '@/lib/verification';
import { TIMEOUTS } from '@/lib/constants';

export function useGeocacheLogs(geocacheId: string, geocacheDTag?: string, geocachePubkey?: string, preferredRelays?: string[], verificationPubkey?: string) {
  const { nostr } = useNostr();
  
  return useQuery({
    queryKey: ['geocache-logs', geocacheDTag, geocachePubkey, preferredRelays, verificationPubkey],
    queryFn: async (c) => {
      if (!geocachePubkey || !geocacheDTag) {
        return [];
      }

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(TIMEOUTS.QUERY)]);
      const geocacheCoordinate = createGeocacheCoordinate(geocachePubkey, geocacheDTag);
      const allEvents: NostrEvent[] = [];
      
      // Query for found logs
      try {
        const foundLogs = await nostr.query([{
          kinds: [NIP_GC_KINDS.FOUND_LOG],
          '#a': [geocacheCoordinate],
          limit: 100,
        }], { signal });
        allEvents.push(...foundLogs);
      } catch (error) {
        console.warn('Failed to fetch found logs:', error);
      }
      
      // Query for comment logs
      try {
        const commentLogs = await nostr.query([{
          kinds: [NIP_GC_KINDS.COMMENT_LOG],
          '#a': [geocacheCoordinate],
          '#A': [geocacheCoordinate],
          limit: 100,
        }], { signal });
        allEvents.push(...commentLogs);
      } catch (error) {
        console.warn('Failed to fetch comment logs:', error);
      }

      // Process the events
      if (allEvents.length === 0) return [];

      try {
        // Remove duplicates by event ID
        const uniqueEvents = allEvents.reduce((acc, event) => {
          if (!acc.has(event.id)) {
            acc.set(event.id, event);
          }
          return acc;
        }, new Map<string, NostrEvent>());

        const deduplicatedEvents = Array.from(uniqueEvents.values());

        // Filter out verification events
        const finalEvents = deduplicatedEvents.filter(event => {
          if (event.kind === NIP_GC_KINDS.VERIFICATION) {
            return false;
          }
          
          if (verificationPubkey && event.pubkey === verificationPubkey) {
            return false;
          }
          
          return true;
        });

        // Parse log events and perform verification validation
        const logs: GeocacheLog[] = [];
        
        for (const event of finalEvents) {
          const parsed = parseLogEvent(event);
          if (parsed) {
            // Verify embedded verification events with proper signature validation
            // This is the ONLY place where isVerified should be set to true
            const embeddedVerification = getEmbeddedVerification(event);
            
            if (embeddedVerification && verificationPubkey) {
              // Only verify if we have both embedded verification AND the geocache's verification pubkey
              const isValid = await verifyEmbeddedVerification(event, verificationPubkey);
              parsed.isVerified = isValid;
            } else {
              // If there's no verification pubkey, we can't verify, so mark as unverified
              parsed.isVerified = false;
            }
            logs.push(parsed);
          }
        }

        // Sort by creation date (newest first)
        logs.sort((a, b) => b.created_at - a.created_at);

        return logs;
      } catch (error) {
        console.error('Error processing geocache logs:', error);
        return [];
      }
    },
    enabled: !!(geocacheDTag && geocachePubkey),
    staleTime: 30000, // 30 seconds
    gcTime: 600000, // 10 minutes
    refetchOnWindowFocus: false,
  });
}

// parseLogEvent is now imported from @/lib/nip-gc