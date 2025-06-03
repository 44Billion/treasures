// Safari-specific Nostr implementation that handles WebSocket timing issues
import { NostrFilter, NostrEvent } from '@nostrify/nostrify';

interface SafariNostrOptions {
  timeout?: number;
  maxRetries?: number;
}

class SafariNostrClient {
  private relays: string[];
  private connections: Map<string, WebSocket> = new Map();
  private subscriptions: Map<string, { 
    resolve: (value: NostrEvent[]) => void; 
    reject: (reason?: unknown) => void; 
    events: NostrEvent[] 
  }> = new Map();

  constructor(relays: string[]) {
    this.relays = relays;
  }

  private generateSubId(): string {
    return Math.random().toString(36).substring(2, 15);
  }

  private async connectToRelay(url: string): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url);
      
      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error(`Connection timeout to ${url}`));
      }, 3000);

      ws.onopen = () => {
        clearTimeout(timeout);
        resolve(ws);
      };

      ws.onerror = (error) => {
        clearTimeout(timeout);
        reject(new Error(`Failed to connect to ${url}`));
      };

      ws.onclose = () => {
        this.connections.delete(url);
      };
    });
  }

  private async getConnection(url: string): Promise<WebSocket> {
    const existing = this.connections.get(url);
    if (existing && existing.readyState === WebSocket.OPEN) {
      return existing;
    }

    const ws = await this.connectToRelay(url);
    this.connections.set(url, ws);
    return ws;
  }

  async query(filters: NostrFilter[], options: SafariNostrOptions = {}): Promise<NostrEvent[]> {
    const { timeout = 4000, maxRetries = 1 } = options;
    
    // Try relays in parallel for faster results
    const relayPromises = this.relays.slice(0, 2).map(async (relayUrl) => {
      try {
        return await this.queryRelay(relayUrl, filters, timeout);
      } catch (error) {
        // Clean up failed connection
        const ws = this.connections.get(relayUrl);
        if (ws) {
          ws.close();
          this.connections.delete(relayUrl);
        }
        return [];
      }
    });

    // Wait for first successful result or all to complete
    const results = await Promise.allSettled(relayPromises);
    
    // Return first non-empty result
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value.length > 0) {
        return result.value;
      }
    }

    // If no results, try one more relay sequentially as fallback
    if (this.relays.length > 2) {
      try {
        return await this.queryRelay(this.relays[2], filters, timeout);
      } catch (error) {
        // Clean up failed connection
        const ws = this.connections.get(this.relays[2]);
        if (ws) {
          ws.close();
          this.connections.delete(this.relays[2]);
        }
      }
    }

    return [];
  }

  private async queryRelay(relayUrl: string, filters: NostrFilter[], timeout: number): Promise<NostrEvent[]> {
    const ws = await this.getConnection(relayUrl);
    const subId = this.generateSubId();

    return new Promise((resolve, reject) => {
      const events: NostrEvent[] = [];
      let isResolved = false;

      // Set up timeout
      const timeoutId = setTimeout(() => {
        if (!isResolved) {
          isResolved = true;
          this.subscriptions.delete(subId);
          reject(new Error(`Query timeout after ${timeout}ms`));
        }
      }, timeout);

      // Store subscription
      this.subscriptions.set(subId, { resolve, reject, events });

      // Set up message handler
      const handleMessage = (event: MessageEvent) => {
        try {
          const message = JSON.parse(event.data);
          
          if (message[0] === 'EVENT' && message[1] === subId) {
            events.push(message[2]);
          } else if (message[0] === 'EOSE' && message[1] === subId) {
            if (!isResolved) {
              isResolved = true;
              clearTimeout(timeoutId);
              this.subscriptions.delete(subId);
              ws.removeEventListener('message', handleMessage);
              resolve(events);
            }
          } else if (message[0] === 'NOTICE') {
          }
        } catch (parseError) {
        }
      };

      ws.addEventListener('message', handleMessage);

      // Send REQ
      const reqMessage = JSON.stringify(['REQ', subId, ...filters]);
      ws.send(reqMessage);

      // Send CLOSE after a short delay to ensure we get EOSE
      setTimeout(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify(['CLOSE', subId]));
        }
      }, timeout - 1000); // Close 1 second before timeout
    });
  }

  async publish(event: NostrEvent, options: SafariNostrOptions = {}): Promise<void> {
    const { timeout = 5000, maxRetries = 2 } = options;
    const errors: Error[] = [];
    
    // Try to publish to multiple relays in parallel for better success rate
    const publishPromises = this.relays.slice(0, 3).map(async (relayUrl) => {
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          await this.publishToRelay(relayUrl, event, timeout);
          return; // Success
        } catch (error) {
          errors.push(error as Error);
          // Clean up failed connection
          const ws = this.connections.get(relayUrl);
          if (ws) {
            ws.close();
            this.connections.delete(relayUrl);
          }
        }
      }
      throw new Error(`Failed to publish to ${relayUrl} after ${maxRetries} attempts`);
    });
    
    // Wait for at least one successful publish
    const results = await Promise.allSettled(publishPromises);
    const successful = results.some(result => result.status === 'fulfilled');
    
    if (!successful) {
      throw new Error(`Failed to publish to any relay: ${errors.map(e => e.message).join(', ')}`);
    }
  }

  private async publishToRelay(relayUrl: string, event: NostrEvent, timeout: number): Promise<void> {
    const ws = await this.getConnection(relayUrl);
    
    return new Promise((resolve, reject) => {
      let isResolved = false;
      
      const timeoutId = setTimeout(() => {
        if (!isResolved) {
          isResolved = true;
          reject(new Error(`Publish timeout after ${timeout}ms`));
        }
      }, timeout);
      
      const handleMessage = (messageEvent: MessageEvent) => {
        try {
          const message = JSON.parse(messageEvent.data);
          
          if (message[0] === 'OK' && message[1] === event.id) {
            if (!isResolved) {
              isResolved = true;
              clearTimeout(timeoutId);
              ws.removeEventListener('message', handleMessage);
              
              if (message[2] === true) {
                resolve();
              } else {
                reject(new Error(`Relay rejected event: ${message[3] || 'Unknown reason'}`));
              }
            }
          } else if (message[0] === 'NOTICE') {
            // Log notices but don't fail
            console.warn(`Relay notice from ${relayUrl}:`, message[1]);
          }
        } catch (parseError) {
          // Ignore parse errors for non-JSON messages
        }
      };
      
      ws.addEventListener('message', handleMessage);
      
      // Send EVENT message
      const eventMessage = JSON.stringify(['EVENT', event]);
      ws.send(eventMessage);
      
      // Set a shorter timeout for OK response
      setTimeout(() => {
        if (!isResolved) {
          isResolved = true;
          clearTimeout(timeoutId);
          ws.removeEventListener('message', handleMessage);
          // Assume success if no explicit rejection after reasonable time
          resolve();
        }
      }, Math.min(timeout, 3000));
    });
  }

  close() {
    for (const [url, ws] of this.connections) {
      ws.close();
    }
    this.connections.clear();
    this.subscriptions.clear();
  }
}

// Safari detection
export function isSafari(): boolean {
  return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
}

// Create Safari-compatible Nostr client
export function createSafariNostr(relays: string[]): SafariNostrClient {
  return new SafariNostrClient(relays);
}