/**
 * Unified Author Store
 * Consolidates all author/profile-related data management
 */

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { 
  useBaseStore, 
  createQueryKey, 
  batchOperations 
} from './baseStore';
import type { 
  AuthorStore, 
  AuthorStoreState, 
  AuthorMetadata,
  StoreConfig, 
  StoreActionResult 
} from './types';
import type { NostrEvent } from '@nostrify/nostrify';
import { useCurrentUser } from '@/features/auth/hooks/useCurrentUser';
import { TIMEOUTS } from '@/shared/config';
import { verifyNip05 } from '@/shared/utils/nip05';

/**
 * Unified author store hook
 */
export function useAuthorStore(config: Partial<StoreConfig> = {}): AuthorStore {
  const baseStore = useBaseStore('author', config);
  const { user } = useCurrentUser();
  
  // Store state
  const [state, setState] = useState<AuthorStoreState>(() => ({
    ...baseStore.createBaseState(),
    authors: {},
    currentUser: null,
    syncStatus: baseStore.getSyncStatus(),
    cacheStats: baseStore.getCacheStats(),
  }));

  // Update state helper - use useCallback to make it stable
  const updateState = useCallback((updates: Partial<AuthorStoreState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  // Update current user when user changes - use a ref to avoid hoisting issues
  const fetchAuthorRef = useRef<(pubkey: string) => Promise<StoreActionResult<AuthorMetadata>>>();
  
  useEffect(() => {
    if (user?.pubkey) {
      const currentUserMetadata = state.authors[user.pubkey];
      if (currentUserMetadata) {
        setState(prev => ({ ...prev, currentUser: currentUserMetadata }));
      } else if (fetchAuthorRef.current) {
        // Fetch current user metadata
        fetchAuthorRef.current(user.pubkey);
      }
    } else {
      setState(prev => ({ ...prev, currentUser: null }));
    }
  }, [user?.pubkey, state.authors]);

  // Data fetching actions
  const fetchAuthor = useCallback(async (pubkey: string): Promise<StoreActionResult<AuthorMetadata>> => {
    return baseStore.safeAsyncOperation(async () => {
      const { data: events } = await baseStore.batchQuery([{
        kinds: [0], // Profile metadata
        authors: [pubkey],
        limit: 1,
      }], 'fetchAuthor');

      const metadata = events?.[0] || null;
      const authorData: AuthorMetadata = {
        pubkey,
        metadata,
        nip05Verified: false,
        lastUpdate: new Date(),
      };

      // Verify NIP-05 if metadata contains nip05 field
      if (metadata?.content) {
        try {
          const content = JSON.parse(metadata.content);
          if (content.nip05) {
            authorData.nip05Verified = await verifyNip05(pubkey, content.nip05);
          }
        } catch (error) {
          console.warn('Failed to parse metadata or verify NIP-05:', error);
        }
      }

      return authorData;
    }, 'fetchAuthor');
  }, [baseStore]);

  // Set the ref after fetchAuthor is defined
  fetchAuthorRef.current = fetchAuthor;

  const fetchAuthors = useCallback(async (pubkeys: string[]): Promise<StoreActionResult<AuthorMetadata[]>> => {
    return baseStore.safeAsyncOperation(async () => {
      const uniquePubkeys = [...new Set(pubkeys)];
      
      const fetchedAuthors = await batchOperations(
        uniquePubkeys,
        async (pubkey) => {
          const result = await fetchAuthor(pubkey);
          return result.data!;
        },
        5 // Batch size
      );

      return fetchedAuthors;
    }, 'fetchAuthors');
  }, [baseStore, fetchAuthor]);

  // Profile management
  const updateProfileMutation = useMutation({
    mutationFn: async (metadata: Record<string, unknown>) => {
      if (!user?.signer) {
        throw new Error('No signer available');
      }

      const event = {
        kind: 0,
        content: JSON.stringify(metadata),
        tags: [],
        created_at: Math.floor(Date.now() / 1000),
      };

      const signedEvent = await user.signer.signEvent(event);
      
      // Publish to relay
      const signal = AbortSignal.timeout(TIMEOUTS.QUERY);
      await baseStore.nostr.event(signedEvent, { signal });
      
      return signedEvent;
    },
    onSuccess: (signedEvent) => {
      if (user?.pubkey) {
        // Update local cache immediately
        const authorData: AuthorMetadata = {
          pubkey: user.pubkey,
          metadata: signedEvent,
          nip05Verified: false, // Will be re-verified
          lastUpdate: new Date(),
        };
        
        updateState({
          authors: {
            ...state.authors,
            [user.pubkey]: authorData,
          },
          currentUser: authorData,
        });
        
        // Re-verify NIP-05 if present
        try {
          const content = JSON.parse(signedEvent.content);
          if (content.nip05) {
            verifyNip05(user.pubkey, content.nip05).then(verified => {
              updateState({
                authors: {
                  ...state.authors,
                  [user.pubkey]: {
                    ...authorData,
                    nip05Verified: verified,
                  },
                },
                currentUser: {
                  ...authorData,
                  nip05Verified: verified,
                },
              });
            });
          }
        } catch (error) {
          console.warn('Failed to re-verify NIP-05:', error);
        }
      }
    },
  });

  const updateProfile = useCallback(async (metadata: Record<string, unknown>): Promise<StoreActionResult<NostrEvent>> => {
    try {
      const result = await updateProfileMutation.mutateAsync(metadata);
      return baseStore.createSuccessResult(result);
    } catch (error) {
      return baseStore.createErrorResult(baseStore.handleError(error, 'updateProfile')) as StoreActionResult<NostrEvent>;
    }
  }, [updateProfileMutation, baseStore]);

  const verifyNip05Manual = useCallback(async (pubkey: string): Promise<StoreActionResult<boolean>> => {
    return baseStore.safeAsyncOperation(async () => {
      const author = state.authors[pubkey];
      if (!author?.metadata) {
        throw new Error('Author metadata not found');
      }

      const content = JSON.parse(author.metadata.content);
      if (!content.nip05) {
        return false;
      }

      const verified = await verifyNip05(pubkey, content.nip05);
      
      // Update cache
      updateState({
        authors: {
          ...state.authors,
          [pubkey]: {
            ...author,
            nip05Verified: verified,
          },
        },
      });

      return verified;
    }, 'verifyNip05');
  }, [baseStore, state.authors, updateState]);

  // Cache management
  const invalidateAuthor = useCallback((pubkey: string) => {
    baseStore.invalidateQueries(createQueryKey('author', 'fetch', pubkey));
    // Remove from local state
    const newAuthors = { ...state.authors };
    delete newAuthors[pubkey];
    updateState({ authors: newAuthors });
  }, [baseStore, state.authors, updateState]);

  const invalidateAll = useCallback(() => {
    baseStore.invalidateQueries(createQueryKey('author', 'fetch'));
    updateState({
      authors: {},
      currentUser: null,
    });
  }, [baseStore, updateState]);

  const refreshAuthor = useCallback(async (pubkey: string): Promise<StoreActionResult<AuthorMetadata>> => {
    invalidateAuthor(pubkey);
    return fetchAuthor(pubkey);
  }, [invalidateAuthor, fetchAuthor]);

  // Prefetching
  const prefetchAuthors = useCallback(async (pubkeys: string[]): Promise<void> => {
    const uniquePubkeys = [...new Set(pubkeys)];
    await batchOperations(
      uniquePubkeys,
      async (pubkey) => {
        await baseStore.prefetchQuery(
          createQueryKey('author', pubkey),
          () => fetchAuthor(pubkey).then(result => result.data!)
        );
      },
      5 // Batch size
    );
  }, [baseStore, fetchAuthor]);

  // Background sync
  const backgroundSyncFn = useCallback(async (pubkeys?: string[]) => {
    if (pubkeys) {
      // Sync specific authors
      await fetchAuthors(pubkeys);
    } else if (user?.pubkey) {
      // Sync current user
      await fetchAuthor(user.pubkey);
    }
  }, [fetchAuthors, fetchAuthor, user?.pubkey]);

  const startBackgroundSync = useCallback(() => {
    baseStore.startBackgroundSync(() => backgroundSyncFn());
    setState(prev => ({ ...prev, syncStatus: baseStore.getSyncStatus() }));
  }, [baseStore, backgroundSyncFn]);

  const stopBackgroundSync = useCallback(() => {
    baseStore.stopBackgroundSync();
    setState(prev => ({ ...prev, syncStatus: baseStore.getSyncStatus() }));
  }, [baseStore]);

  const triggerSync = useCallback(async (pubkeys?: string[]): Promise<StoreActionResult<void>> => {
    try {
      await backgroundSyncFn(pubkeys);
      return baseStore.createSuccessResult(undefined);
    } catch (error) {
      return baseStore.createErrorResult(baseStore.handleError(error, 'triggerSync')) as StoreActionResult<void>;
    }
  }, [backgroundSyncFn, baseStore]);

  // User management
  const setCurrentUser = useCallback((userMetadata: AuthorMetadata | null) => {
    updateState({ currentUser: userMetadata });
  }, [updateState]);

  // Configuration
  const updateConfig = useCallback((newConfig: Partial<StoreConfig>) => {
    baseStore.updateConfig(newConfig);
  }, [baseStore]);

  const getStats = useCallback(() => {
    return {
      ...baseStore.getCacheStats(),
      totalItems: Object.keys(state.authors).length,
    };
  }, [baseStore, state.authors]);

  // Background sync removed - no auto-start

  // Memoized store object
  const store = useMemo((): AuthorStore => ({
    // State
    ...state,
    
    // Data fetching
    fetchAuthor,
    fetchAuthors,
    
    // Profile management
    updateProfile,
    verifyNip05: verifyNip05Manual,
    
    // Cache management
    invalidateAuthor,
    invalidateAll,
    refreshAuthor,
    
    // Prefetching
    prefetchAuthors,
    
    // Background sync
    startBackgroundSync,
    stopBackgroundSync,
    triggerSync,
    
    // User management
    setCurrentUser,
    
    // Configuration
    updateConfig,
    getStats,
  }), [
    state,
    fetchAuthor,
    fetchAuthors,
    updateProfile,
    verifyNip05Manual,
    invalidateAuthor,
    invalidateAll,
    refreshAuthor,
    prefetchAuthors,
    startBackgroundSync,
    stopBackgroundSync,
    triggerSync,
    setCurrentUser,
    updateConfig,
    getStats,
  ]);

  return store;
}