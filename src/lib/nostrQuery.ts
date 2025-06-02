/**
 * Unified Nostr query utilities with Safari optimization
 */

import { NostrEvent, NostrFilter } from '@nostrify/nostrify';
import { isSafari, createSafariNostr } from '@/lib/safariNostr';

export interface NostrQueryOptions {
  timeout?: number;
  maxRetries?: number;
  signal?: AbortSignal;
}

export interface NostrQueryResult {
  events: NostrEvent[];
  source: 'safari' | 'standard';
  duration: number;
}

/**
 * Universal Nostr query that automatically handles Safari optimization
 */
export async function queryNostr(
  nostr: any,
  filters: NostrFilter[],
  options: NostrQueryOptions = {}
): Promise<NostrEvent[]> {
  const startTime = Date.now();
  
  if (isSafari()) {
    return await querySafari(filters, options);
  } else {
    return await queryStandard(nostr, filters, options);
  }
}

/**
 * Safari-optimized query
 */
async function querySafari(
  filters: NostrFilter[],
  options: NostrQueryOptions
): Promise<NostrEvent[]> {
  const { timeout = 5000, maxRetries = 2 } = options;
  const relays = ['wss://ditto.pub/relay', 'wss://relay.damus.io', 'wss://nos.lol'];
  
  const safariClient = createSafariNostr(relays);
  try {
    const events = await safariClient.query(filters, { timeout, maxRetries });
    safariClient.close();
    return events;
  } catch (error) {
    safariClient.close();
    throw error;
  }
}

/**
 * Standard query with timeout
 */
async function queryStandard(
  nostr: any,
  filters: NostrFilter[],
  options: NostrQueryOptions
): Promise<NostrEvent[]> {
  const { timeout = 15000, signal } = options;
  
  const timeoutSignal = AbortSignal.timeout(timeout);
  const combinedSignal = signal 
    ? AbortSignal.any([signal, timeoutSignal])
    : timeoutSignal;
    
  return await nostr.query(filters, { signal: combinedSignal });
}

/**
 * Batch query with automatic chunking for Safari
 */
export async function batchQueryNostr(
  nostr: any,
  filterGroups: NostrFilter[][],
  options: NostrQueryOptions = {}
): Promise<NostrEvent[]> {
  const batchSize = isSafari() ? 3 : 5;
  const allEvents: NostrEvent[] = [];
  
  for (let i = 0; i < filterGroups.length; i += batchSize) {
    const batch = filterGroups.slice(i, i + batchSize);
    const batchPromises = batch.map(filters => queryNostr(nostr, filters, options));
    
    try {
      const batchResults = await Promise.allSettled(batchPromises);
      batchResults.forEach(result => {
        if (result.status === 'fulfilled') {
          allEvents.push(...result.value);
        }
      });
      
      // Small delay between batches for Safari
      if (isSafari() && i + batchSize < filterGroups.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (error) {
      console.warn('Batch query failed:', error);
    }
  }
  
  return allEvents;
}