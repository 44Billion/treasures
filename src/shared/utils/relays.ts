// Helper functions for relay management

import { DEFAULT_RELAY, DEFAULT_RELAYS } from '@/shared/config';

export const DEFAULT_GEOCACHING_RELAYS = DEFAULT_RELAYS;

export function getGeocachingRelays(): string[] {
  const saved = localStorage.getItem('geocaching-relays');
  if (saved) {
    try {
      const relays = JSON.parse(saved);
      if (Array.isArray(relays) && relays.length > 0) {
        return relays;
      }
    } catch {
      // Fall through to defaults
    }
  }
  return DEFAULT_GEOCACHING_RELAYS;
}

export function getPrimaryGeocachingRelay(): string {
  const relays = getGeocachingRelays();
  return relays[0] || DEFAULT_RELAY;
}

// Extract relay URLs from a geocache event's relay tags
export function getGeocacheRelays(event: { tags: string[][] }): string[] {
  const relayTags = event.tags.filter(tag => tag[0] === 'relay');
  return relayTags.map(tag => tag[1]).filter(Boolean);
}

// Get the primary relay from a geocache event (first relay tag)
export function getGeocachePrimaryRelay(event: { tags: string[][] }): string | undefined {
  const relays = getGeocacheRelays(event);
  return relays[0];
}