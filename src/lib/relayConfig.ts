/**
 * Relay configuration utilities
 * Provides consistent access to user's preferred relays across the app
 */

// Default relay configuration - using ditto.pub as primary relay
export const DEFAULT_RELAYS = [
  'wss://ditto.pub/relay',
  // Additional relays can be configured by users in Settings
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

/**
 * Save user's preferred relays to localStorage
 */
export function saveUserRelays(relays: string[]): void {
  try {
    localStorage.setItem('geocaching-relays', JSON.stringify(relays));
    // Dispatch custom event to notify App component of relay changes
    window.dispatchEvent(new CustomEvent('relays-updated'));
  } catch (error) {
    console.error('Failed to save relays:', error);
  }
}

/**
 * Add a relay to user's preferences
 */
export function addUserRelay(relay: string): void {
  const currentRelays = getUserRelays();
  if (!currentRelays.includes(relay)) {
    saveUserRelays([...currentRelays, relay]);
  }
}

/**
 * Remove a relay from user's preferences
 */
export function removeUserRelay(relay: string): void {
  const currentRelays = getUserRelays();
  const filtered = currentRelays.filter(r => r !== relay);
  // Ensure we always have at least the default relay
  if (filtered.length === 0) {
    saveUserRelays(DEFAULT_RELAYS);
  } else {
    saveUserRelays(filtered);
  }
}

/**
 * Reset relays to defaults
 */
export function resetToDefaultRelays(): void {
  saveUserRelays(DEFAULT_RELAYS);
}

/**
 * Validate a relay URL
 */
export function validateRelayUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'wss:' || parsed.protocol === 'ws:';
  } catch {
    return false;
  }
}

/**
 * Test if a relay is reachable
 */
export async function testRelayConnection(url: string, timeout = 5000): Promise<boolean> {
  if (!validateRelayUrl(url)) {
    return false;
  }

  try {
    const ws = new WebSocket(url);
    
    return await new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        ws.close();
        resolve(false);
      }, timeout);

      ws.onopen = () => {
        clearTimeout(timeoutId);
        ws.close();
        resolve(true);
      };

      ws.onerror = () => {
        clearTimeout(timeoutId);
        resolve(false);
      };
    });
  } catch {
    return false;
  }
}