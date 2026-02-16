/**
 * Relay configuration constants
 */

// Primary relay for the application
export const DEFAULT_RELAY = 'wss://relay.damus.io';

// Array of relays (for compatibility)
export const DEFAULT_RELAYS = [DEFAULT_RELAY];

// Preset relays for user selection
export const PRESET_RELAYS = [
  { name: 'Ditto', url: 'wss://relay.ditto.pub' },
  { name: 'nos.lol', url: 'wss://nos.lol' },
  { name: 'Damus', url: 'wss://relay.damus.io' },
  { name: 'Dreamith', url: 'wss://relay.dreamith.to' },
];

/**
 * Get user's preferred relays from localStorage, fallback to defaults
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
