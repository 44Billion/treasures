import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { NostrEvent } from '@nostrify/nostrify';
import type { GeocacheLog } from '@/types/geocache';
import { NIP_GC_KINDS, parseLogEvent, createGeocacheCoordinate } from '@/lib/nip-gc';
import { verifyEmbeddedVerification, getEmbeddedVerification } from '@/lib/verification';
import { TIMEOUTS, POLLING_INTERVALS, QUERY_LIMITS } from '@/lib/constants';
import { useDeletionFilter } from '@/hooks/useDeletionFilter';
import { cacheManager } from '@/lib/cacheManager';

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

      // Check LRU cache first - if we have fresh data, use it
      const cacheKey = `${geocachePubkey}:${geocacheDTag}`;
      const cached = cacheManager.getLogs(cacheKey);
      if (cached && cached.length > 0) {
        const validation = cacheManager.validateLogs(cacheKey, 240000); // 4 minutes
        if (validation.isValid && !c.meta?.forceRefresh) {
          return cached;
        }
      }

      try {
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
        if (allEvents.length === 0) {
          // If network returned empty but we have cache, return cache
          if (cached && cached.length > 0) {
            console.log('Network returned no logs, serving from cache');
            return cached;
          }
          return [];
        }

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

          // Update LRU cache with fresh data ONLY if we got results
          if (logs.length > 0) {
            cacheManager.setLogs(cacheKey, logs);
            return logs;
          } else {
            // If processing returned empty but we have cache, return cache
            if (cached && cached.length > 0) {
              console.log('Processing returned no logs, serving from cache');
              return cached;
            }
            return [];
          }
        } catch (error) {
          console.error('Error processing geocache logs:', error);
          // If processing failed but we have cache, return cache
          if (cached && cached.length > 0) {
            console.log('Processing failed, serving from cache');
            return cached;
          }
          return [];
        }
      } catch (error) {
        // If network fails and we have cache, return cache instead of failing
        if (cached && cached.length > 0) {
          console.log('Network failed for logs, serving from cache:', error);
          return cached;
        }
        // Only throw if we have no fallback data
        throw error;
      }
    },
    enabled: !!(geocacheDTag && geocachePubkey),
    staleTime: 240000, // 4 minutes - longer stale time since we have LRU cache
    gcTime: 900000, // 15 minutes - longer cache retention
    refetchOnWindowFocus: false,
    refetchInterval: POLLING_INTERVALS.LOGS, // Background polling for real updates
    refetchIntervalInBackground: true, // Continue polling in background
    // Use LRU cache as placeholder data
    placeholderData: (previousData) => {
      if (previousData) return previousData;
      if (!geocachePubkey || !geocacheDTag) return undefined;
      const cacheKey = `${geocachePubkey}:${geocacheDTag}`;
      const cached = cacheManager.getLogs(cacheKey);
      return cached && cached.length > 0 ? cached : undefined;
    },
    // Prevent clearing data on background refetch failures
    keepPreviousData: true,
    // Don't retry background failures aggressively
    retry: (failureCount, error) => {
      // Don't retry timeout errors in background
      if (error?.message?.includes('timeout') && failureCount > 0) {
        return false;
      }
      return failureCount < 2;
    },
  });
}

// parseLogEvent is now imported from @/lib/nip-gc