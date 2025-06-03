/**
 * Example hook using the unified Nostr system
 * This replaces Safari-specific workarounds with a simple, consistent interface
 */

import { useNostrQuery } from '@/hooks/useUnifiedNostr';
import { NIP_GC_KINDS, parseGeocacheEvent } from '@/lib/nip-gc';

export function useGeocaches() {
  const { data: result, ...queryState } = useNostrQuery(
    ['geocaches'],
    [{ 
      kinds: [NIP_GC_KINDS.GEOCACHE], 
      '#t': ['geocache'], 
      limit: 100 
    }],
    {
      timeout: 8000, // Automatically optimized for all browsers
      staleTime: 60000, // 1 minute
      gcTime: 300000, // 5 minutes
      refetchOnWindowFocus: false,
    }
  );

  // Parse and transform the events
  const geocaches = result?.events?.map(event => {
    const parsed = parseGeocacheEvent(event);
    if (!parsed) return null;
    return {
      ...parsed,
      foundCount: 0, // Could be enhanced with additional queries
      logCount: 0,
    };
  }).filter(Boolean) || [];

  return {
    ...queryState,
    data: geocaches,
    events: result?.events || [],
    sources: result?.sources || new Map(),
    errors: result?.errors || new Map(),
  };
}

/**
 * Hook for getting geocaches near a specific location
 */
export function useNearbyGeocaches(lat?: number, lon?: number, radiusKm = 50) {
  return useNostrQuery(
    ['nearby-geocaches', lat, lon, radiusKm],
    [{ 
      kinds: [NIP_GC_KINDS.GEOCACHE], 
      '#t': ['geocache'],
      // Note: Nostr doesn't have built-in geo queries, so we fetch all and filter client-side
      // In a real implementation, you might use specialized relays or additional filters
      limit: 500 
    }],
    {
      enabled: lat !== undefined && lon !== undefined,
      timeout: 10000,
      staleTime: 120000, // 2 minutes for location-based data
    }
  );
}

/**
 * Hook for getting a specific geocache by coordinate (kind:pubkey:d-tag)
 */
export function useGeocacheByCoordinate(coordinate?: string) {
  const parts = coordinate?.split(':');
  const kind = parts?.[0] ? parseInt(parts[0]) : undefined;
  const pubkey = parts?.[1];
  const dTag = parts?.[2];

  return useNostrQuery(
    ['geocache-by-coordinate', coordinate],
    kind && pubkey && dTag ? [{
      kinds: [kind],
      authors: [pubkey],
      '#d': [dTag],
      limit: 1
    }] : [],
    {
      enabled: !!(kind && pubkey && dTag),
      timeout: 6000,
      staleTime: 300000, // 5 minutes for individual geocaches
    }
  );
}