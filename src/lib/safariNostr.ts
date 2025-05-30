// Safari-specific Nostr implementation that handles WebSocket timing issues
import { NostrFilter, NostrEvent } from '@nostrify/nostrify';

interface SafariNostrOptions {
  timeout?: number;
  maxRetries?: number;
}

class SafariNostrClient {
  private relays: string[];
  private connections: Map<string, WebSocket> = new Map();
  private subscriptions: Map<string, { resolve: Function; reject: Function; events: NostrEvent[] }> = new Map();

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
      }, 5000);

      ws.onopen = () => {
        clearTimeout(timeout);
        console.log(`Connected to ${url}`);
        resolve(ws);
      };

      ws.onerror = (error) => {
        clearTimeout(timeout);
        console.error(`Connection error to ${url}:`, error);
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
    const { timeout = 8000, maxRetries = 2 } = options;
    
    // Try each relay individually with retries
    for (const relayUrl of this.relays) {
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          console.log(`Attempting query on ${relayUrl}, attempt ${attempt + 1}`);
          const events = await this.queryRelay(relayUrl, filters, timeout);
          if (events.length > 0) {
            console.log(`Success: Got ${events.length} events from ${relayUrl}`);
            return events;
          }
        } catch (error) {
          console.warn(`Query failed on ${relayUrl}, attempt ${attempt + 1}:`, error);
          // Clean up failed connection
          const ws = this.connections.get(relayUrl);
          if (ws) {
            ws.close();
            this.connections.delete(relayUrl);
          }
        }
      }
    }

    // If all relays fail, return empty array instead of throwing
    console.warn('All relays failed, returning empty results');
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
            console.warn(`Notice from ${relayUrl}:`, message[1]);
          }
        } catch (parseError) {
          console.warn('Failed to parse message:', parseError);
        }
      };

      ws.addEventListener('message', handleMessage);

      // Send REQ
      const reqMessage = JSON.stringify(['REQ', subId, ...filters]);
      ws.send(reqMessage);
      console.log(`Sent REQ to ${relayUrl}:`, reqMessage);

      // Send CLOSE after a short delay to ensure we get EOSE
      setTimeout(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify(['CLOSE', subId]));
        }
      }, timeout - 1000); // Close 1 second before timeout
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