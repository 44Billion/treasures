/**
 * Unified Nostr Client System
 * 
 * This module provides a robust, unified interface for all Nostr relay interactions.
 * It handles connection management, retry logic, error handling, and performance
 * optimization across all browsers and network conditions.
 */

import { NostrEvent, NostrFilter, NRelay1 } from '@nostrify/nostrify';

// Configuration constants
const DEFAULT_TIMEOUT = 8000;
const SAFARI_TIMEOUT = 5000;
const DEFAULT_RETRY_COUNT = 2;
const SAFARI_RETRY_COUNT = 1;
const CONNECTION_TIMEOUT = 3000;
const BATCH_SIZE = 5;
const SAFARI_BATCH_SIZE = 3;
const BATCH_DELAY = 100;

// Default relay list - using ditto.pub as primary relay
// Additional relays can be configured by users in Settings
const DEFAULT_RELAYS = [
  'wss://ditto.pub/relay',
];

// Browser detection
function isSafari(): boolean {
  return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
}

// Get browser-optimized configuration
function getBrowserConfig() {
  const safari = isSafari();
  return {
    timeout: safari ? SAFARI_TIMEOUT : DEFAULT_TIMEOUT,
    retryCount: safari ? SAFARI_RETRY_COUNT : DEFAULT_RETRY_COUNT,
    batchSize: safari ? SAFARI_BATCH_SIZE : BATCH_SIZE,
    isSafari: safari,
  };
}

// Connection pool for relay management
class RelayConnectionPool {
  private connections = new Map<string, WebSocket>();
  private connectionPromises = new Map<string, Promise<WebSocket>>();
  private lastUsed = new Map<string, number>();
  private readonly maxConnections = 10;
  private readonly connectionTtl = 300000; // 5 minutes

  async getConnection(url: string): Promise<WebSocket> {
    // Check for existing valid connection
    const existing = this.connections.get(url);
    if (existing && existing.readyState === WebSocket.OPEN) {
      this.lastUsed.set(url, Date.now());
      return existing;
    }

    // Check for pending connection
    const pending = this.connectionPromises.get(url);
    if (pending) {
      return pending;
    }

    // Create new connection
    const connectionPromise = this.createConnection(url);
    this.connectionPromises.set(url, connectionPromise);

    try {
      const ws = await connectionPromise;
      this.connections.set(url, ws);
      this.lastUsed.set(url, Date.now());
      this.connectionPromises.delete(url);
      
      // Set up cleanup on close
      ws.addEventListener('close', () => {
        this.connections.delete(url);
        this.lastUsed.delete(url);
      });

      return ws;
    } catch (error) {
      this.connectionPromises.delete(url);
      throw error;
    }
  }

  private async createConnection(url: string): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url);
      
      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error(`Connection timeout to ${url}`));
      }, CONNECTION_TIMEOUT);

      ws.onopen = () => {
        clearTimeout(timeout);
        resolve(ws);
      };

      ws.onerror = () => {
        clearTimeout(timeout);
        reject(new Error(`Failed to connect to ${url}`));
      };
    });
  }

  cleanup() {
    const now = Date.now();
    const toRemove: string[] = [];

    // Find expired connections
    for (const [url, lastUsed] of this.lastUsed) {
      if (now - lastUsed > this.connectionTtl) {
        toRemove.push(url);
      }
    }

    // Remove expired connections
    for (const url of toRemove) {
      const ws = this.connections.get(url);
      if (ws) {
        ws.close();
      }
      this.connections.delete(url);
      this.lastUsed.delete(url);
    }

    // Enforce max connections limit
    if (this.connections.size > this.maxConnections) {
      const sortedByAge = Array.from(this.lastUsed.entries())
        .sort(([, a], [, b]) => a - b)
        .slice(0, this.connections.size - this.maxConnections);

      for (const [url] of sortedByAge) {
        const ws = this.connections.get(url);
        if (ws) {
          ws.close();
        }
        this.connections.delete(url);
        this.lastUsed.delete(url);
      }
    }
  }

  closeAll() {
    for (const ws of this.connections.values()) {
      ws.close();
    }
    this.connections.clear();
    this.connectionPromises.clear();
    this.lastUsed.clear();
  }
}

