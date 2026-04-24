import { ReactNode } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { AppContext, type AppConfig, type AppContextType } from '@/contexts/AppContext';

interface AppProviderProps {
  children: ReactNode;
  /** Application storage key */
  storageKey: string;
  /** Default app configuration */
  defaultConfig: AppConfig;
}

// One-time migration: clear old config shape that had `relayUrl` instead of `relayMetadata`.
try {
  const raw = localStorage.getItem('treasures:app-config');
  if (raw) {
    const parsed = JSON.parse(raw);
    if (parsed && (!parsed.relayMetadata || parsed.useAppRelays === undefined || !parsed.blossomServerMetadata)) {
      localStorage.removeItem('treasures:app-config');
    }
  }
} catch {
  // ignore
}

export function AppProvider(props: AppProviderProps) {
  const {
    children,
    storageKey,
    defaultConfig,
  } = props;

  // App configuration state with localStorage persistence.
  // Merge with defaults so new config fields added in updates get their default values
  // instead of being undefined from the old saved config.
  const [storedConfig, setConfig] = useLocalStorage<AppConfig>(storageKey, defaultConfig);
  const config: AppConfig = { ...defaultConfig, ...storedConfig };

  // Generic config updater with callback pattern
  const updateConfig = (updater: (currentConfig: AppConfig) => AppConfig) => {
    setConfig(updater);
  };

  const appContextValue: AppContextType = {
    config,
    updateConfig,
  };

  return (
    <AppContext.Provider value={appContextValue}>
      {children}
    </AppContext.Provider>
  );
}
