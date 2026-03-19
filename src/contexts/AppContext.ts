import { createSafeContext } from "@/utils/safeContext";

export interface AppConfig {
  /** Selected relay URL */
  relayUrl: string;
  /** Plausible Analytics domain (empty string = disabled). */
  plausibleDomain: string;
  /** Plausible Analytics API endpoint (empty string = use default). */
  plausibleEndpoint: string;
}

export interface AppContextType {
  /** Current application configuration */
  config: AppConfig;
  /** Update configuration using a callback that receives current config and returns new config */
  updateConfig: (updater: (currentConfig: AppConfig) => AppConfig) => void;
  /** Optional list of preset relays to display in the RelaySelector */
  presetRelays?: { name: string; url: string }[];
}

export const AppContext = createSafeContext<AppContextType | undefined>(undefined, 'AppContext');