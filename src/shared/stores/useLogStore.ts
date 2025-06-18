/**
 * Unified Log Store
 * Consolidates all log-related data management
 */

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { 
  useBaseStore, 
  createQueryKey, 
  isDataStale, 
  batchOperations,
  createOptimisticUpdate 
} from './baseStore';
import type { 
  LogStore, 
  LogStoreState, 
  StoreConfig, 
  StoreActionResult 
} from './types';
import type { GeocacheLog } from '@/types/geocache';
import { 
  NIP_GC_KINDS, 
  parseLogEvent,
  buildFoundLogTags,
  buildCommentLogTags,
  validateCommentLogType,
  type ValidCommentLogType
} from '@/features/geocache/utils/nip-gc';
import { useCurrentUser } from '@/features/auth/hooks/useCurrentUser';
import { QUERY_LIMITS, TIMEOUTS } from '@/shared/config';

/**
 * Unified log store hook
 */
export function useLogStore(config: Partial<StoreConfig> = {}): LogStore {
  const baseStore = useBaseStore('log', config);
  const { user } = useCurrentUser();
  
  // Store state
  const [state, setState] = useState<LogStoreState>(() => ({
    ...baseStore.createBaseState(),
    logsByGeocache: {},
    recentLogs: [],
    userLogs: [],
    zapsByLogId: {},
    syncStatus: baseStore.getSyncStatus(),
    cacheStats: baseStore.getCacheStats(),
  }));

  // Update state helper - use useRef to make it stable
  const updateStateRef = useRef((updates: Partial<LogStoreState>) => {
    setState(prev => ({ ...prev, ...updates }));
  });
  const updateState = updateStateRef.current;

  // Data fetching actions
  const fetchLogs = useCallback(async (geocacheId: string): Promise<StoreActionResult<GeocacheLog[]>> => {
    return baseStore.safeAsyncOperation(async () => {
      // Check cache first
      const cached = state.logsByGeocache[geocacheId];
      if (cached && !isDataStale(state.lastUpdate, baseStore.config.cacheTimeout!)) {
        return cached;
      }

      const signal = AbortSignal.timeout(TIMEOUTS.QUERY);
      
      // We need the geocache coordinate to query logs
      // This is a simplified version - in practice, we'd get this from the geocache store
      const geocacheCoordinate = `${NIP_GC_KINDS.GEOCACHE}:${geocacheId}`;
      
      const allEvents = [];
      
      // Fetch found logs
      try {
        const foundLogs = await baseStore.nostr.query([{
          kinds: [NIP_GC_KINDS.FOUND_LOG],
          '#a': [geocacheCoordinate],
          limit: QUERY_LIMITS.LOGS,
        }], { signal });
        allEvents.push(...foundLogs);
      } catch (error) {
        console.warn('Failed to fetch found logs:', error);
      }

      // Fetch comment logs
      try {
        const commentLogs = await baseStore.nostr.query([{
          kinds: [NIP_GC_KINDS.COMMENT_LOG],
          '#a': [geocacheCoordinate],
          '#A': [geocacheCoordinate],
          limit: QUERY_LIMITS.LOGS,
        }], { signal });
        allEvents.push(...commentLogs);
      } catch (error) {
        console.warn('Failed to fetch comment logs:', error);
      }

      const logs = allEvents
        .map(parseLogEvent)
        .filter((log): log is GeocacheLog => log !== null)
        .sort((a, b) => b.created_at - a.created_at);

      // Update cache
      updateState({
        logsByGeocache: {
          ...state.logsByGeocache,
          [geocacheId]: logs,
        },
        lastUpdate: new Date(),
      });

      return logs;
    }, 'fetchLogs');
  }, [baseStore, state.logsByGeocache, state.lastUpdate, updateState]);

  const fetchRecentLogs = useCallback(async (limit: number = 20): Promise<StoreActionResult<GeocacheLog[]>> => {
    return baseStore.safeAsyncOperation(async () => {
      const signal = AbortSignal.timeout(TIMEOUTS.QUERY);
      
      const allEvents = [];
      
      // Fetch recent found logs
      try {
        const foundLogs = await baseStore.nostr.query([{
          kinds: [NIP_GC_KINDS.FOUND_LOG],
          limit: limit / 2,
        }], { signal });
        allEvents.push(...foundLogs);
      } catch (error) {
        console.warn('Failed to fetch recent found logs:', error);
      }

      // Fetch recent comment logs
      try {
        const commentLogs = await baseStore.nostr.query([{
          kinds: [NIP_GC_KINDS.COMMENT_LOG],
          limit: limit / 2,
        }], { signal });
        allEvents.push(...commentLogs);
      } catch (error) {
        console.warn('Failed to fetch recent comment logs:', error);
      }

      const recentLogs = allEvents
        .map(parseLogEvent)
        .filter((log): log is GeocacheLog => log !== null)
        .sort((a, b) => b.created_at - a.created_at)
        .slice(0, limit);

      updateState({ recentLogs });
      return recentLogs;
    }, 'fetchRecentLogs');
  }, [baseStore]);

  const fetchUserLogs = useCallback(async (pubkey: string): Promise<StoreActionResult<GeocacheLog[]>> => {
    return baseStore.safeAsyncOperation(async () => {
      const signal = AbortSignal.timeout(TIMEOUTS.QUERY);
      
      const allEvents = [];
      
      // Fetch user's found logs
      try {
        const foundLogs = await baseStore.nostr.query([{
          kinds: [NIP_GC_KINDS.FOUND_LOG],
          authors: [pubkey],
          limit: QUERY_LIMITS.LOGS,
        }], { signal });
        allEvents.push(...foundLogs);
      } catch (error) {
        console.warn('Failed to fetch user found logs:', error);
      }

      // Fetch user's comment logs
      try {
        const commentLogs = await baseStore.nostr.query([{
          kinds: [NIP_GC_KINDS.COMMENT_LOG],
          authors: [pubkey],
          limit: QUERY_LIMITS.LOGS,
        }], { signal });
        allEvents.push(...commentLogs);
      } catch (error) {
        console.warn('Failed to fetch user comment logs:', error);
      }

      const userLogs = allEvents
        .map(parseLogEvent)
        .filter((log): log is GeocacheLog => log !== null)
        .sort((a, b) => b.created_at - a.created_at);

      if (pubkey === user?.pubkey) {
        updateState({ userLogs });
      }

      return userLogs;
    }, 'fetchUserLogs');
  }, [baseStore, user?.pubkey]);

  const fetchZapsForLog = useCallback(async (logId: string): Promise<StoreActionResult<NostrEvent[]>> => {
    return baseStore.safeAsyncOperation(async () => {
      const signal = AbortSignal.timeout(TIMEOUTS.QUERY);
      const events = await baseStore.nostr.query(
        [
          {
            kinds: [9735],
            '#e': [logId],
          },
        ],
        { signal }
      );
      updateState({
        zapsByLogId: {
          ...state.zapsByLogId,
          [logId]: events,
        },
      });
      return events;
    }, 'fetchZapsForLog');
  }, [baseStore, state.zapsByLogId]);


  // CRUD operations - Real implementations
  const createLogMutation = useMutation({
    mutationFn: async (logData: Partial<GeocacheLog>) => {
      if (!user?.signer) {
        throw new Error('You must be logged in to create logs');
      }

      // Validate data
      if (!logData.geocacheId) {
        throw new Error('Geocache ID is required');
      }
      if (!logData.text?.trim()) {
        throw new Error('Log text is required');
      }
      if (!logData.geocachePubkey || !logData.geocacheId) {
        throw new Error('Geocache pubkey and dTag are required');
      }
      
      // Determine event kind and build tags based on log type
      let eventKind: number;
      let tags: string[][];
      
      if (logData.type === 'found') {
        // Found logs use kind 7516
        eventKind = NIP_GC_KINDS.FOUND_LOG;
        tags = buildFoundLogTags({
          geocachePubkey: logData.geocachePubkey,
          geocacheDTag: logData.geocacheId,
          images: logData.images,
          verificationEvent: logData.verificationEvent,
        });
      } else {
        // All other log types use kind 1111 (comment logs)
        if (logData.type !== 'note' && !validateCommentLogType(logData.type || '')) {
          throw new Error(`Invalid comment log type: ${logData.type}`);
        }
        
        eventKind = NIP_GC_KINDS.COMMENT_LOG;
        tags = buildCommentLogTags({
          geocachePubkey: logData.geocachePubkey,
          geocacheDTag: logData.geocacheId,
          logType: logData.type as ValidCommentLogType | 'note',
          images: logData.images,
        });
      }

      const event = {
        kind: eventKind,
        content: logData.text.trim(),
        tags,
        created_at: Math.floor(Date.now() / 1000),
      };

      const signedEvent = await user.signer.signEvent(event);
      
      // Publish to relay
      const signal = AbortSignal.timeout(TIMEOUTS.QUERY);
      await baseStore.nostr.event(signedEvent, { signal });

      return signedEvent;
    },
    onSuccess: (event, logData) => {
      // Parse the new log from the event
      const newLog = parseLogEvent(event);
      if (newLog && logData.geocacheId) {
        updateState({
          logsByGeocache: {
            ...state.logsByGeocache,
            [logData.geocacheId]: [newLog, ...(state.logsByGeocache[logData.geocacheId] || [])],
          },
          recentLogs: [newLog, ...state.recentLogs].slice(0, 20),
          userLogs: newLog.pubkey === user?.pubkey 
            ? [newLog, ...state.userLogs] 
            : state.userLogs,
        });
      }
    },
  });

  const deleteLogMutation = useMutation({
    mutationFn: async (logId: string) => {
      if (!user?.signer) {
        throw new Error('You must be logged in to delete logs');
      }

      // Find the log to delete
      let logToDelete: GeocacheLog | undefined;
      let geocacheId: string | undefined;
      
      // Search through all logs to find the one to delete
      for (const [gId, logs] of Object.entries(state.logsByGeocache)) {
        const log = logs.find(l => l.id === logId);
        if (log) {
          logToDelete = log;
          geocacheId = gId;
          break;
        }
      }

      if (!logToDelete) {
        throw new Error('Log not found');
      }

      // Create deletion event
      const deletionEvent = {
        kind: 5,
        content: 'Log deleted by author',
        tags: [
          ['e', logId],
          ['k', logToDelete.kind?.toString() || NIP_GC_KINDS.COMMENT_LOG],
          ['client', 'treasures'],
        ],
        created_at: Math.floor(Date.now() / 1000),
      };

      const signedEvent = await user.signer.signEvent(deletionEvent);

      // Fire-and-forget deletion
      try {
        await baseStore.nostr.event(signedEvent, { 
          signal: AbortSignal.timeout(TIMEOUTS.DELETE_OPERATION) 
        });
      } catch (publishError) {
        console.warn('Deletion event publish warning (continuing optimistically):', publishError);
      }

      return signedEvent;
    },
    onMutate: (logId) => {
      // Store previous state for rollback
      const previousLogsByGeocache = { ...state.logsByGeocache };
      const previousRecentLogs = [...state.recentLogs];
      const previousUserLogs = [...state.userLogs];
      
      // Optimistic update - remove from all caches
      const newLogsByGeocache = { ...state.logsByGeocache };
      Object.keys(newLogsByGeocache).forEach(geocacheId => {
        newLogsByGeocache[geocacheId] = newLogsByGeocache[geocacheId].filter(log => log.id !== logId);
      });
      
      const rollback = createOptimisticUpdate(
        createQueryKey('log', 'all'),
        () => ({
          logsByGeocache: newLogsByGeocache,
          recentLogs: state.recentLogs.filter(log => log.id !== logId),
          userLogs: state.userLogs.filter(log => log.id !== logId),
        }),
        baseStore.queryClient
      );
      
      updateState({
        logsByGeocache: newLogsByGeocache,
        recentLogs: state.recentLogs.filter(log => log.id !== logId),
        userLogs: state.userLogs.filter(log => log.id !== logId),
      });
      
      return { 
        rollback, 
        previousLogsByGeocache, 
        previousRecentLogs, 
        previousUserLogs 
      };
    },
    onError: (error, logId, context) => {
      const errorObj = error as { message?: string };
      const isSigningError = errorObj.message?.includes('User rejected') || 
                            errorObj.message?.includes('cancelled') ||
                            errorObj.message?.includes('No signer');
      
      if (isSigningError && context) {
        // Only rollback for user cancellation or signer issues
        context.rollback();
        updateState({
          logsByGeocache: context.previousLogsByGeocache,
          recentLogs: context.previousRecentLogs,
          userLogs: context.previousUserLogs,
        });
      }
      // For network/relay errors, keep the optimistic update
    },
  });

  // Action implementations
  const createLog = useCallback(async (log: Partial<GeocacheLog>): Promise<StoreActionResult<GeocacheLog>> => {
    try {
      const event = await createLogMutation.mutateAsync(log);
      const newLog = parseLogEvent(event);
      if (!newLog) {
        throw new Error('Failed to parse created log');
      }
      return baseStore.createSuccessResult(newLog);
    } catch (error) {
      return baseStore.createErrorResult(baseStore.handleError(error, 'createLog'));
    }
  }, [createLogMutation, baseStore]);

  const createVerifiedLog = useCallback(async (log: Partial<GeocacheLog>): Promise<StoreActionResult<GeocacheLog>> => {
    // Add verification logic before creating
    const verifiedLogData = { 
      ...log, 
      verified: true,
      type: log.type || 'found' // Default to found log for verification
    };
    return createLog(verifiedLogData);
  }, [createLog]);

  const deleteLog = useCallback(async (logId: string): Promise<StoreActionResult<void>> => {
    try {
      await deleteLogMutation.mutateAsync(logId);
      return baseStore.createSuccessResult(undefined);
    } catch (error) {
      return baseStore.createErrorResult(baseStore.handleError(error, 'deleteLog'));
    }
  }, [deleteLogMutation, baseStore]);

  // Cache management
  const invalidateLogs = useCallback((geocacheId: string) => {
    baseStore.invalidateQueries(createQueryKey('log', 'geocache', geocacheId));
    // Also remove from local state
    updateState({
      logsByGeocache: {
        ...state.logsByGeocache,
        [geocacheId]: [],
      },
    });
  }, [baseStore, state.logsByGeocache]);

  const invalidateAll = useCallback(() => {
    baseStore.invalidateQueries(createQueryKey('log', 'list'));
    updateState({
      logsByGeocache: {},
      recentLogs: [],
      userLogs: [],
    });
  }, [baseStore]);

  const refreshLogs = useCallback(async (geocacheId: string): Promise<StoreActionResult<GeocacheLog[]>> => {
    invalidateLogs(geocacheId);
    return fetchLogs(geocacheId);
  }, [invalidateLogs, fetchLogs]);

  // Prefetching
  const prefetchLogs = useCallback(async (geocacheIds: string[]): Promise<void> => {
    await batchOperations(
      geocacheIds,
      async (geocacheId) => {
        await baseStore.prefetchQuery(
          createQueryKey('log', 'geocache', geocacheId),
          () => fetchLogs(geocacheId).then(result => result.data!)
        );
      },
      3 // Batch size
    );
  }, [baseStore, fetchLogs]);

  // Background sync
  const backgroundSyncFn = useCallback(async (geocacheIds?: string[]) => {
    if (geocacheIds) {
      // Sync specific geocaches
      await batchOperations(geocacheIds, fetchLogs, 3);
    } else {
      // Sync recent logs
      await fetchRecentLogs();
    }
  }, [fetchLogs, fetchRecentLogs]);

  const startBackgroundSync = useCallback(() => {
    baseStore.startBackgroundSync(() => backgroundSyncFn());
    updateState({ syncStatus: baseStore.getSyncStatus() });
  }, [baseStore, backgroundSyncFn]);

  const stopBackgroundSync = useCallback(() => {
    baseStore.stopBackgroundSync();
    updateState({ syncStatus: baseStore.getSyncStatus() });
  }, [baseStore]);

  const triggerSync = useCallback(async (geocacheIds?: string[]): Promise<StoreActionResult<void>> => {
    try {
      await backgroundSyncFn(geocacheIds);
      return baseStore.createSuccessResult(undefined);
    } catch (error) {
      return baseStore.createErrorResult(baseStore.handleError(error, 'triggerSync'));
    }
  }, [backgroundSyncFn, baseStore]);

  // Configuration
  const updateConfig = useCallback((newConfig: Partial<StoreConfig>) => {
    baseStore.updateConfig(newConfig);
  }, [baseStore]);

  const getStats = useCallback(() => {
    const totalLogs = Object.values(state.logsByGeocache).reduce((sum, logs) => sum + logs.length, 0);
    return {
      ...baseStore.getCacheStats(),
      totalItems: totalLogs,
    };
  }, [baseStore, state.logsByGeocache]);

  // Auto-start background sync
  useEffect(() => {
    if (baseStore.config.enableBackgroundSync) {
      startBackgroundSync();
    }
    return () => stopBackgroundSync();
  }, [baseStore.config.enableBackgroundSync]);

  // Memoized store object
  const store = useMemo((): LogStore => ({
    // State
    ...state,
    
    // Data fetching
    fetchLogs,
    fetchRecentLogs,
    fetchUserLogs,
    fetchZapsForLog,
    
    // CRUD operations
    createLog,
    createVerifiedLog,
    deleteLog,
    
    // Cache management
    invalidateLogs,
    invalidateAll,
    refreshLogs,
    
    // Prefetching
    prefetchLogs,
    
    // Background sync
    startBackgroundSync,
    stopBackgroundSync,
    triggerSync,
    
    // Configuration
    updateConfig,
    getStats,
  }), [
    state,
    fetchLogs,
    fetchRecentLogs,
    fetchUserLogs,
    fetchZapsForLog,
    createLog,
    createVerifiedLog,
    deleteLog,
    invalidateLogs,
    invalidateAll,
    refreshLogs,
    prefetchLogs,
    startBackgroundSync,
    stopBackgroundSync,
    triggerSync,
    updateConfig,
    getStats,
  ]);

  return store;
}