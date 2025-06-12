import { useState, useEffect } from 'react';
import { DEFAULT_RELAY, getUserRelays, saveUserRelays } from '@/shared/config/relays';

/**
 * Hook for managing relay configuration
 * Provides the current relay URL and functions to update it
 */
export function useRelayConfig() {
  const [relayUrl, setRelayUrl] = useState<string>(DEFAULT_RELAY);

  // Load saved relay on mount
  useEffect(() => {
    const userRelays = getUserRelays();
    if (userRelays.length > 0) {
      setRelayUrl(userRelays[0]); // Use first relay as primary
    }
  }, []);

  // Update relay URL and save to localStorage
  const updateRelay = (newRelayUrl: string) => {
    setRelayUrl(newRelayUrl);
    saveUserRelays([newRelayUrl]);
  };

  return {
    relayUrl,
    updateRelay,
  };
}