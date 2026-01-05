import { useState, useCallback } from 'react';
import { useGeocacheStoreContext } from '@/shared/stores/hooks';

/**
 * Hook for geocache list with pagination support
 * Provides loadMore functionality with loading state
 */
export function useGeocachesWithPagination() {
  const geocacheStore = useGeocacheStoreContext();
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const loadMore = useCallback(async () => {
    if (isLoadingMore || !geocacheStore.hasMore) {
      return;
    }

    setIsLoadingMore(true);
    try {
      await geocacheStore.loadMoreGeocaches();
    } catch (error) {
      console.error('Failed to load more geocaches:', error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [geocacheStore, isLoadingMore]);

  return {
    geocaches: geocacheStore.geocaches,
    isLoading: geocacheStore.isLoading,
    isError: geocacheStore.isError,
    error: geocacheStore.error,
    hasMore: geocacheStore.hasMore,
    isLoadingMore,
    loadMore,
  };
}
