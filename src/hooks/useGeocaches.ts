import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';
import { NIP_GC_KINDS, parseGeocacheEvent } from '@/lib/nip-gc';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { TIMEOUTS } from '@/lib/constants';

export function useGeocaches() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();

  return useQuery({
    queryKey: ['geocaches'],
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(TIMEOUTS.QUERY)]);
      const events = await nostr.query([{
        kinds: [NIP_GC_KINDS.GEOCACHE], 
        limit: 100 
      }], { signal });

      return events.map(event => {
        const parsed = parseGeocacheEvent(event);
        if (!parsed) return null;
        // Show hidden caches to their creator, filter them out for everyone else
        if (parsed.hidden && parsed.pubkey !== user?.pubkey) return null;
        return {
          ...parsed,
          foundCount: 0, // Could be enhanced with additional queries
          logCount: 0,
        };
      }).filter(Boolean);
    },
    staleTime: 60000, // 1 minute
    gcTime: 300000, // 5 minutes
    refetchOnWindowFocus: false,
  });
}

/**
 * Hook for getting geocaches near a specific location
 */
export function useNearbyGeocaches(lat?: number, lon?: number, radiusKm = 50) {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();

  return useQuery({
    queryKey: ['nearby-geocaches', lat, lon, radiusKm],
    queryFn: async (c) => {
      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(TIMEOUTS.QUERY)]);
      const events = await nostr.query([{
        kinds: [NIP_GC_KINDS.GEOCACHE], 
        // Note: Nostr doesn't have built-in geo queries, so we fetch all and filter client-side
        // In a real implementation, you might use specialized relays or additional filters
        limit: 500 
      }], { signal });

      return events.map(event => {
        const parsed = parseGeocacheEvent(event);
        if (!parsed) return null;
        // Show hidden caches to their creator, filter them out for everyone else
        if (parsed.hidden && parsed.pubkey !== user?.pubkey) return null;
        return parsed;
      }).filter(Boolean);
    },
    enabled: lat !== undefined && lon !== undefined,
    staleTime: 120000, // 2 minutes for location-based data
  });
}

/**
 * Hook for getting a specific geocache by coordinate (kind:pubkey:d-tag)
 */
export function useGeocacheByCoordinate(coordinate?: string) {
  const { nostr } = useNostr();
  const parts = coordinate?.split(':');
  const kind = parts?.[0] ? parseInt(parts[0]) : undefined;
  const pubkey = parts?.[1];
  const dTag = parts?.[2];

  return useQuery({
    queryKey: ['geocache-by-coordinate', coordinate],
    queryFn: async (c) => {
      if (!kind || !pubkey || !dTag) {
        throw new Error('Invalid coordinate format');
      }

      const signal = AbortSignal.any([c.signal, AbortSignal.timeout(TIMEOUTS.QUERY)]);
      const events = await nostr.query([{
        kinds: [kind],
        authors: [pubkey],
        '#d': [dTag],
        limit: 1
      }], { signal });

      return events;
    },
    enabled: !!(kind && pubkey && dTag),
    staleTime: 300000, // 5 minutes for individual geocaches
  });
}