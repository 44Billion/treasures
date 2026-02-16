import { DEFAULT_RELAY, getUserRelays } from '@/config/relays';

/**
 * Get the relays to use for geocaching operations
 */
export function getGeocachingRelays(): string[] {
  try {
    const userRelays = getUserRelays();
    return userRelays.length > 0 ? userRelays : [DEFAULT_RELAY];
  } catch {
    return [DEFAULT_RELAY];
  }
}