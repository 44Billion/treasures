import { DEFAULT_RELAY, getUserRelays } from '@/shared/config/relays';

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

/**
 * Get the primary relay for geocaching
 */
export function getPrimaryGeocachingRelay(): string {
  const relays = getGeocachingRelays();
  return relays[0] || DEFAULT_RELAY;
}