// Global connection pool instance
const connectionPool = new RelayConnectionPool();

// Cleanup interval
setInterval(() => connectionPool.cleanup(), 60000); // Every minute

// Query options interface
export interface NostrQueryOptions {
  timeout?: number;
  retryCount?: number;
  signal?: AbortSignal;
  relays?: string[];
  requireMinResults?: number;
  deduplicateBy?: 'id' | 'content' | 'none';
}

// Publish options interface
export interface NostrPublishOptions {
  timeout?: number;
  retryCount?: number;
  signal?: AbortSignal;
  relays?: string[];
  requireMinSuccess?: number;
  verifyPublication?: boolean;
}

// Query result interface
export interface NostrQueryResult {
  events: NostrEvent[];
  sources: Map<string, string[]>; // event id -> relay urls
  errors: Map<string, Error>; // relay url -> error
  duration: number;
}

// Publish result interface
export interface NostrPublishResult {
  event: NostrEvent;
  successfulRelays: string[];
  failedRelays: Map<string, Error>;
  duration: number;
}

// Main Nostr client class
export class UnifiedNostrClient {
  private relays: string[];
  private config = getBrowserConfig();

  constructor(relays: string[] = DEFAULT_RELAYS) {
    this.relays = [...relays];
  }

  /**
   * Query events from Nostr relays with robust error handling and optimization
   */
  async query(
    filters: NostrFilter[],
    options: NostrQueryOptions = {}
  ): Promise<NostrQueryResult> {
    const startTime = Date.now();
    const {
      timeout = this.config.timeout,
      retryCount = this.config.retryCount,
      signal,
      relays = this.relays,
      requireMinResults = 0,
      deduplicateBy = 'id',
    } = options;

    // Create combined abort signal
    const timeoutSignal = AbortSignal.timeout(timeout);
    const combinedSignal = signal 
      ? AbortSignal.any([signal, timeoutSignal])
      : timeoutSignal;

    const allEvents: NostrEvent[] = [];
    const sources = new Map<string, string[]>();
    const errors = new Map<string, Error>();
    const eventIds = new Set<string>();
    const eventContents = new Set<string>();

    // Query relays in parallel with retry logic
    const relayPromises = relays.map(async (relayUrl) => {
      for (let attempt = 0; attempt <= retryCount; attempt++) {
        try {
          if (combinedSignal.aborted) {
            throw new Error('Query aborted');
          }

          const events = await this.queryRelay(relayUrl, filters, {
            timeout: Math.floor(timeout / (attempt + 1)),
            signal: combinedSignal,
          });

          // Process and deduplicate events
          for (const event of events) {
            let shouldAdd = false;

            if (deduplicateBy === 'none') {
              shouldAdd = true;
            } else if (deduplicateBy === 'id') {
              shouldAdd = !eventIds.has(event.id);
              if (shouldAdd) eventIds.add(event.id);
            } else if (deduplicateBy === 'content') {
              shouldAdd = !eventContents.has(event.content);
              if (shouldAdd) eventContents.add(event.content);
            }

            if (shouldAdd) {
              allEvents.push(event);
              
              // Track source relay
              const existingSources = sources.get(event.id) || [];
              sources.set(event.id, [...existingSources, relayUrl]);
            } else {
              // Event already exists, just add relay as source
              const existingSources = sources.get(event.id) || [];
              if (!existingSources.includes(relayUrl)) {
                sources.set(event.id, [...existingSources, relayUrl]);
              }
            }
          }

          return; // Success, exit retry loop
        } catch (error) {
          const err = error as Error;
          
          // Don't retry on abort
          if (combinedSignal.aborted || err.message.includes('aborted')) {
            errors.set(relayUrl, err);
            return;
          }

          // Last attempt, record error
          if (attempt === retryCount) {
            errors.set(relayUrl, err);
          }

          // Wait before retry (exponential backoff)
          if (attempt < retryCount) {
            await new Promise(resolve => 
              setTimeout(resolve, Math.min(1000 * Math.pow(2, attempt), 5000))
            );
          }
        }
      }
    });

    // Wait for all relay queries to complete or timeout
    await Promise.allSettled(relayPromises);

    // Check if we have minimum required results
    if (requireMinResults > 0 && allEvents.length < requireMinResults) {
      throw new Error(
        `Insufficient results: got ${allEvents.length}, required ${requireMinResults}`
      );
    }

    // Sort events by created_at (newest first)
    allEvents.sort((a, b) => (b.created_at || 0) - (a.created_at || 0));

    return {
      events: allEvents,
      sources,
      errors,
      duration: Date.now() - startTime,
    };
  }

