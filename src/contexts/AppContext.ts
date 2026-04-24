import { createSafeContext } from "@/utils/safeContext";

export interface RelayMetadata {
  /** List of relays with read/write permissions */
  relays: { url: string; read: boolean; write: boolean }[];
  /** Unix timestamp of when the relay list was last updated */
  updatedAt: number;
}

export interface BlossomServerMetadata {
  /** Ordered list of Blossom server URLs (most trusted first, per BUD-03) */
  servers: string[];
  /** Unix timestamp from the kind 10063 event */
  updatedAt: number;
}

export interface AppConfig {
  /** NIP-65 relay list metadata */
  relayMetadata: RelayMetadata;
  /** Whether to use app default relays in addition to user relays */
  useAppRelays: boolean;
  /** BUD-03 Blossom server list metadata */
  blossomServerMetadata: BlossomServerMetadata;
  /** Whether to use app default Blossom servers in addition to user servers */
  useAppBlossomServers: boolean;
  /** Image upload quality: compressed resizes large images, original uploads as-is */
  imageQuality: 'compressed' | 'original';
  /** Image proxy base URL for thumbnails in lists. Reduces bandwidth and speeds up scrolling.
   *  Empty string = disabled (load original images directly, fully decentralized).
   *  Any URL = proxy thumbnails through that host (must support wsrv.nl-compatible API).
   *  Default public instance: 'https://wsrv.nl' (open-source, self-hostable). */
  imageProxy: string;
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
}

export const AppContext = createSafeContext<AppContextType | undefined>(undefined, 'AppContext');
