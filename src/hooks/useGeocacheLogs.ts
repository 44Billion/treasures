import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { NostrEvent, NostrFilter } from '@nostrify/nostrify';
import type { GeocacheLog } from '@/types/geocache';
import { NIP_GC_KINDS, parseLogEvent, createGeocacheCoordinate } from '@/lib/nip-gc';
import { hasEmbeddedVerification, verifyEmbeddedVerification, getEmbeddedVerification } from '@/lib/verification';
import { TIMEOUTS, POLLING_INTERVALS, QUERY_LIMITS } from '@/lib/constants';
import { useDeletionFilter } from '@/hooks/useDeletionFilter';

export function useGeocacheLogs(geocacheId: string, geocacheDTag?: string, geocachePubkey?: string, preferredRelays?: string[], verificationPubkey?: string) {
  const { nostr } = useNostr();
  
  // Get deletion filter for filtering out deleted logs
  const { filterDeleted } = useDeletionFilter();
  
  return useQuery({
    queryKey: ['geocache-logs', geocacheDTag, geocachePubkey, preferredRelays, verificationPubkey],
    queryFn: async (c) => {
      if (!geocachePubkey || !geocacheDTag) {
        return [];
      }

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(TIMEOUTS.QUERY)]);
      const geocacheCoordinate = createGeocacheCoordinate(geocachePubkey, geocacheDTag);
      const allEvents: NostrEvent[] = [];
      
      // Query for found logs with increased limit for better caching
      try {
        const foundLogs = await nostr.query([{
          kinds: [NIP_GC_KINDS.FOUND_LOG],
          '#a': [geocacheCoordinate],
          limit: QUERY_LIMITS.LOGS,
        }], { signal });
        allEvents.push(...foundLogs);
      } catch (error) {
        console.warn('Failed to fetch found logs:', error);
      }
      
      // Query for comment logs with increased limit
      try {
        const commentLogs = await nostr.query([{
          kinds: [NIP_GC_KINDS.COMMENT_LOG],
          '#a': [geocacheCoordinate],
          '#A': [geocacheCoordinate],
          limit: QUERY_LIMITS.LOGS,
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

        // Filter out deleted events first, before any other processing
        const nonDeletedEvents = filterDeleted.fast(deduplicatedEvents);

        // Filter out verification events
        const finalEvents = nonDeletedEvents.filter(event => {
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
        
        // Batch verification for better performance
        const verificationPromises = finalEvents.map(async (event) => {
          const parsed = parseLogEvent(event);
          if (!parsed) return null;
          
          // Quick check for embedded verification
          const embeddedVerification = getEmbeddedVerification(event);
          
          if (embeddedVerification && verificationPubkey) {
            // Only verify if we have both embedded verification AND the geocache's verification pubkey
            try {
              const isValid = await verifyEmbeddedVerification(event, verificationPubkey);
              parsed.isVerified = isValid;
            } catch (error) {
              // If verification fails, mark as unverified but don't fail the whole operation
              console.warn('Verification check failed for event:', event.id, error);
              parsed.isVerified = false;
            }
          } else {
            // If there's no verification pubkey, we can't verify, so mark as unverified
            parsed.isVerified = false;
          }
          
          return parsed;
        });
        
        // Wait for all verifications to complete
        const verificationResults = await Promise.allSettled(verificationPromises);
        
        // Collect successful results
        for (const result of verificationResults) {
          if (result.status === 'fulfilled' && result.value) {
            logs.push(result.value);
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
    staleTime: 15000, // 15 seconds - logs change frequently
    gcTime: 900000, // 15 minutes - longer cache retention
    refetchOnWindowFocus: false,
    refetchInterval: POLLING_INTERVALS.LOGS, // Poll every 30 seconds
    refetchIntervalInBackground: true, // Continue polling in background
  });
}

// parseLogEvent is now imported from @/lib/nip-gc