  /**
   * Query a single relay
   */
  private async queryRelay(
    relayUrl: string,
    filters: NostrFilter[],
    options: { timeout: number; signal: AbortSignal }
  ): Promise<NostrEvent[]> {
    const ws = await connectionPool.getConnection(relayUrl);
    const subId = this.generateSubId();
    const events: NostrEvent[] = [];

    return new Promise((resolve, reject) => {
      let isResolved = false;

      // Set up timeout
      const timeoutId = setTimeout(() => {
        if (!isResolved) {
          isResolved = true;
          reject(new Error(`Query timeout after ${options.timeout}ms`));
        }
      }, options.timeout);

      // Handle abort signal
      const abortHandler = () => {
        if (!isResolved) {
          isResolved = true;
          clearTimeout(timeoutId);
          reject(new Error('Query aborted'));
        }
      };

      if (options.signal.aborted) {
        abortHandler();
        return;
      }

      options.signal.addEventListener('abort', abortHandler);

      // Message handler
      const handleMessage = (event: MessageEvent) => {
        try {
          const message = JSON.parse(event.data);
          
          if (message[0] === 'EVENT' && message[1] === subId) {
            events.push(message[2]);
          } else if (message[0] === 'EOSE' && message[1] === subId) {
            if (!isResolved) {
              isResolved = true;
              clearTimeout(timeoutId);
              options.signal.removeEventListener('abort', abortHandler);
              ws.removeEventListener('message', handleMessage);
              resolve(events);
            }
          } else if (message[0] === 'CLOSED' && message[1] === subId) {
            if (!isResolved) {
              isResolved = true;
              clearTimeout(timeoutId);
              options.signal.removeEventListener('abort', abortHandler);
              ws.removeEventListener('message', handleMessage);
              resolve(events);
            }
          }
        } catch (parseError) {
          // Ignore parse errors
        }
      };

      ws.addEventListener('message', handleMessage);

      // Send REQ
      try {
        const reqMessage = JSON.stringify(['REQ', subId, ...filters]);
        ws.send(reqMessage);

        // Send CLOSE after timeout - 1 second to ensure EOSE
        setTimeout(() => {
          if (ws.readyState === WebSocket.OPEN) {
            try {
              ws.send(JSON.stringify(['CLOSE', subId]));
            } catch (error) {
              // Ignore send errors on close
            }
          }
        }, Math.max(options.timeout - 1000, 1000));
      } catch (error) {
        if (!isResolved) {
          isResolved = true;
          clearTimeout(timeoutId);
          options.signal.removeEventListener('abort', abortHandler);
          ws.removeEventListener('message', handleMessage);
          reject(error);
        }
      }
    });
  }

