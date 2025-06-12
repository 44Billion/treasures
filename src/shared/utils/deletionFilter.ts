/**
 * Utilities for filtering out events that have been marked for deletion
 * Prevents showing events that are pending deletion in lists
 */

import type { NostrEvent } from '@nostrify/nostrify';

/**
 * Check if an event has been marked for deletion by a kind 5 event
 * @param targetEvent The event to check for deletion
 * @param deletionEvents Array of kind 5 events to check against
 * @returns true if the event has been deleted
 */
export function isEventDeleted(targetEvent: NostrEvent, deletionEvents: NostrEvent[]): boolean {
  return deletionEvents.some(deletionEvent => {
    // Only consider kind 5 events
    if (deletionEvent.kind !== 5) {
      return false;
    }

    // Check if the deletion event is from the same author as the target event
    if (deletionEvent.pubkey !== targetEvent.pubkey) {
      return false;
    }

    // Check if the deletion event references this specific event
    const referencedEventId = deletionEvent.tags.find(t => t[0] === 'e' && t[1] === targetEvent.id);
    if (referencedEventId) {
      return true;
    }

    // For replaceable events (kind 30000-39999), also check for coordinate-based deletion
    if (targetEvent.kind >= 30000 && targetEvent.kind <= 39999) {
      const dTag = targetEvent.tags.find(t => t[0] === 'd')?.[1];
      if (dTag) {
        const coordinate = `${targetEvent.kind}:${targetEvent.pubkey}:${dTag}`;
        const referencedCoordinate = deletionEvent.tags.find(t => t[0] === 'a' && t[1] === coordinate);
        if (referencedCoordinate) {
          return true;
        }
      }
    }

    return false;
  });
}

/**
 * Filter out events that have been marked for deletion
 * @param events Array of events to filter
 * @param deletionEvents Array of kind 5 deletion events
 * @returns Array of events with deleted events removed
 */
export function filterDeletedEvents<T extends NostrEvent>(
  events: T[], 
  deletionEvents: NostrEvent[]
): T[] {
  return events.filter(event => !isEventDeleted(event, deletionEvents));
}

/**
 * Check if an event is a deletion event
 * @param event The event to check
 * @returns true if this is a kind 5 deletion event
 */
export function isDeletionEvent(event: NostrEvent): boolean {
  return event.kind === 5;
}

/**
 * Extract the IDs of events that are referenced for deletion
 * @param deletionEvent A kind 5 deletion event
 * @returns Array of event IDs that are being deleted
 */
export function getDeletedEventIds(deletionEvent: NostrEvent): string[] {
  if (deletionEvent.kind !== 5) {
    return [];
  }

  return deletionEvent.tags
    .filter(t => t[0] === 'e' && t[1])
    .map(t => t[1]);
}

/**
 * Extract the coordinates of replaceable events that are referenced for deletion
 * @param deletionEvent A kind 5 deletion event
 * @returns Array of coordinates (kind:pubkey:d-tag) that are being deleted
 */
export function getDeletedEventCoordinates(deletionEvent: NostrEvent): string[] {
  if (deletionEvent.kind !== 5) {
    return [];
  }

  return deletionEvent.tags
    .filter(t => t[0] === 'a' && t[1])
    .map(t => t[1]);
}

/**
 * Create a set of deleted event IDs for faster lookup
 * @param deletionEvents Array of kind 5 deletion events
 * @param authorPubkey Only consider deletions by this author (optional)
 * @returns Set of event IDs that have been deleted
 */
export function createDeletedEventIdSet(
  deletionEvents: NostrEvent[], 
  authorPubkey?: string
): Set<string> {
  const deletedIds = new Set<string>();

  deletionEvents.forEach(deletionEvent => {
    if (deletionEvent.kind !== 5) {
      return;
    }

    if (authorPubkey && deletionEvent.pubkey !== authorPubkey) {
      return;
    }

    // Add directly referenced event IDs
    getDeletedEventIds(deletionEvent).forEach(id => deletedIds.add(id));
  });

  return deletedIds;
}

/**
 * Create a set of deleted event coordinates for faster lookup
 * @param deletionEvents Array of kind 5 deletion events
 * @param authorPubkey Only consider deletions by this author (optional)
 * @returns Set of coordinates that have been deleted
 */
export function createDeletedEventCoordinateSet(
  deletionEvents: NostrEvent[], 
  authorPubkey?: string
): Set<string> {
  const deletedCoordinates = new Set<string>();

  deletionEvents.forEach(deletionEvent => {
    if (deletionEvent.kind !== 5) {
      return;
    }

    if (authorPubkey && deletionEvent.pubkey !== authorPubkey) {
      return;
    }

    // Add directly referenced coordinates
    getDeletedEventCoordinates(deletionEvent).forEach(coord => deletedCoordinates.add(coord));
  });

  return deletedCoordinates;
}

/**
 * Fast filter for events using pre-built deletion sets
 * More efficient for large datasets
 */
export function fastFilterDeletedEvents<T extends NostrEvent>(
  events: T[],
  deletedIdSet: Set<string>,
  deletedCoordinateSet: Set<string>
): T[] {
  return events.filter(event => {
    // Check if event ID is in deletion set
    if (deletedIdSet.has(event.id)) {
      return false;
    }

    // For replaceable events, check coordinate-based deletion
    if (event.kind >= 30000 && event.kind <= 39999) {
      const dTag = event.tags.find(t => t[0] === 'd')?.[1];
      if (dTag) {
        const coordinate = `${event.kind}:${event.pubkey}:${dTag}`;
        if (deletedCoordinateSet.has(coordinate)) {
          return false;
        }
      }
    }

    return true;
  });
}