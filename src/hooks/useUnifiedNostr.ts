/**
 * Unified Nostr Hook
 * 
 * This hook provides a consistent interface for all Nostr operations,
 * replacing the need for Safari-specific workarounds and action-specific
 * implementations.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { NostrEvent, NostrFilter } from '@nostrify/nostrify';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { getUserRelays } from '@/lib/relayConfig';
import { 
  getNostrClient, 
  NostrQueryOptions, 
  NostrPublishOptions,
  NostrQueryResult,
  NostrPublishResult 
} from '@/lib/nostrClient';

/**
 * Hook for querying Nostr events with robust error handling and caching
 */
export function useNostrQuery(
  queryKey: unknown[],
  filters: NostrFilter[],
  options: NostrQueryOptions & {
    enabled?: boolean;
    staleTime?: number;
    gcTime?: number;
    refetchOnWindowFocus?: boolean;
    retry?: number;
    retryDelay?: number;
  } = {}
) {
  const {
    enabled = true,
    staleTime = 60000, // 1 minute
    gcTime = 300000, // 5 minutes
    refetchOnWindowFocus = false,
    retry = 1,
    retryDelay = 1000,
    ...nostrOptions
  } = options;

  return useQuery({
    queryKey,
    queryFn: async ({ signal }) => {
      const client = getNostrClient(nostrOptions.relays || getUserRelays());
      const result = await client.query(filters, {
        ...nostrOptions,
        signal,
      });
      return result;
    },
    enabled,
    staleTime,
    gcTime,
    refetchOnWindowFocus,
    retry,
    retryDelay,
  });
}

/**
 * Hook for publishing Nostr events with automatic signing and error handling
 */
export function useNostrPublish() {
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      event: eventTemplate,
      options = {},
      invalidateQueries = [],
    }: {
      event: {
        kind: number;
        content?: string;
        tags?: string[][];
        created_at?: number;
      };
      options?: NostrPublishOptions;
      invalidateQueries?: unknown[][];
    }) => {
      if (!user) {
        throw new Error('User is not logged in');
      }

      if (!user.signer) {
        throw new Error('No signer available. Please check your Nostr extension.');
      }

      // Prepare tags
      const tags = eventTemplate.tags ?? [];

      // Add client tag if not present
      if (!tags.some((tag) => tag[0] === 'client')) {
        tags.push(['client', 'treasures']);
      }

      // Sign the event
      const signedEvent = await user.signer.signEvent({
        kind: eventTemplate.kind,
        content: eventTemplate.content ?? '',
        tags,
        created_at: eventTemplate.created_at ?? Math.floor(Date.now() / 1000),
      });

      // Publish the event
      const client = getNostrClient(options.relays || getUserRelays());
      const result = await client.publish(signedEvent, options);

      // Invalidate specified queries
      for (const queryKey of invalidateQueries) {
        queryClient.invalidateQueries({ queryKey });
      }

      return result;
    },
    onError: (error: unknown) => {
      console.error('Publish error:', error);
    },
    onSuccess: (result: NostrPublishResult) => {
      console.log('Event published successfully:', result.event.id);
    },
  });
}

/**
 * Hook for batch querying multiple filter sets
 */
export function useNostrBatchQuery(
  queryKey: unknown[],
  filterGroups: NostrFilter[][],
  options: NostrQueryOptions & {
    enabled?: boolean;
    staleTime?: number;
    gcTime?: number;
    refetchOnWindowFocus?: boolean;
    retry?: number;
    retryDelay?: number;
  } = {}
) {
  const {
    enabled = true,
    staleTime = 60000,
    gcTime = 300000,
    refetchOnWindowFocus = false,
    retry = 1,
    retryDelay = 1000,
    ...nostrOptions
  } = options;

  return useQuery({
    queryKey,
    queryFn: async ({ signal }) => {
      const client = getNostrClient(nostrOptions.relays || getUserRelays());
      const events = await client.batchQuery(filterGroups, {
        ...nostrOptions,
        signal,
      });
      return events;
    },
    enabled,
    staleTime,
    gcTime,
    refetchOnWindowFocus,
    retry,
    retryDelay,
  });
}

/**
 * Hook for real-time event subscriptions (for future implementation)
 */
export function useNostrSubscription(
  filters: NostrFilter[],
  options: NostrQueryOptions & {
    enabled?: boolean;
    onEvent?: (event: NostrEvent) => void;
    onEose?: () => void;
  } = {}
) {
  // This would implement real-time subscriptions
  // For now, we'll use polling with useNostrQuery
  const { enabled = true, onEvent, onEose, ...queryOptions } = options;
  
  return useNostrQuery(
    ['subscription', JSON.stringify(filters)],
    filters,
    {
      ...queryOptions,
      enabled,
      refetchInterval: 30000, // Poll every 30 seconds
    }
  );
}

/**
 * Utility hook for getting the current Nostr client instance
 */
export function useNostrClient(relays?: string[]) {
  return getNostrClient(relays || getUserRelays());
}

/**
 * Hook for managing relay connections
 */
export function useNostrRelays() {
  const client = useNostrClient();

  return {
    getRelays: () => client.getRelays(),
    setRelays: (relays: string[]) => client.setRelays(relays),
    addRelay: (relay: string) => {
      const current = client.getRelays();
      if (!current.includes(relay)) {
        client.setRelays([...current, relay]);
      }
    },
    removeRelay: (relay: string) => {
      const current = client.getRelays();
      client.setRelays(current.filter(r => r !== relay));
    },
  };
}

/**
 * Type exports for convenience
 */
export type {
  NostrQueryOptions,
  NostrPublishOptions,
  NostrQueryResult,
  NostrPublishResult,
} from '@/lib/nostrClient';