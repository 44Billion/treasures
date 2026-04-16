import { useAppContext } from '@/hooks/useAppContext';

/**
 * Hook to get the current relay configuration.
 * Returns the primary relay URL from the relay metadata.
 */
export function useRelayConfig() {
  const { config } = useAppContext();

  const relays = config.relayMetadata.relays;
  const primaryRelay = relays.find(r => r.read)?.url ?? '';

  return {
    relayUrl: primaryRelay,
    relays,
  };
}
