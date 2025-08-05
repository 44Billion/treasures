/**
 * Unified Log Store
 * Consolidates all log-related data management
 */

import { useState, useCallback, useMemo } from 'react';
import { useMutation } from '@tanstack/react-query';
import { 
  useBaseStore, 
  createQueryKey, 
  batchOperations
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
import { separateQueries } from '@/shared/utils/batchQuery';

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

  // Update state helper - use useCallback to make it stable
  const updateState = useCallback((updates: Partial<LogStoreState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  // Data fetching actions
  const fetchLogs = useCallback(async (geocacheId: string, geocacheKind?: number): Promise<StoreActionResult<GeocacheLog[]>> => {
    return baseStore.safeAsyncOperation(async () => {
      const kind = geocacheKind || NIP_GC_KINDS.GEOCACHE;
      const geocacheCoordinate = `${kind}:${geocacheId}`;
      
      // Use separate queries to avoid "arr too big" errors
      const allEvents = await separateQueries(baseStore.nostr, [
        {
          filters: {
            kinds: [NIP_GC_KINDS.FOUND_LOG],
            '#a': [geocacheCoordinate],
            limit: QUERY_LIMITS.LOGS,
          },
          name: 'fetchLogs-found'
        },
        {
          filters: {
            kinds: [NIP_GC_KINDS.COMMENT_LOG],
            '#a': [geocacheCoordinate],
            limit: QUERY_LIMITS.LOGS,
          },
          name: 'fetchLogs-comment-a'
        },
        {
          filters: {
            kinds: [NIP_GC_KINDS.COMMENT_LOG],
            '#A': [geocacheCoordinate],
            limit: QUERY_LIMITS.LOGS,
          },
          name: 'fetchLogs-comment-A'
        }
      ], AbortSignal.timeout(TIMEOUTS.QUERY));

      const logs = (allEvents || [])
        .map(parseLogEvent)
        .filter((log: GeocacheLog | null): log is GeocacheLog => log !== null)
        .sort((a: GeocacheLog, b: GeocacheLog) => b.created_at - a.created_at);

      return logs;
    }, 'fetchLogs');
  }, [baseStore]);

  const fetchLogsForGeocache = useCallback(async (
    geocachePubkey: string,
    geocacheDTag: string,
    geocacheKind?: number
  ): Promise<StoreActionResult<GeocacheLog[]>> => {
    return baseStore.safeAsyncOperation(async () => {
      const kind = geocacheKind || NIP_GC_KINDS.GEOCACHE;
      const geocacheCoordinate = `${kind}:${geocachePubkey}:${geocacheDTag}`;
      
      // Use separate queries to avoid "arr too big" errors
      const allEvents = await separateQueries(baseStore.nostr, [
        {
          filters: {
            kinds: [NIP_GC_KINDS.FOUND_LOG],
            '#a': [geocacheCoordinate],
            limit: QUERY_LIMITS.LOGS,
          },
          name: 'fetchLogsForGeocache-found'
        },
        {
          filters: {
            kinds: [NIP_GC_KINDS.COMMENT_LOG],
            '#a': [geocacheCoordinate],
            limit: QUERY_LIMITS.LOGS,
          },
          name: 'fetchLogsForGeocache-comment-a'
        },
        {
          filters: {
            kinds: [NIP_GC_KINDS.COMMENT_LOG],
            '#A': [geocacheCoordinate],
            limit: QUERY_LIMITS.LOGS,
          },
          name: 'fetchLogsForGeocache-comment-A'
        }
      ], AbortSignal.timeout(TIMEOUTS.QUERY));

      const logs = (allEvents || [])
        .map(parseLogEvent)
        .filter((log: GeocacheLog | null): log is GeocacheLog => log !== null)
        .sort((a: GeocacheLog, b: GeocacheLog) => b.created_at - a.created_at);

      return logs;
    }, 'fetchLogsForGeocache');
  }, [baseStore]);

  const fetchRecentLogs = useCallback(async (limit: number = 20): Promise<StoreActionResult<GeocacheLog[]>> => {
    return baseStore.safeAsyncOperation(async () => {
      const allEvents = [];
      
      // Fetch recent found logs
      try {
        const { data: foundLogs } = await baseStore.batchQuery([{
          kinds: [NIP_GC_KINDS.FOUND_LOG],
          limit: limit / 2,
        }], 'fetchRecentFoundLogs');
        allEvents.push(...(foundLogs || []));
      } catch (error) {
        console.warn('Failed to fetch recent found logs:', error);
      }

      // Fetch recent comment logs
      try {
        const { data: commentLogs } = await baseStore.batchQuery([{
          kinds: [NIP_GC_KINDS.COMMENT_LOG],
          limit: limit / 2,
        }], 'fetchRecentCommentLogs');
        allEvents.push(...(commentLogs || []));
      } catch (error) {
        console.warn('Failed to fetch recent comment logs:', error);
      }

      const recentLogs = allEvents
        .map(parseLogEvent)
        .filter((log: GeocacheLog | null): log is GeocacheLog => log !== null)
        .sort((a, b) => b.created_at - a.created_at)
        .slice(0, limit);

      updateState({ recentLogs });
      return recentLogs;
    }, 'fetchRecentLogs');
  }, [baseStore, updateState]);

  const fetchUserLogs = useCallback(async (pubkey: string): Promise<StoreActionResult<GeocacheLog[]>> => {
    return baseStore.safeAsyncOperation(async () => {
      const allEvents = [];
      
      // Fetch user's found logs
      try {
        const { data: foundLogs } = await baseStore.batchQuery([{
          kinds: [NIP_GC_KINDS.FOUND_LOG],
          authors: [pubkey],
          limit: QUERY_LIMITS.LOGS,
        }], 'fetchUserFoundLogs');
        allEvents.push(...(foundLogs || []));
      } catch (error) {
        console.warn('Failed to fetch user found logs:', error);
      }

      // Fetch user's comment logs
      try {
        const { data: commentLogs } = await baseStore.batchQuery([{
          kinds: [NIP_GC_KINDS.COMMENT_LOG],
          authors: [pubkey],
          limit: QUERY_LIMITS.LOGS,
        }], 'fetchUserCommentLogs');
        allEvents.push(...(commentLogs || []));
      } catch (error) {
        console.warn('Failed to fetch user comment logs:', error);
      }

      const userLogs = allEvents
        .map(parseLogEvent)
        .filter((log): log is GeocacheLog => log !== null)
        .sort((a: GeocacheLog, b: GeocacheLog) => b.created_at - a.created_at);

      if (pubkey === user?.pubkey) {
        updateState({ userLogs });
      }

      return userLogs;
    }, 'fetchUserLogs');
  }, [baseStore, user?.pubkey, updateState]);

  const fetchZapsForLog = useCallback(async (logId: string): Promise<StoreActionResult<any[]>> => {
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
  }, [baseStore, state.zapsByLogId, updateState]);


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
          geocacheKind: (logData as any).geocacheKind,
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
          geocacheKind: (logData as any).geocacheKind,
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
        setState(prev => ({
          ...prev,
          logsByGeocache: {
            ...prev.logsByGeocache,
            [logData.geocacheId!]: [newLog, ...(prev.logsByGeocache[logData.geocacheId!] || [])],
          },
          recentLogs: [newLog, ...prev.recentLogs].slice(0, 20),
          userLogs: newLog.pubkey === user?.pubkey 
            ? [newLog, ...prev.userLogs] 
            : prev.userLogs,
        }));
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

      // Search through all logs to find the one to delete
      for (const [, logs] of Object.entries(state.logsByGeocache)) {
        const log = logs.find(l => l.id === logId);
        if (log) {
          logToDelete = log;
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
          ['k', (logToDelete as any).kind?.toString() || NIP_GC_KINDS.COMMENT_LOG],
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
    onMutate: () => {
      // Optimistic update handled by React Query
      return {};
    },
    onError: () => {
      // Error handled by React Query
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
      return baseStore.createErrorResult(baseStore.handleError(error, 'createLog')) as StoreActionResult<GeocacheLog>;
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
      return baseStore.createErrorResult(baseStore.handleError(error, 'deleteLog')) as StoreActionResult<void>;
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
  }, [baseStore, state.logsByGeocache, updateState]);

  const invalidateAll = useCallback(() => {
    baseStore.invalidateQueries(createQueryKey('log', 'list'));
    updateState({
      logsByGeocache: {},
      recentLogs: [],
      userLogs: [],
    });
  }, [baseStore, updateState]);

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

  // Background sync - removed for simplicity
  const startBackgroundSync = useCallback(() => {
    // No-op - background sync removed
  }, []);

  const stopBackgroundSync = useCallback(() => {
    // No-op - background sync removed
  }, []);

  const triggerSync = useCallback(async (geocacheIds?: string[]): Promise<StoreActionResult<void>> => {
    try {
      if (!geocacheIds) {
        await fetchRecentLogs();
      }
      return baseStore.createSuccessResult(undefined);
    } catch (error) {
      return baseStore.createErrorResult(baseStore.handleError(error, 'triggerSync')) as StoreActionResult<void>;
    }
  }, [fetchRecentLogs, baseStore]);

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

  // Background sync removed - no auto-start

  // Memoized store object
  const store = useMemo((): LogStore => ({
    // State
    ...state,
    
    // Data fetching
    fetchLogs,
    fetchRecentLogs,
    fetchUserLogs,
    fetchZapsForLog,
    fetchLogsForGeocache,
    
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
    fetchLogsForGeocache,
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