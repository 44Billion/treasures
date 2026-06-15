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

// One-time migration: clear old config shapes so the new relay model re-seeds.
// Triggers when:
//  - the pre-relayMetadata shape (had `relayUrl`) is present, OR
//  - the relay toggles are missing (`useAppRelays`/`useUserRelays` undefined),
//    which also means the old `relayMetadata` defaulted to the app relays
//    (Ditto/Damus/nos.lol). Clearing lets `relayMetadata` reset to the user's
//    own NIP-65 list (empty until synced) under the new opt-in model.
try {
  const raw = localStorage.getItem('treasures:app-config');
  if (raw) {
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      (!parsed.relayMetadata ||
        parsed.useAppRelays === undefined ||
        parsed.useUserRelays === undefined ||
        !parsed.blossomServerMetadata)
    ) {
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
