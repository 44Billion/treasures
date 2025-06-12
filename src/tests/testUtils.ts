/**
 * Test utilities and common mocks for data management tests
 */

import { vi, expect } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import React from 'react';
import type { Geocache, GeocacheLog } from '@/types/geocache';

/**
 * Create a fresh QueryClient for testing
 */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

/**
 * Mock geocache data for testing
 */
export const mockGeocaches: Geocache[] = [
  {
    id: 'test-cache-1',
    name: 'Mountain Adventure',
    pubkey: 'test-pubkey-1',
    created_at: Math.floor(new Date('2024-01-01T00:00:00Z').getTime() / 1000),
    dTag: 'mountain-adventure',
    difficulty: 2,
    terrain: 3,
    size: 'regular',
    type: 'traditional',
    description: 'A challenging cache hidden in the mountains',
    location: { lat: 40.7128, lng: -74.0060 },
    images: ['image1.jpg'],
    hidden: false,
  },
  {
    id: 'test-cache-2',
    name: 'Urban Explorer',
    pubkey: 'test-pubkey-2',
    created_at: Math.floor(new Date('2024-01-02T00:00:00Z').getTime() / 1000),
    dTag: 'urban-explorer',
    difficulty: 1,
    terrain: 1,
    size: 'small',
    type: 'multi',
    description: 'Explore the city with this multi-stage cache',
    location: { lat: 40.7589, lng: -73.9851 },
    images: [],
    hidden: false,
  },
  {
    id: 'test-cache-3',
    name: 'Hidden Gem',
    pubkey: 'test-pubkey-1',
    created_at: Math.floor(new Date('2024-01-03T00:00:00Z').getTime() / 1000),
    dTag: 'hidden-gem',
    difficulty: 3,
    terrain: 2,
    size: 'micro',
    type: 'mystery',
    description: 'Solve the puzzle to find this cache',
    location: { lat: 40.7488, lng: -73.9857 },
    images: ['image2.jpg', 'image3.jpg'],
    hidden: true, // Hidden cache for testing visibility
  },
];

/**
 * Mock log data for testing
 */
export const mockLogs: GeocacheLog[] = [
  {
    id: 'log-1',
    type: 'found',
    text: 'Great cache! Enjoyed the hike.',
    pubkey: 'finder-1',
    created_at: Math.floor(new Date('2024-01-04T10:00:00Z').getTime() / 1000),
    geocacheId: 'test-cache-1',
  },
  {
    id: 'log-2',
    type: 'note',
    text: 'Thanks for the hint!',
    pubkey: 'finder-2',
    created_at: Math.floor(new Date('2024-01-05T14:30:00Z').getTime() / 1000),
    geocacheId: 'test-cache-1',  
  },
  {
    id: 'log-3',
    type: 'found',
    text: 'Solved the puzzle after some effort',
    pubkey: 'finder-3',
    created_at: Math.floor(new Date('2024-01-06T09:15:00Z').getTime() / 1000),
    geocacheId: 'test-cache-3',
  },
];

/**
 * Mock Nostr events for testing
 */
export const mockNostrEvents = {
  geocaches: [
    {
      id: 'test-cache-1',
      kind: 37515,
      pubkey: 'test-pubkey-1',
      content: JSON.stringify({
        name: 'Mountain Adventure',
        description: 'A challenging cache hidden in the mountains',
        difficulty: 2,
        terrain: 3,
        type: 'Traditional',
      }),
      tags: [
        ['d', 'mountain-adventure'],
        ['g', 'GEOHASH'],
        ['image', 'image1.jpg'],
      ],
      created_at: Math.floor(new Date('2024-01-01').getTime() / 1000),
      sig: 'test-signature-1',
    },
    {
      id: 'test-cache-2',
      kind: 37515,
      pubkey: 'test-pubkey-2',
      content: JSON.stringify({
        name: 'Urban Explorer',
        description: 'Explore the city with this multi-stage cache',
        difficulty: 1,
        terrain: 1,
        type: 'Multi-cache',
      }),
      tags: [
        ['d', 'urban-explorer'],
        ['g', 'GEOHASH2'],
      ],
      created_at: Math.floor(new Date('2024-01-02').getTime() / 1000),
      sig: 'test-signature-2',
    },
  ],
  logs: [
    {
      id: 'log-1',
      kind: 3753515, // Found log
      pubkey: 'finder-1',
      content: 'Great cache! Enjoyed the hike.',
      tags: [['a', '37515:test-pubkey-1:mountain-adventure']],
      created_at: Math.floor(new Date('2024-01-04T10:00:00Z').getTime() / 1000),
      sig: 'log-signature-1',
    },
    {
      id: 'log-2',
      kind: 3753516, // Comment log
      pubkey: 'finder-2',
      content: 'Thanks for the hint!',
      tags: [['A', '37515:test-pubkey-1:mountain-adventure']],
      created_at: Math.floor(new Date('2024-01-05T14:30:00Z').getTime() / 1000),
      sig: 'log-signature-2',
    },
  ],
  deletions: [
    {
      id: 'deletion-1',
      kind: 5,
      pubkey: 'test-pubkey-1',
      content: '',
      tags: [['e', 'test-cache-1']],
      created_at: Math.floor(new Date('2024-01-07').getTime() / 1000),
      sig: 'deletion-signature-1',
    },
  ],
  profiles: [
    {
      id: 'profile-1',
      kind: 0,
      pubkey: 'test-pubkey-1',
      content: JSON.stringify({
        name: 'Cache Creator',
        about: 'Love creating outdoor challenges',
        picture: 'avatar1.jpg',
      }),
      tags: [],
      created_at: Math.floor(new Date('2024-01-01').getTime() / 1000),
      sig: 'profile-signature-1',
    },
  ],
};

