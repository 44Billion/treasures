import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNostrQueryRelays } from './useNostrQueryRelays';
import type { Geocache } from '@/types/geocache';
import { NostrFilter } from '@nostrify/nostrify';
import { NIP_GC_KINDS, parseGeocacheEvent, createGeocacheCoordinate } from '@/lib/nip-gc';

export function useUserGeocaches(targetPubkey?: string) {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const { queryWithRelays } = useNostrQueryRelays();

  // Use provided pubkey or fall back to current user's pubkey
  const pubkey = targetPubkey || user?.pubkey;

  return useQuery({
    queryKey: ['user-geocaches', pubkey],
    queryFn: async (c) => {
      if (!pubkey || !nostr) return [];
      
      console.log('🔄 [USER GEOCACHES] Starting query for user:', pubkey.slice(0, 8));
      
      try {
        const signal = AbortSignal.any([c.signal, AbortSignal.timeout(10000)]);
        
        // First, get all geocaches by the user
        const geocacheEvents = await queryWithRelays(
          [{ 
            kinds: [NIP_GC_KINDS.GEOCACHE], 
            authors: [pubkey],
            limit: 100
          }],
          { signal }
        );
        
        console.log('Found', geocacheEvents.length, 'geocache events');
        
        if (geocacheEvents.length === 0) {
          return [];
        }
        
        // Parse geocaches according to NIP-GC
        const geocaches = geocacheEvents.map(event => {
          const parsed = parseGeocacheEvent(event);
          if (!parsed) {
            return null;
          }
          return {
            ...parsed,
            foundCount: 0, // Will be calculated below
            logCount: 0, // Will be calculated below
          };
        }).filter((geocache): geocache is NonNullable<typeof geocache> => geocache !== null);
        
        // Now fetch log counts for each geocache
        console.log('Fetching log counts for user geocaches...');
        
        const logCountFilters: NostrFilter[] = geocaches.map(geocache => ({
          kinds: [NIP_GC_KINDS.LOG],
          '#a': [createGeocacheCoordinate(geocache.pubkey, geocache.dTag)],
          limit: 1000, // Get all logs to count them
        }));
        
        const allLogEvents = await queryWithRelays(logCountFilters, { signal });
        console.log('Found', allLogEvents.length, 'total log events for user geocaches');
        
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
            
            const counts = logCounts.get(ref);
            if (counts) {
              counts.total++;
              
              if (logType === 'found') {
                counts.found++;
              }
            }
          }
        }
        
        console.log('User geocache log counts calculated:', Object.fromEntries(logCounts));
        
        // Update geocaches with counts
        const geocachesWithCounts = geocaches.map(geocache => {
          const ref = `${geocache.pubkey}:${geocache.dTag}`;
          const counts = logCounts.get(ref) || { total: 0, found: 0 };
          
          return {
            ...geocache,
            foundCount: counts.found,
            logCount: counts.total,
          };
        });
        
        // Sort by creation date (newest first)
        geocachesWithCounts.sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
        
        console.log('✅ [USER GEOCACHES] Final result:', geocachesWithCounts.length, 'geocaches with counts');
        
        return geocachesWithCounts;
        
      } catch (error) {
        console.error('❌ [USER GEOCACHES] Query failed:', error);
        throw error;
      }
    },
    enabled: !!pubkey && !!nostr,
    retry: 1,
    retryDelay: 1000,
    staleTime: 60000, // 1 minute
    gcTime: 300000, // 5 minutes
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });
}