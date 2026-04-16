/**
 * Relay configuration constants
 *
 * Relays are now managed through AppConfig.relayMetadata and src/lib/appRelays.ts.
 * This file re-exports for backward compatibility with imports from '@/config'.
 */

export { APP_RELAYS, PRESET_RELAYS, getEffectiveRelays } from '@/lib/appRelays';

/** @deprecated Use APP_RELAYS from @/lib/appRelays instead */
export const DEFAULT_RELAY = 'wss://relay.damus.io';

/** @deprecated Use APP_RELAYS from @/lib/appRelays instead */
export const DEFAULT_RELAYS = [DEFAULT_RELAY];

/**
 * @deprecated Use config.relayMetadata from AppContext instead
 */
export function getUserRelays(): string[] {
  try {
    const saved = localStorage.getItem('geocaching-relays');
    if (saved) {
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_RELAYS;
    }
  } catch (error) {
    console.warn('Failed to parse saved relays, using defaults:', error);
  }
  return DEFAULT_RELAYS;
}
