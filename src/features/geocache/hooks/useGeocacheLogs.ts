import { useQuery } from '@tanstack/react-query';
import { useIsWotEnabled } from '@/shared/utils/wot';
import { useWotStore } from '@/shared/stores/useWotStore';
import { verifyEmbeddedVerification, getEmbeddedVerification } from '@/features/geocache/utils/verification';
import { useNostr } from '@nostrify/react';
import { TIMEOUTS, QUERY_LIMITS } from '@/lib/constants';
import { NIP_GC_KINDS, parseLogEvent } from '@/features/geocache/utils/nip-gc';
import { separateQueries } from '@/shared/utils/batchQuery';

export function useGeocacheLogs(_geocacheId: string, geocacheDTag?: string, geocachePubkey?: string, _preferredRelays?: string[], verificationPubkey?: string, geocacheKind?: number) {
  const isWotEnabled = useIsWotEnabled();
  const { wotPubkeys } = useWotStore();
  const { nostr } = useNostr();
  
  return useQuery({
    queryKey: ['geocache-logs', geocacheDTag, geocachePubkey, verificationPubkey, geocacheKind, isWotEnabled, Array.from(wotPubkeys).sort().join(',')],
    queryFn: async () => {
      if (!geocachePubkey || !geocacheDTag) {
        return [];
      }

      try {
        // Query directly for logs for this geocache instead of using store
        // Use the geocache's kind if provided, otherwise default to the new kind
        const kind = geocacheKind || NIP_GC_KINDS.GEOCACHE;
        const geocacheCoordinate = `${kind}:${geocachePubkey}:${geocacheDTag}`;
        const signal = AbortSignal.any([AbortSignal.timeout(TIMEOUTS.QUERY)]);
        // We need to query for logs using both the legacy kind AND the new kind
        // This is the key difference from useGeocaches which works correctly
        const legacyCoordinate = geocacheKind === NIP_GC_KINDS.GEOCACHE_LEGACY 
          ? geocacheCoordinate 
          : `${NIP_GC_KINDS.GEOCACHE_LEGACY}:${geocachePubkey}:${geocacheDTag}`;

        // Query for logs intelligently to avoid duplicates
        // For found logs, query both coordinates with #a tag (most common)
        // For comment logs, query both coordinates but only use #a OR #A, not both
        const events = await separateQueries(nostr, [
          // Found logs for new coordinate
          {
            filters: {
              kinds: [NIP_GC_KINDS.FOUND_LOG],
              '#a': [geocacheCoordinate],
              limit: QUERY_LIMITS.LOGS,
            },
            name: 'found-logs-new'
          },
          // Found logs for legacy coordinate  
          {
            filters: {
              kinds: [NIP_GC_KINDS.FOUND_LOG],
              '#a': [legacyCoordinate],
              limit: QUERY_LIMITS.LOGS,
            },
            name: 'found-logs-legacy'
          },
          // Comment logs - use #a tag for both coordinates (most common)
          {
            filters: {
              kinds: [NIP_GC_KINDS.COMMENT_LOG],
              '#a': [geocacheCoordinate],
              limit: QUERY_LIMITS.LOGS,
            },
            name: 'comment-logs-a-new'
          },
          {
            filters: {
              kinds: [NIP_GC_KINDS.COMMENT_LOG],
              '#a': [legacyCoordinate],
              limit: QUERY_LIMITS.LOGS,
            },
            name: 'comment-logs-a-legacy'
          }
        ], signal);

        // Parse logs but keep the raw events for verification
        const parsedLogs = events.map(event => ({
          event,
          parsed: parseLogEvent(event)
        }));
        
        const successfullyParsedLogs = parsedLogs.filter(item => item.parsed !== null);
        
        let logs = successfullyParsedLogs.map(item => item.parsed);

        // Deduplicate by event ID to handle React 18's double-rendering in development
        const seenIds = new Set();
        logs = logs.filter(log => {
          if (!log || seenIds.has(log.id)) {
            return false;
          }
          seenIds.add(log.id);
          return true;
        });

        // Successfully parsed logs, continue with filtering

        // Filter out verification events (only actual verification events, not regular logs)
        logs = logs.filter(log => {
          if (!log) return false;
          // Only filter out if it's a found log (verification logs are found logs with embedded verification)
          // Don't filter out comment logs from the cache owner
          if (verificationPubkey && log.pubkey === verificationPubkey && log.type === 'found') {
            return false;
          }
          return true;
        });
        
        // Successfully filtered logs, continue with processing

        // Perform verification validation if verification pubkey is available
        if (verificationPubkey) {
          const verificationPromises = logs.map(async (log) => {
            if (!log) return log;
            
            // Find the corresponding event for this log
            const event = parsedLogs.find(item => item.parsed?.id === log.id)?.event;
            if (!event) return log;
            
            // Quick check for embedded verification
            const embeddedVerification = getEmbeddedVerification(event);
            
            if (embeddedVerification) {
              try {
                const isValid = await verifyEmbeddedVerification(event, verificationPubkey);
                log.isVerified = isValid;
              } catch (error) {
                // If verification fails, mark as unverified but don't fail the whole operation
                console.warn('Verification check failed for event:', log.id, error);
                log.isVerified = false;
              }
            } else {
              // If there's no embedded verification, we can't verify, so mark as unverified
              log.isVerified = false;
            }
            
            return log;
          });
          
          // Wait for all verifications to complete and update in place
          const verificationResults = await Promise.allSettled(verificationPromises);
          verificationResults.forEach((result, index) => {
            if (result.status === 'fulfilled' && result.value) {
              logs[index] = result.value;
            }
          });
        }

        // Apply WoT filtering if enabled
        if (isWotEnabled && wotPubkeys.size > 0) {
          logs = logs.filter(log => log && wotPubkeys.has(log.pubkey));
        }

        // Sort by creation date (newest first)
        logs.sort((a, b) => (b?.created_at || 0) - (a?.created_at || 0));

        // Return the final processed logs

        return logs;
      } catch (error) {
        console.warn('Failed to fetch geocache logs:', error);
        throw error;
      }
    },
    enabled: !!(geocacheDTag && geocachePubkey),
    staleTime: 300000, // 5 minutes - increased for better caching
    gcTime: 600000, // 10 minutes - cache retention
    refetchOnWindowFocus: false,
    refetchInterval: false, // No background sync
    refetchIntervalInBackground: false, // Disabled background sync
  });
}