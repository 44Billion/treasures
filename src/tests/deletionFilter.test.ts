/**
 * Simple test for deletion filtering functionality
 * Tests that events marked for deletion are properly filtered out
 */

import { describe, it, expect } from 'vitest';
import { 
  isEventDeleted, 
  filterDeletedEvents, 
  createDeletedEventIdSet, 
  fastFilterDeletedEvents 
} from '../deletionFilter';
import type { NostrEvent } from '@nostrify/nostrify';

// Mock events for testing
const createMockEvent = (id: string, pubkey: string, kind: number): NostrEvent => ({
  id,
  pubkey,
  kind,
  content: '',
  tags: [],
  created_at: Date.now(),
  sig: 'mock-signature',
});

const createMockDeletionEvent = (userPubkey: string, deletedEventId: string): NostrEvent => ({
  id: 'deletion-' + deletedEventId,
  pubkey: userPubkey,
  kind: 5, // Deletion event
  content: 'Event deleted',
  tags: [
    ['e', deletedEventId],
    ['client', 'treasures']
  ],
  created_at: Date.now(),
  sig: 'mock-signature',
});

const createMockGeocacheDeletionEvent = (
  userPubkey: string, 
  geocacheId: string, 
  geocachePubkey: string, 
  dTag: string,
  kind: number = 37515
): NostrEvent => ({
  id: 'deletion-' + geocacheId,
  pubkey: userPubkey,
  kind: 5, // Deletion event
  content: 'Geocache deleted',
  tags: [
    ['e', geocacheId],
    ['k', kind.toString()],
    ['a', `${kind}:${geocachePubkey}:${dTag}`],
    ['client', 'treasures']
  ],
  created_at: Date.now(),
  sig: 'mock-signature',
});

describe('Deletion Filtering', () => {
  it('should identify when an event is deleted by specific event ID', () => {
    const userPubkey = 'user123';
    const targetEvent = createMockEvent('event1', userPubkey, 1);
    const deletionEvent = createMockDeletionEvent(userPubkey, 'event1');
    
    const isDeleted = isEventDeleted(targetEvent, [deletionEvent]);
    expect(isDeleted).toBe(true);
  });

  it('should not identify event as deleted if pubkeys do not match', () => {
    const userPubkey = 'user123';
    const otherUserPubkey = 'user456';
    const targetEvent = createMockEvent('event1', userPubkey, 1);
    const deletionEvent = createMockDeletionEvent(otherUserPubkey, 'event1');
    
    const isDeleted = isEventDeleted(targetEvent, [deletionEvent]);
    expect(isDeleted).toBe(false);
  });

  it('should filter out deleted events from array', () => {
    const userPubkey = 'user123';
    const events = [
      createMockEvent('event1', userPubkey, 1),
      createMockEvent('event2', userPubkey, 1),
      createMockEvent('event3', userPubkey, 1),
    ];
    
    const deletionEvents = [
      createMockDeletionEvent(userPubkey, 'event2'), // Delete event2
    ];
    
    const filteredEvents = filterDeletedEvents(events, deletionEvents);
    
    expect(filteredEvents).toHaveLength(2);
    expect(filteredEvents.map(e => e.id)).toEqual(['event1', 'event3']);
  });

  it('should handle replaceable event deletion by coordinate', () => {
    const userPubkey = 'user123';
    const dTag = 'my-geocache';
    const geocacheEvent = createMockEvent('geocache1', userPubkey, 37515);
    geocacheEvent.tags = [['d', dTag]];
    
    const deletionEvent = createMockGeocacheDeletionEvent(userPubkey, 'geocache1', userPubkey, dTag);
    
    const isDeleted = isEventDeleted(geocacheEvent, [deletionEvent]);
    expect(isDeleted).toBe(true);
  });

  it('should create correct deleted event ID set', () => {
    const userPubkey = 'user123';
    const deletionEvents = [
      createMockDeletionEvent(userPubkey, 'event1'),
      createMockDeletionEvent(userPubkey, 'event3'),
    ];
    
    const deletedIds = createDeletedEventIdSet(deletionEvents);
    
    expect(deletedIds.has('event1')).toBe(true);
    expect(deletedIds.has('event2')).toBe(false);
    expect(deletedIds.has('event3')).toBe(true);
  });

  it('should fast filter events using pre-built sets', () => {
    const userPubkey = 'user123';
    const events = [
      createMockEvent('event1', userPubkey, 1),
      createMockEvent('event2', userPubkey, 1),
      createMockEvent('event3', userPubkey, 1),
    ];
    
    const deletedIds = new Set(['event2']);
    const deletedCoordinates = new Set<string>();
    
    const filteredEvents = fastFilterDeletedEvents(events, deletedIds, deletedCoordinates);
    
    expect(filteredEvents).toHaveLength(2);
    expect(filteredEvents.map(e => e.id)).toEqual(['event1', 'event3']);
  });

  it('should maintain original order when filtering', () => {
    const userPubkey = 'user123';
    const events = [
      createMockEvent('event1', userPubkey, 1),
      createMockEvent('event2', userPubkey, 1),
      createMockEvent('event3', userPubkey, 1),
      createMockEvent('event4', userPubkey, 1),
    ];
    
    const deletionEvents = [
      createMockDeletionEvent(userPubkey, 'event2'),
      createMockDeletionEvent(userPubkey, 'event4'),
    ];
    
    const filteredEvents = filterDeletedEvents(events, deletionEvents);
    
    expect(filteredEvents.map(e => e.id)).toEqual(['event1', 'event3']);
  });
});