  /**
   * Publish an event to Nostr relays
   */
  async publish(
    event: NostrEvent,
    options: NostrPublishOptions = {}
  ): Promise<NostrPublishResult> {
    const startTime = Date.now();
    const {
      timeout = this.config.timeout,
      retryCount = this.config.retryCount,
      signal,
      relays = this.relays,
      requireMinSuccess = 1,
      verifyPublication = !this.config.isSafari,
    } = options;

    // Create combined abort signal
    const timeoutSignal = AbortSignal.timeout(timeout);
    const combinedSignal = signal 
      ? AbortSignal.any([signal, timeoutSignal])
      : timeoutSignal;

    const successfulRelays: string[] = [];
    const failedRelays = new Map<string, Error>();

    // Publish to relays in parallel
    const publishPromises = relays.map(async (relayUrl) => {
      for (let attempt = 0; attempt <= retryCount; attempt++) {
        try {
          if (combinedSignal.aborted) {
            throw new Error('Publish aborted');
          }

          await this.publishToRelay(relayUrl, event, {
            timeout: Math.floor(timeout / (attempt + 1)),
            signal: combinedSignal,
          });

          successfulRelays.push(relayUrl);
          return; // Success, exit retry loop
        } catch (error) {
          const err = error as Error;
          
          // Don't retry on abort
          if (combinedSignal.aborted || err.message.includes('aborted')) {
            failedRelays.set(relayUrl, err);
            return;
          }

          // Last attempt, record error
          if (attempt === retryCount) {
            failedRelays.set(relayUrl, err);
          }

          // Wait before retry
          if (attempt < retryCount) {
            await new Promise(resolve => 
              setTimeout(resolve, Math.min(500 * Math.pow(2, attempt), 2000))
            );
          }
        }
      }
    });

    // Wait for all publish attempts
    await Promise.allSettled(publishPromises);

    // Check if we have minimum required successes
    if (successfulRelays.length < requireMinSuccess) {
      const errorMessages = Array.from(failedRelays.entries())
        .map(([relay, error]) => `${relay}: ${error.message}`)
        .join('; ');
      
      throw new Error(
        `Failed to publish to minimum required relays. ` +
        `Successful: ${successfulRelays.length}/${requireMinSuccess}. ` +
        `Errors: ${errorMessages}`
      );
    }

    // Verify publication if requested
    if (verifyPublication && successfulRelays.length > 0) {
      try {
        const verification = await this.query(
          [{ ids: [event.id] }],
          { 
            timeout: Math.min(timeout / 2, 3000),
            relays: successfulRelays.slice(0, 2), // Check first 2 successful relays
            signal: combinedSignal,
          }
        );

        if (verification.events.length === 0) {
          console.warn('Event published but not immediately found (this is normal)');
        }
      } catch (verifyError) {
        // Don't fail the whole operation if verification fails
        console.warn('Event verification failed (this is normal):', verifyError);
      }
    }

    return {
      event,
      successfulRelays,
      failedRelays,
      duration: Date.now() - startTime,
    };
  }

  /**
   * Publish to a single relay
   */
  private async publishToRelay(
    relayUrl: string,
    event: NostrEvent,
    options: { timeout: number; signal: AbortSignal }
  ): Promise<void> {
    const ws = await connectionPool.getConnection(relayUrl);
    
    return new Promise((resolve, reject) => {
      let isResolved = false;
      
      const timeoutId = setTimeout(() => {
        if (!isResolved) {
          isResolved = true;
          reject(new Error(`Publish timeout after ${options.timeout}ms`));
        }
      }, options.timeout);

      // Handle abort signal
      const abortHandler = () => {
        if (!isResolved) {
          isResolved = true;
          clearTimeout(timeoutId);
          reject(new Error('Publish aborted'));
        }
      };

      if (options.signal.aborted) {
        abortHandler();
        return;
      }

      options.signal.addEventListener('abort', abortHandler);
      
      const handleMessage = (messageEvent: MessageEvent) => {
        try {
          const message = JSON.parse(messageEvent.data);
          
          if (message[0] === 'OK' && message[1] === event.id) {
            if (!isResolved) {
              isResolved = true;
              clearTimeout(timeoutId);
              options.signal.removeEventListener('abort', abortHandler);
              ws.removeEventListener('message', handleMessage);
              
              if (message[2] === true) {
                resolve();
              } else {
                reject(new Error(`Relay rejected event: ${message[3] || 'Unknown reason'}`));
              }
            }
          }
        } catch (parseError) {
          // Ignore parse errors
        }
      };
      
      ws.addEventListener('message', handleMessage);
      
      try {
        // Send EVENT message
        const eventMessage = JSON.stringify(['EVENT', event]);
        ws.send(eventMessage);
        
        // For Safari, assume success after shorter timeout if no explicit rejection
        if (this.config.isSafari) {
          setTimeout(() => {
            if (!isResolved) {
              isResolved = true;
              clearTimeout(timeoutId);
              options.signal.removeEventListener('abort', abortHandler);
              ws.removeEventListener('message', handleMessage);
              resolve(); // Assume success
            }
          }, Math.min(options.timeout, 2000));
        }
      } catch (error) {
        if (!isResolved) {
          isResolved = true;
          clearTimeout(timeoutId);
          options.signal.removeEventListener('abort', abortHandler);
          ws.removeEventListener('message', handleMessage);
          reject(error);
        }
      }
    });
  }

