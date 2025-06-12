/**
 * Hook for optimized geocache navigation that pre-populates cache data
 * to avoid unnecessary re-fetching when navigating from lists to details
 */

import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { geocacheToNaddr } from '@/shared/utils/naddr';
import type { Geocache } from '@/types/geocache';

export function useGeocacheNavigation() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  /**
   * Navigate to a geocache details page with optimized caching
   * Pre-populates the cache to avoid re-fetching data we already have
   */
  const navigateToGeocache = useCallback((geocache: Geocache, options?: { fromMap?: boolean }) => {
    const naddr = geocacheToNaddr(geocache.pubkey, geocache.dTag, geocache.relays);
    
    // Pre-populate the cache with the geocache data we already have
    queryClient.setQueryData(['geocache-by-naddr', naddr], geocache);
    
    // Also set a longer stale time for this specific query to prevent immediate refetch
    queryClient.setQueryDefaults(['geocache-by-naddr', naddr], {
      staleTime: 5 * 60 * 1000, // 5 minutes
    });

    console.log('🚀 Pre-populated cache for geocache navigation:', geocache.name);
    
    // Navigate with optional query params
    const searchParams = new URLSearchParams();
    if (options?.fromMap) {
      searchParams.set('fromMap', 'true');
    }
    
    const url = `/${naddr}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
    navigate(url);
  }, [navigate, queryClient]);

  /**
   * Pre-populate cache for multiple geocaches (useful for prefetching)
   */
  const prePopulateGeocaches = useCallback((geocaches: Geocache[]) => {
    geocaches.forEach(geocache => {
      const naddr = geocacheToNaddr(geocache.pubkey, geocache.dTag, geocache.relays);
      queryClient.setQueryData(['geocache-by-naddr', naddr], geocache);
    });
    
    console.log('🚀 Pre-populated cache for', geocaches.length, 'geocaches');
  }, [queryClient]);

  /**
   * Check if a geocache is already cached
   */
  const isGeocacheCached = useCallback((pubkey: string, dTag: string, relays?: string[]) => {
    const naddr = geocacheToNaddr(pubkey, dTag, relays);
    const cachedData = queryClient.getQueryData(['geocache-by-naddr', naddr]);
    return !!cachedData;
  }, [queryClient]);

  return {
    navigateToGeocache,
    prePopulateGeocaches,
    isGeocacheCached,
  };
}