import type { ValidNModifier } from '@/utils/nip-gc';

/**
 * NIP-GC Type Modifiers. Re-exported here as `TreasureModifier` so consumers
 * can import the user-facing concept without depending on the parser module.
 */
export type TreasureModifier = ValidNModifier;

export interface Geocache {
  id: string;
  pubkey: string;
  created_at: number;
  dTag: string; // Store the d-tag for proper replacement
  naddr?: string; // The naddr of the geocache
  kind?: number; // Original event kind (37515 for legacy, 37516 for new)
  name: string;
  description: string;
  hint?: string;
  /** Optional "Key Quest": a mission (passphrase, riddle answer, item to bring, etc.) finders are expected to complete to claim this treasure. Stored on the event as a `mission` tag. Plain visible text. */
  mission?: string;
  location: {
    lat: number;
    lng: number;
  };
  difficulty: number; // 1-5
  terrain: number; // 1-5
  size: "micro" | "small" | "regular" | "large" | "other";
  type: "traditional" | "multi" | "mystery";
  /**
   * Optional NIP-GC Type Modifiers (`n` tag values). Each modifier belongs to a
   * category; at most one modifier per category is present.
   *  - `first-to-find` (claim semantics): single-claim treasure; the first
   *    verified found log is the exclusive claim.
   *  - `art` (prize nature): the cache itself is a physical work of art.
   *
   * The `mission` field above is a behavior modifier in its own right (Key
   * Quest) but predates the `n` tag and lives in its own dedicated tag.
   */
  modifiers?: TreasureModifier[];
  /**
   * Locked-in first-to-find winner pubkey (lowercase hex), parsed from the
   * indexable `F` tag.
   *
   * Only meaningful when `modifiers` contains `first-to-find`. When present,
   * this attribution is canonical and supersedes the provisional
   * earliest-verified-log calculation, protecting the claim from being
   * displaced by a later-published verified log with a forged earlier
   * `created_at`. The specific winning verified found log can be recovered
   * by matching this pubkey against the cache's verified found logs.
   */
  ftfWinner?: string;
  images?: string[];
  contentWarning?: string; // Optional spoiler/content warning reason (NIP-36)
  /**
   * True when the treasure carries a lightning payout label tag
   * (`["l", "payout-lnurl-w", <namespace>]`, NIP-32 style) published by a
   * lightning-enabled client (e.g. Lightning Piggy). Detection keys on the
   * `payout-lnurl-w` label value; the namespace is informational only.
   * Surfaced as a bolt indicator on cards and map markers.
   */
  lightningEnabled?: boolean;
  foundCount?: number;
  logCount?: number;
  zapTotal?: number;
  relays?: string[]; // Preferred relays from the geocache event
  sourceRelay?: string; // The relay this event was fetched from
  client?: string; // The client that created this event
  verificationPubkey?: string; // Public key for verification
  hidden?: boolean; // Whether the cache is hidden from public listings
  /**
   * Owner-set lifecycle status of the listing.
   *  - `archived`:   cache is officially retired. Excluded from the map by default.
   *  - `maintenance`: cache needs owner attention. Excluded from the map by default.
   *  - `undefined`:  active / healthy cache.
   */
  status?: 'archived' | 'maintenance';
  city?: string; // Cached city/location name for display
  // Additional metadata from OSM verification
  accessibility?: {
    wheelchair?: boolean;
    parking?: boolean;
    publicTransport?: boolean;
    fee?: boolean;
    openingHours?: string;
  };
  terrainInfo?: {
    surface?: string;
    hazards?: string[];
    lit?: boolean;
    covered?: boolean;
  };
  restrictions?: string[];
  environmental?: {
    nesting?: boolean;
    protected?: string;
    leaveNoTrace?: boolean;
  };
  safety?: {
    surveillance?: boolean;
    cellCoverage?: boolean;
    lighting?: string;
  };
}

export interface GeocacheLog {
  id: string;
  pubkey: string;
  created_at: number;
  geocacheId: string;
  type: "found" | "dnf" | "note" | "maintenance" | "archived";
  text: string;
  images?: string[];
  sourceRelay?: string; // The relay this event was fetched from
  client?: string; // The client that created this event
  relays?: string[]; // Relay tags from the event
  isVerified?: boolean; // Whether this log has a valid embedded verification event
  geocachePubkey?: string; // pubkey reference to the original Geocache listing
  verificationEvent?: string;  // geocache verified found log data, embedded
}

export interface CreateGeocacheData {
  name: string;
  description: string;
  hint?: string;
  /** Optional "Key Quest" mission to claim this treasure. Stored on the event as a `mission` tag. */
  mission?: string;
  location: {
    lat: number;
    lng: number;
  };
  difficulty: number;
  terrain: number;
  size: string;
  type: string;
  images?: string[];
  contentWarning?: string; // Optional spoiler/content warning reason (NIP-36)
  hidden?: boolean;
  status?: 'archived' | 'maintenance';
  /** Optional NIP-GC `n` tag type modifiers. See `Geocache.modifiers`. */
  modifiers?: TreasureModifier[];
  /** Optional locked-in first-to-find winner pubkey. See `Geocache.ftfWinner`. */
  ftfWinner?: string;
  dTag?: string; // Optional pre-generated dTag for matching QR codes
  verificationKeyPair?: any; // Optional pre-generated verification keypair
  kind?: number; // Optional kind to preserve from claim URLs (37515 for legacy, 37516 for new)
  // Additional metadata from OSM verification
  accessibility?: {
    wheelchair?: boolean;
    parking?: boolean;
    publicTransport?: boolean;
    fee?: boolean;
    openingHours?: string;
  };
  terrainInfo?: {
    surface?: string;
    hazards?: string[];
    lit?: boolean;
    covered?: boolean;
  };
  restrictions?: string[];
  environmental?: {
    nesting?: boolean;
    protected?: string;
    leaveNoTrace?: boolean;
  };
  safety?: {
    surveillance?: boolean;
    cellCoverage?: boolean;
    lighting?: string;
  };
}

export interface CreateLogData {
  geocacheId: string;
  geocacheDTag?: string; // For linking to stable d-tag
  geocachePubkey?: string; // Pubkey of the cache owner
  geocacheKind?: number; // Kind of the geocache (37515 for legacy, 37516 for new)
  relayUrl?: string; // Optional relay URL where the cache can be found
  preferredRelays?: string[]; // Preferred relays from the geocache for publishing logs
  type: "found" | "dnf" | "note" | "maintenance" | "archived";
  text: string;
  images?: string[];
  location?: { lat: number; lng: number }; // Optional user location for the log
  verificationEvent?: string; // JSON string of embedded verification event (for found logs)
}