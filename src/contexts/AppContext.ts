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
  /** NIP-65 relay list metadata (the user's personal kind 10002 relay list). */
  relayMetadata: RelayMetadata;
  /**
   * Whether to use the app's default relays. When true, the hardcoded
   * `APP_RELAYS` are included in the effective relay set (first). Defaults to
   * `true` so the app works out of the box without the user configuring relays.
   */
  useAppRelays: boolean;
  /**
   * Whether to include the user's personal NIP-65 relay list (`relayMetadata`)
   * in the effective relay set. Defaults to `false` — users must opt in via
   * Settings to actually connect to their own relays. Until enabled, only the
   * app-default relays are used (assuming `useAppRelays` is true).
   */
  useUserRelays: boolean;
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
  /** NIP-51 search relay list (kind 10007) */
  searchRelayMetadata: {
    relays: string[];
    updatedAt: number;
  };
  /** Whether to use app default search relays in addition to user search relays */
  useAppSearchRelays: boolean;
  /** Plausible Analytics domain (empty string = not configured by operator). */
  plausibleDomain: string;
  /** Plausible Analytics API endpoint (empty string = use default Plausible Cloud). */
  plausibleEndpoint: string;
  /** User opt-in/opt-out for analytics. Defaults to true; only has effect when `plausibleDomain` is configured. */
  analyticsEnabled: boolean;
}

export interface AppContextType {
  /** Current application configuration */
  config: AppConfig;
  /** Update configuration using a callback that receives current config and returns new config */
  updateConfig: (updater: (currentConfig: AppConfig) => AppConfig) => void;
}

export const AppContext = createSafeContext<AppContextType | undefined>(undefined, 'AppContext');
