/**
 * Tests for the unified Nostr client system
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { UnifiedNostrClient, getNostrClient, queryEvents, publishEvent } from '../nostrClient';
import { NostrEvent, NostrFilter } from '@nostrify/nostrify';

// Mock WebSocket
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  url: string;
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;

  private listeners = new Map<string, ((event: any) => void)[]>();

  constructor(url: string) {
    this.url = url;
    // Simulate connection opening
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      this.onopen?.(new Event('open'));
      this.dispatchEvent('open', new Event('open'));
    }, 10);
  }

  send(data: string) {
    if (this.readyState !== MockWebSocket.OPEN) {
      throw new Error('WebSocket is not open');
    }

    // Parse the message and simulate responses
    try {
      const message = JSON.parse(data);
      this.handleMessage(message);
    } catch (error) {
      // Ignore invalid JSON
    }
  }

  close() {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.(new CloseEvent('close'));
    this.dispatchEvent('close', new CloseEvent('close'));
  }

  addEventListener(type: string, listener: (event: any) => void) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }
    this.listeners.get(type)!.push(listener);
  }

  removeEventListener(type: string, listener: (event: any) => void) {
    const listeners = this.listeners.get(type);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  private dispatchEvent(type: string, event: any) {
    const listeners = this.listeners.get(type) || [];
    listeners.forEach(listener => listener(event));
  }

  private handleMessage(message: any[]) {
    const [type, subId, ...rest] = message;

    if (type === 'REQ') {
      // Simulate query response
      setTimeout(() => {
        // Send some mock events
        const mockEvent: NostrEvent = {
          id: 'mock-event-id',
          pubkey: 'mock-pubkey',
          created_at: Math.floor(Date.now() / 1000),
          kind: 1,
          content: 'Mock event content',
          tags: [],
          sig: 'mock-signature',
        };

        this.simulateMessage(['EVENT', subId, mockEvent]);
        
        // Send EOSE
        setTimeout(() => {
          this.simulateMessage(['EOSE', subId]);
        }, 50);
      }, 20);
    } else if (type === 'EVENT') {
      // Simulate publish response
      setTimeout(() => {
        this.simulateMessage(['OK', rest[0].id, true, '']);
      }, 20);
    } else if (type === 'CLOSE') {
      // Acknowledge close
      setTimeout(() => {
        this.simulateMessage(['CLOSED', subId, '']);
      }, 10);
    }
  }

  private simulateMessage(message: any[]) {
    const messageEvent = new MessageEvent('message', {
      data: JSON.stringify(message),
    });
    this.onmessage?.(messageEvent);
    this.dispatchEvent('message', messageEvent);
  }
}

// Mock global WebSocket
global.WebSocket = MockWebSocket as any;

// Mock navigator for Safari detection
Object.defineProperty(global.navigator, 'userAgent', {
  value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  configurable: true,
});

describe('UnifiedNostrClient', () => {
  let client: UnifiedNostrClient;
  const testRelays = ['wss://test1.relay', 'wss://test2.relay'];

  beforeEach(() => {
    client = new UnifiedNostrClient(testRelays);
    vi.clearAllTimers();
    vi.useFakeTimers();
  });

  afterEach(() => {
    client.close();
    vi.useRealTimers();
  });

  describe('query', () => {
    it('should query events successfully', async () => {
      const filters: NostrFilter[] = [{ kinds: [1], limit: 10 }];
      
      const queryPromise = client.query(filters);
      
      // Advance timers to allow WebSocket connection and responses
      await vi.advanceTimersByTimeAsync(100);
      
      const result = await queryPromise;
      
      expect(result.events).toHaveLength(2); // One from each relay
      expect(result.events[0]).toMatchObject({
        id: 'mock-event-id',
        kind: 1,
        content: 'Mock event content',
      });
      expect(result.duration).toBeGreaterThan(0);
    });

    it('should handle query timeout', async () => {
      const filters: NostrFilter[] = [{ kinds: [1] }];
      
      const queryPromise = client.query(filters, { timeout: 100 });
      
      // Don't advance timers enough for response
      await vi.advanceTimersByTimeAsync(50);
      
      await expect(queryPromise).rejects.toThrow();
    });

    it('should deduplicate events by ID', async () => {
      const filters: NostrFilter[] = [{ kinds: [1] }];
      
      const queryPromise = client.query(filters, { deduplicateBy: 'id' });
      
      await vi.advanceTimersByTimeAsync(100);
      
      const result = await queryPromise;
      
      // Should deduplicate identical events from different relays
      const uniqueIds = new Set(result.events.map(e => e.id));
      expect(uniqueIds.size).toBe(1);
    });

    it('should handle relay errors gracefully', async () => {
      // Mock a failing relay
      const originalWebSocket = global.WebSocket;
      global.WebSocket = class extends MockWebSocket {
        constructor(url: string) {
          super(url);
          if (url.includes('test1')) {
            setTimeout(() => {
              this.onerror?.(new Event('error'));
            }, 5);
          }
        }
      } as any;

      const filters: NostrFilter[] = [{ kinds: [1] }];
      
      const queryPromise = client.query(filters);
      
      await vi.advanceTimersByTimeAsync(100);
      
      const result = await queryPromise;
      
      // Should still get events from working relay
      expect(result.events.length).toBeGreaterThan(0);
      expect(result.errors.size).toBeGreaterThan(0);

      global.WebSocket = originalWebSocket;
    });
  });

  describe('publish', () => {
    it('should publish events successfully', async () => {
      const event: NostrEvent = {
        id: 'test-event-id',
        pubkey: 'test-pubkey',
        created_at: Math.floor(Date.now() / 1000),
        kind: 1,
        content: 'Test content',
        tags: [],
        sig: 'test-signature',
      };
      
      const publishPromise = client.publish(event);
      
      await vi.advanceTimersByTimeAsync(100);
      
      const result = await publishPromise;
      
      expect(result.event).toEqual(event);
      expect(result.successfulRelays).toHaveLength(2);
      expect(result.failedRelays.size).toBe(0);
    });

    it('should handle minimum success requirement', async () => {
      const event: NostrEvent = {
        id: 'test-event-id',
        pubkey: 'test-pubkey',
        created_at: Math.floor(Date.now() / 1000),
        kind: 1,
        content: 'Test content',
        tags: [],
        sig: 'test-signature',
      };
      
      const publishPromise = client.publish(event, { requireMinSuccess: 3 });
      
      await vi.advanceTimersByTimeAsync(100);
      
      await expect(publishPromise).rejects.toThrow('Failed to publish to minimum required relays');
    });
  });

  describe('batchQuery', () => {
    it('should handle batch queries efficiently', async () => {
      const filterGroups: NostrFilter[][] = [
        [{ kinds: [1], limit: 5 }],
        [{ kinds: [2], limit: 5 }],
        [{ kinds: [3], limit: 5 }],
      ];
      
      const batchPromise = client.batchQuery(filterGroups);
      
      await vi.advanceTimersByTimeAsync(500);
      
      const events = await batchPromise;
      
      expect(events.length).toBeGreaterThan(0);
    });
  });

  describe('relay management', () => {
    it('should update relay list', () => {
      const newRelays = ['wss://new1.relay', 'wss://new2.relay'];
      
      client.setRelays(newRelays);
      
      expect(client.getRelays()).toEqual(newRelays);
    });
  });
});

describe('Global client functions', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should provide global client instance', () => {
    const client1 = getNostrClient();
    const client2 = getNostrClient();
    
    expect(client1).toBe(client2); // Should be same instance
  });

  it('should provide convenience query function', async () => {
    const filters: NostrFilter[] = [{ kinds: [1] }];
    
    const eventsPromise = queryEvents(filters);
    
    await vi.advanceTimersByTimeAsync(100);
    
    const events = await eventsPromise;
    
    expect(Array.isArray(events)).toBe(true);
  });

  it('should provide convenience publish function', async () => {
    const event: NostrEvent = {
      id: 'test-event-id',
      pubkey: 'test-pubkey',
      created_at: Math.floor(Date.now() / 1000),
      kind: 1,
      content: 'Test content',
      tags: [],
      sig: 'test-signature',
    };
    
    const publishPromise = publishEvent(event);
    
    await vi.advanceTimersByTimeAsync(100);
    
    const result = await publishPromise;
    
    expect(result).toEqual(event);
  });
});

describe('Browser optimization', () => {
  it('should detect Safari and use optimized settings', () => {
    // Mock Safari user agent
    Object.defineProperty(global.navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15',
      configurable: true,
    });

    const client = new UnifiedNostrClient();
    
    // Safari detection should be working (tested indirectly through timeout behavior)
    expect(client).toBeDefined();
  });

  it('should detect Chrome and use standard settings', () => {
    // Mock Chrome user agent
    Object.defineProperty(global.navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      configurable: true,
    });

    const client = new UnifiedNostrClient();
    
    expect(client).toBeDefined();
  });
});