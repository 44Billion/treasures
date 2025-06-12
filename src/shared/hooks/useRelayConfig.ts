import { useAppContext } from '@/shared/hooks/useAppContext';

/**
 * Hook to get and set the current relay configuration
 * @returns Current relay URL and setter function
 */
export function useRelayConfig() {
  const { config, updateConfig } = useAppContext();

  return {
    relayUrl: config.relayUrl,
    setRelayUrl: (relayUrl: string) => {
      updateConfig((current) => ({ ...current, relayUrl }));
    },
  };
}