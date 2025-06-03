/**
 * Nostr Query Utilities
 * 
 * This module provides simplified query functions that wrap the UnifiedNostrClient
 * for backward compatibility and ease of use.
 */

import { NostrEvent, NostrFilter } from '@nostrify/nostrify';
import { getNostrClient, NostrQueryOptions } from './nostrClient';

/**
 * Query options for the simplified query functions
 */
export interface QueryOptions {
  timeout?: number;
  maxRetries?: number;
  signal?: AbortSignal;
  relays?: string[];
}

/**
 * Query Nostr events using the unified client
 */
export async function queryNostr(
  nostr: any, // The nostr object from useNostr hook
  filters: NostrFilter[],
  options: QueryOptions = {}
): Promise<NostrEvent[]> {
  // Convert options to UnifiedNostrClient format
  const clientOptions: NostrQueryOptions = {
    timeout: options.timeout,
    retryCount: options.maxRetries,
    signal: options.signal,
    relays: options.relays,
  };

  // Use the global client for consistency
  const client = getNostrClient(options.relays);
  const result = await client.query(filters, clientOptions);
  return result.events;
}

/**
 * Batch query multiple filter groups efficiently
 */
export async function batchQueryNostr(
  nostr: any, // The nostr object from useNostr hook
  filterGroups: NostrFilter[][],
  options: QueryOptions = {}
): Promise<NostrEvent[]> {
  // Convert options to UnifiedNostrClient format
  const clientOptions: NostrQueryOptions = {
    timeout: options.timeout,
    retryCount: options.maxRetries,
    signal: options.signal,
    relays: options.relays,
  };

  // Use the global client for consistency
  const client = getNostrClient(options.relays);
  return await client.batchQuery(filterGroups, clientOptions);
}

/**
 * Legacy compatibility function - use queryNostr instead
 * @deprecated Use queryNostr instead
 */
export async function query(
  filters: NostrFilter[],
  options: QueryOptions = {}
): Promise<NostrEvent[]> {
  return queryNostr(null, filters, options);
}

/**
 * Legacy compatibility function - use batchQueryNostr instead
 * @deprecated Use batchQueryNostr instead
 */
export async function batchQuery(
  filterGroups: NostrFilter[][],
  options: QueryOptions = {}
): Promise<NostrEvent[]> {
  return batchQueryNostr(null, filterGroups, options);
}