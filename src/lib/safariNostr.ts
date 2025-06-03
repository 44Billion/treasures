/**
 * Safari-specific Nostr optimizations
 * 
 * Safari has stricter WebSocket timing requirements that can cause standard Nostr queries to timeout.
 * This module provides Safari-optimized clients and utilities.
 */

import { NostrEvent, NostrFilter } from '@nostrify/nostrify';
import { UnifiedNostrClient, NostrQueryOptions } from './nostrClient';

// Safari detection
export function isSafari(): boolean {
  return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
}

// Safari-optimized configuration
const SAFARI_CONFIG = {
  timeout: 4000,
  retryCount: 1,
  batchSize: 3,
  maxConcurrent: 2,
};

/**
 * Create a Safari-optimized Nostr client
 */
export function createSafariNostr(relays: string[]): SafariNostrClient {
  return new SafariNostrClient(relays);
}

/**
 * Safari-optimized Nostr client with shorter timeouts and retry logic
 */
export class SafariNostrClient {
  private client: UnifiedNostrClient;
  private relays: string[];

  constructor(relays: string[]) {
    this.relays = relays;
    this.client = new UnifiedNostrClient(relays);
  }

  /**
   * Query events with Safari optimizations
   */
  async query(
    filters: NostrFilter[],
    options: { timeout?: number; maxRetries?: number } = {}
  ): Promise<NostrEvent[]> {
    const queryOptions: NostrQueryOptions = {
      timeout: options.timeout || SAFARI_CONFIG.timeout,
      retryCount: options.maxRetries || SAFARI_CONFIG.retryCount,
      relays: this.relays,
      deduplicateBy: 'id',
    };

    try {
      const result = await this.client.query(filters, queryOptions);
      return result.events;
    } catch (error) {
      // Return empty array instead of throwing for Safari compatibility
      console.warn('Safari Nostr query failed:', error);
      return [];
    }
  }

  /**
   * Batch query with Safari optimizations
   */
  async batchQuery(
    filterGroups: NostrFilter[][],
    options: { timeout?: number; maxRetries?: number } = {}
  ): Promise<NostrEvent[]> {
    const queryOptions: NostrQueryOptions = {
      timeout: options.timeout || SAFARI_CONFIG.timeout,
      retryCount: options.maxRetries || SAFARI_CONFIG.retryCount,
      relays: this.relays,
    };

    try {
      return await this.client.batchQuery(filterGroups, queryOptions);
    } catch (error) {
      // Return empty array instead of throwing for Safari compatibility
      console.warn('Safari Nostr batch query failed:', error);
      return [];
    }
  }

  /**
   * Publish event with Safari optimizations
   */
  async publish(event: NostrEvent): Promise<void> {
    try {
      await this.client.publish(event, {
        timeout: SAFARI_CONFIG.timeout,
        retryCount: SAFARI_CONFIG.retryCount,
        requireMinSuccess: 1,
        verifyPublication: false, // Disable verification for Safari
      });
    } catch (error) {
      console.warn('Safari Nostr publish failed:', error);
      throw error;
    }
  }

  /**
   * Close the client
   */
  close(): void {
    this.client.close();
  }
}

/**
 * Get Safari-optimized query options
 */
export function getSafariQueryOptions(customTimeout?: number): NostrQueryOptions {
  return {
    timeout: customTimeout || SAFARI_CONFIG.timeout,
    retryCount: SAFARI_CONFIG.retryCount,
    deduplicateBy: 'id',
  };
}

/**
 * Check if current environment needs Safari optimizations
 */
export function needsSafariOptimizations(): boolean {
  return isSafari();
}

/**
 * Get recommended timeout for Safari
 */
export function getSafariTimeout(): number {
  return SAFARI_CONFIG.timeout;
}

/**
 * Get recommended retry count for Safari
 */
export function getSafariRetryCount(): number {
  return SAFARI_CONFIG.retryCount;
}

/**
 * Legacy compatibility - create a simple Safari client
 * @deprecated Use createSafariNostr instead
 */
export function createSafariClient(relays: string[]) {
  return createSafariNostr(relays);
}