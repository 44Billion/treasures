// Helper functions for relay management

import { DEFAULT_RELAYS } from '@/config';

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
  return DEFAULT_RELAYS;
}