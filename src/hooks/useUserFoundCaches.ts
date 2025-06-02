import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';
import { NostrEvent, NostrFilter } from '@nostrify/nostrify';
import { useCurrentUser } from './useCurrentUser';
import { useNostrQueryRelays } from './useNostrQueryRelays';
import type { GeocacheLog, Geocache } from '@/types/geocache';
import { NIP_GC_KINDS, parseLogEvent, parseGeocacheEvent, createGeocacheCoordinate } from '@/lib/nip-gc';

interface FoundCache {
  id: string;
  dTag: string;
  pubkey: string;
  name: string;
  foundAt: number;
  logId: string;
  logText: string;
  location: {
    lat: number;
    lng: number;
  };
  difficulty: number;
  terrain: number;
  size: string;
  type: string;
  foundCount?: number;
  logCount?: number;
}

export function useUserFoundCaches(targetPubkey?: string) {
  const { user } = useCurrentUser();
  const { nostr } = useNostr();
  const { queryWithRelays } = useNostrQueryRelays();

  // Use provided pubkey or fall back to current user's pubkey
  const pubkey = targetPubkey || user?.pubkey;

  return useQuery({
    queryKey: ['user-found-caches', pubkey],
    queryFn: async (c) => {
      if (!pubkey) {
        return [];
      }

      try {
        const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);
        
        // First, get all "found" logs by the user
        const logFilter: NostrFilter = {
          kinds: [NIP_GC_KINDS.LOG],
          authors: [pubkey],
          limit: 500,
        };
        
        const logEvents = await queryWithRelays([logFilter], { signal });
        
        // Parse and filter for "found" logs
        const foundLogs: (GeocacheLog & { geocachePubkey?: string; geocacheDTag?: string })[] = [];
        
        for (const event of logEvents) {
          const parsed = parseLogEvent(event);
          if (parsed && parsed.type === 'found') {
            // Extract geocache info from a-tag
            const aTag = event.tags.find(t => t[0] === 'a')?.[1];
            if (aTag) {
              const [, pubkey, dTag] = aTag.split(':');
              foundLogs.push({
                ...parsed,
                geocachePubkey: pubkey,
                geocacheDTag: dTag,
              });
            }
          }
        }
        
        if (foundLogs.length === 0) {
          return [];
        }
        
        // Get unique geocache references
        const geocacheRefs = Array.from(new Set(
          foundLogs.map(log => `${log.geocachePubkey}:${log.geocacheDTag}`)
        ));
        
        // Fetch the actual geocache events
        const geocacheFilters: NostrFilter[] = geocacheRefs.map(ref => {
          const [pubkey, dTag] = ref.split(':');
          return {
            kinds: [NIP_GC_KINDS.GEOCACHE],
            authors: [pubkey],
            '#d': [dTag],
            limit: 1,
          };
        });
        
        const geocacheEvents = await queryWithRelays(geocacheFilters, { signal });
        
        // Parse geocaches
        const geocaches = new Map<string, Geocache>();
        for (const event of geocacheEvents) {
          const parsed = parseGeocacheEvent(event);
          if (parsed) {
            const ref = `${parsed.pubkey}:${parsed.dTag}`;
            geocaches.set(ref, parsed);
          }
        }
        
        // Now fetch log counts for each geocache
        const logCountFilters: NostrFilter[] = geocacheRefs.map(ref => {
          const [pubkey, dTag] = ref.split(':');
          return {
            kinds: [NIP_GC_KINDS.LOG],
            '#a': [createGeocacheCoordinate(pubkey, dTag)],
            limit: 1000, // Get all logs to count them
          };
        });
        
        const allLogEvents = await queryWithRelays(logCountFilters, { signal });
        
        // Group logs by geocache and count them
        const logCounts = new Map<string, { total: number; found: number }>();
        
        for (const logEvent of allLogEvents) {
          const aTag = logEvent.tags.find(t => t[0] === 'a')?.[1];
          if (aTag) {
            const [, pubkey, dTag] = aTag.split(':');
            const ref = `${pubkey}:${dTag}`;
            
            const logType = logEvent.tags.find(t => t[0] === 'log-type')?.[1];
            
            if (!logCounts.has(ref)) {
              logCounts.set(ref, { total: 0, found: 0 });
            }
            
            const counts = logCounts.get(ref)!;
            counts.total++;
            
            if (logType === 'found') {
              counts.found++;
            }
          }
        }
        
        // Combine found logs with geocache data and counts
        const foundCaches: FoundCache[] = [];
        
        for (const log of foundLogs) {
          const ref = `${log.geocachePubkey}:${log.geocacheDTag}`;
          const geocache = geocaches.get(ref);
          const counts = logCounts.get(ref) || { total: 0, found: 0 };
          
          if (geocache) {
            foundCaches.push({
              id: geocache.id,
              dTag: geocache.dTag,
              pubkey: geocache.pubkey,
              name: geocache.name,
              foundAt: log.created_at,
              logId: log.id,
              logText: log.text,
              location: geocache.location,
              difficulty: geocache.difficulty,
              terrain: geocache.terrain,
              size: geocache.size,
              type: geocache.type,
              foundCount: counts.found,
              logCount: counts.total,
            });
          }
        }
        
        // Sort by found date (newest first)
        foundCaches.sort((a, b) => b.foundAt - a.foundAt);
        
        return foundCaches;
        
      } catch (error) {
        throw error;
      }
    },
    enabled: !!pubkey,
    retry: 1,
    retryDelay: 1000,
    staleTime: 60000, // 1 minute
    gcTime: 300000, // 5 minutes
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });
}

// parseLogEvent and parseGeocacheEvent are now imported from @/lib/nip-gc

export type { FoundCache };