/**
 * Common mock configurations
 */
export const commonMocks = {
  constants: {
    TIMEOUTS: {
      QUERY: 8000,
      FAST_QUERY: 3000,
    },
    POLLING_INTERVALS: {
      GEOCACHES: 60000,
      LOGS: 30000,
      DELETION_EVENTS: 120000,
      BACKGROUND_SYNC: 300000,
      FAST_UPDATES: 15000,
      SLOW_UPDATES: 600000,
    },
    QUERY_LIMITS: {
      GEOCACHES: 100,
      LOGS: 200,
      DELETION_EVENTS: 100,
    },
  },
  nipGc: {
    NIP_GC_KINDS: {
      GEOCACHE: 37515,
      FOUND_LOG: 3753515,
      COMMENT_LOG: 3753516,
    },
    createGeocacheCoordinate: vi.fn((pubkey: string, dTag: string) => 
      `37515:${pubkey}:${dTag}`
    ),
    parseGeocacheEvent: vi.fn((event) => {
      const content = JSON.parse(event.content || '{}');
      const dTag = event.tags.find((t: string[]) => t[0] === 'd')?.[1];
      
      return {
        id: event.id,
        name: content.name || 'Test Cache',
        pubkey: event.pubkey,
        created_at: event.created_at,
        dTag,
        difficulty: content.difficulty || 1,
        terrain: content.terrain || 1,
        size: 'regular',
        type: content.type || 'traditional',
        description: content.description || 'Test description',
        location: { lat: 0, lng: 0 },
        images: event.tags.filter((t: string[]) => t[0] === 'image').map((t: string[]) => t[1]),
        hidden: false,
      };
    }),
    parseLogEvent: vi.fn((event) => ({
      id: event.id,
      type: event.kind === 3753515 ? 'found' : 'note',
      text: event.content,
      pubkey: event.pubkey,
      created_at: event.created_at,
      geocacheId: 'test-geocache',
    })),
  },
  storage: {
    getStoredGeocaches: vi.fn().mockResolvedValue(mockGeocaches),
    removeGeocache: vi.fn().mockResolvedValue(undefined),
    removeLog: vi.fn().mockResolvedValue(undefined),
    storeGeocaches: vi.fn().mockResolvedValue(undefined),
  },
};

/**
 * Create a mock Nostr client with customizable behavior
 */
export function createMockNostr(customBehavior: Record<string, any> = {}) {
  return {
    query: vi.fn().mockImplementation((filters) => {
      const filter = filters[0];
      
      // Custom behavior override
      if (customBehavior.query) {
        const result = customBehavior.query(filters);
        if (result !== undefined) return result;
      }
      
      // Default behavior based on filter kinds
      if (filter.kinds?.includes(37515)) {
        return Promise.resolve(mockNostrEvents.geocaches);
      }
      
      if (filter.kinds?.includes(3753515) || filter.kinds?.includes(3753516)) {
        return Promise.resolve(mockNostrEvents.logs);
      }
      
      if (filter.kinds?.includes(5)) {
        return Promise.resolve(mockNostrEvents.deletions);
      }
      
      if (filter.kinds?.includes(0)) {
        return Promise.resolve(mockNostrEvents.profiles);
      }
      
      return Promise.resolve([]);
    }),
    event: vi.fn().mockResolvedValue(undefined),
  };
}

/**
 * Setup standard mocks for all tests
 */
export function setupStandardMocks() {
  vi.mock('@/shared/config', () => commonMocks.constants);
  vi.mock('@/features/geocache/utils/nip-gc', () => commonMocks.nipGc);
  vi.mock('@/features/offline/utils/offlineStorage', () => ({ offlineStorage: commonMocks.storage }));
  
  // Note: simpleStores removed - use direct store mocks instead
  
  vi.mock('@/hooks/useConnectivity', () => ({
    useOnlineStatus: () => ({ isOnline: true, isConnected: true }),
  }));
}

/**
 * Test helper for advancing timers and waiting for effects
 */
export function advanceTimersAndWait(ms: number) {
  vi.advanceTimersByTime(ms);
  return new Promise(resolve => setTimeout(resolve, 0));
}

/**
 * Test helper for creating error scenarios
 */
export function createErrorScenario(errorType: 'network' | 'timeout' | 'parse') {
  switch (errorType) {
    case 'network':
      return new Error('Network request failed');
    case 'timeout':
      return new Error('Request timeout');
    case 'parse':
      return new Error('Failed to parse response');
    default:
      return new Error('Unknown error');
  }
}

/**
 * Test helper for asserting query calls
 */
export function expectQueryCall(mockQuery: any, expectedFilters: any) {
  expect(mockQuery).toHaveBeenCalledWith(
    expect.arrayContaining([
      expect.objectContaining(expectedFilters)
    ]),
    expect.objectContaining({
      signal: expect.any(AbortSignal)
    })
  );
}

/**
 * Test helper for checking invalidation calls
 */
export function expectInvalidation(mockInvalidate: any, queryKey: string[]) {
  expect(mockInvalidate).toHaveBeenCalledWith({
    queryKey,
  });
}