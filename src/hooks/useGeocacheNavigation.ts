/**
 * Hook for optimized geocache navigation that pre-populates cache data
 * to avoid unnecessary re-fetching when navigating from lists to details
 */

import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { geocacheToNaddr } from '@/utils/naddr';
import type { Geocache } from '@/types/geocache';

export function useGeocacheNavigation() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  /**
   * Build the in-app URL for a geocache without navigating. Useful for
   * middle-click / Ctrl+click open-in-new-tab handlers and `<a>` href values.
   */
  const getGeocacheUrl = useCallback((geocache: Geocache, options?: { fromMap?: boolean }) => {
    if (!geocache) return '/';
    const naddr = geocacheToNaddr(geocache.pubkey, geocache.dTag, geocache.relays, geocache.kind);
    const searchParams = new URLSearchParams();
    if (options?.fromMap) {
      searchParams.set('fromMap', 'true');
    }
    return `/${naddr}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
  }, []);

  /**
   * Navigate to a geocache details page with optimized caching
   * Pre-populates the cache to avoid re-fetching data we already have
   */
  const navigateToGeocache = useCallback((geocache: Geocache, options?: { fromMap?: boolean }) => {
    // Defensive: callers (e.g. Leaflet `popupclose` handlers firing during
    // map teardown on route changes) can hand us a null geocache. Bail out
    // rather than crash the app trying to read .pubkey off of nothing.
    if (!geocache) return;

    const naddr = geocacheToNaddr(geocache.pubkey, geocache.dTag, geocache.relays, geocache.kind);

    // Pre-populate the cache with the geocache data we already have
    queryClient.setQueryData(['geocache-by-naddr', naddr], geocache);

    // Also set a longer stale time for this specific query to prevent immediate refetch
    queryClient.setQueryDefaults(['geocache-by-naddr', naddr], {
      staleTime: 5 * 60 * 1000, // 5 minutes
    });

    console.log('🚀 Pre-populated cache for geocache navigation:', geocache.name);

    navigate(getGeocacheUrl(geocache, options));
  }, [navigate, queryClient, getGeocacheUrl]);

  /**
   * Pre-populate cache for multiple geocaches (useful for prefetching)
   */
  const prePopulateGeocaches = useCallback((geocaches: Geocache[]) => {
    geocaches.forEach(geocache => {
      const naddr = geocacheToNaddr(geocache.pubkey, geocache.dTag, geocache.relays, geocache.kind);
      queryClient.setQueryData(['geocache-by-naddr', naddr], geocache);
    });
    
    console.log('🚀 Pre-populated cache for', geocaches.length, 'geocaches');
  }, [queryClient]);

  /**
   * Check if a geocache is already cached
   */
  const isGeocacheCached = useCallback((pubkey: string, dTag: string, relays?: string[], kind?: number) => {
    const naddr = geocacheToNaddr(pubkey, dTag, relays, kind);
    const cachedData = queryClient.getQueryData(['geocache-by-naddr', naddr]);
    return !!cachedData;
  }, [queryClient]);

  return {
    navigateToGeocache,
    getGeocacheUrl,
    prePopulateGeocaches,
    isGeocacheCached,
  };
}