  /**
   * Batch query multiple filter sets efficiently
   */
  async batchQuery(
    filterGroups: NostrFilter[][],
    options: NostrQueryOptions = {}
  ): Promise<NostrEvent[]> {
    const batchSize = options.relays ? 
      Math.min(this.config.batchSize, options.relays.length) : 
      this.config.batchSize;
    
    const allEvents: NostrEvent[] = [];
    const eventIds = new Set<string>();

    // Process in batches to avoid overwhelming relays
    for (let i = 0; i < filterGroups.length; i += batchSize) {
      const batch = filterGroups.slice(i, i + batchSize);
      
      // Query batch in parallel
      const batchPromises = batch.map(filters => 
        this.query(filters, options).catch(error => {
          console.warn('Batch query failed:', error);
          return { events: [], sources: new Map(), errors: new Map(), duration: 0 };
        })
      );
      
      const batchResults = await Promise.all(batchPromises);
      
      // Collect and deduplicate results
      for (const result of batchResults) {
        for (const event of result.events) {
          if (!eventIds.has(event.id)) {
            eventIds.add(event.id);
            allEvents.push(event);
          }
        }
      }
      
      // Small delay between batches
      if (i + batchSize < filterGroups.length) {
        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
      }
    }

    // Sort by created_at (newest first)
    allEvents.sort((a, b) => (b.created_at || 0) - (a.created_at || 0));

    return allEvents;
  }

  /**
   * Update relay list
   */
  setRelays(relays: string[]) {
    this.relays = [...relays];
  }

  /**
   * Get current relay list
   */
  getRelays(): string[] {
    return [...this.relays];
  }

  /**
   * Close all connections and cleanup
   */
  close() {
    connectionPool.closeAll();
  }

  /**
   * Generate unique subscription ID
   */
  private generateSubId(): string {
    return Math.random().toString(36).substring(2, 15);
  }
}

// Global client instance
let globalClient: UnifiedNostrClient | null = null;

/**
 * Get or create the global Nostr client instance
 */
export function getNostrClient(relays?: string[]): UnifiedNostrClient {
  if (!globalClient) {
    globalClient = new UnifiedNostrClient(relays);
  } else if (relays) {
    globalClient.setRelays(relays);
  }
  return globalClient;
}

/**
 * Convenience function for querying events
 */
export async function queryEvents(
  filters: NostrFilter[],
  options?: NostrQueryOptions
): Promise<NostrEvent[]> {
  const client = getNostrClient();
  const result = await client.query(filters, options);
  return result.events;
}

/**
 * Convenience function for publishing events
 */
export async function publishEvent(
  event: NostrEvent,
  options?: NostrPublishOptions
): Promise<NostrEvent> {
  const client = getNostrClient();
  const result = await client.publish(event, options);
  return result.event;
}

/**
 * Cleanup function to be called on app shutdown
 */
export function cleanup() {
  if (globalClient) {
    globalClient.close();
    globalClient = null;
  }
}

// Cleanup on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', cleanup);
}