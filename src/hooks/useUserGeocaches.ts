import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNostrQueryRelays } from './useNostrQueryRelays';
import type { Geocache } from '@/types/geocache';
import { NostrFilter } from '@nostrify/nostrify';

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
            kinds: [37515], 
            authors: [pubkey],
            limit: 100
          }],
          { signal }
        );
        
        console.log('Found', geocacheEvents.length, 'geocache events');
        
        if (geocacheEvents.length === 0) {
          return [];
        }
        
        // Parse geocaches first
        const geocaches = geocacheEvents.map(event => {
          const name = event.tags.find(tag => tag[0] === 'name')?.[1] || 'Unnamed Cache';
          const description = event.content || '';
          const location = {
            lat: parseFloat(event.tags.find(tag => tag[0] === 'lat')?.[1] || '0'),
            lng: parseFloat(event.tags.find(tag => tag[0] === 'lng')?.[1] || '0'),
          };
          const difficulty = parseInt(event.tags.find(tag => tag[0] === 'difficulty')?.[1] || '1');
          const terrain = parseInt(event.tags.find(tag => tag[0] === 'terrain')?.[1] || '1');
          const size = event.tags.find(tag => tag[0] === 'size')?.[1] || 'regular';
          const type = event.tags.find(tag => tag[0] === 'type')?.[1] || 'traditional';
          const dTag = event.tags.find(tag => tag[0] === 'd')?.[1] || '';
          
          return {
            id: event.id,
            pubkey: event.pubkey,
            created_at: event.created_at,
            dTag,
            name,
            description,
            location,
            difficulty,
            terrain,
            size: size as "micro" | "small" | "regular" | "large",
            type: type as "traditional" | "multi" | "mystery" | "earth" | "virtual" | "letterbox" | "event",
            foundCount: 0, // Will be calculated below
            logCount: 0, // Will be calculated below
          } as Geocache;
        });
        
        // Now fetch log counts for each geocache
        console.log('Fetching log counts for user geocaches...');
        
        const logCountFilters: NostrFilter[] = geocaches.map(geocache => ({
          kinds: [37516], // Log events
          '#a': [`37515:${geocache.pubkey}:${geocache.dTag}`],
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
            
            const counts = logCounts.get(ref)!;
            counts.total++;
            
            if (logType === 'found') {
              counts.found++;
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
        geocachesWithCounts.sort((a, b) => b.created_at - a.created_at);
        
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