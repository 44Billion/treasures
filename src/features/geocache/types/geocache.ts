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
  location: {
    lat: number;
    lng: number;
  };
  difficulty: number; // 1-5
  terrain: number; // 1-5
  size: "micro" | "small" | "regular" | "large" | "other";
  type: "traditional" | "multi" | "mystery";
  images?: string[];
  foundCount?: number;
  logCount?: number;
  zapTotal?: number;
  relays?: string[]; // Preferred relays from the geocache event
  sourceRelay?: string; // The relay this event was fetched from
  client?: string; // The client that created this event
  verificationPubkey?: string; // Public key for verification
  hidden?: boolean; // Whether the cache is hidden from public listings
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
  location: {
    lat: number;
    lng: number;
  };
  difficulty: number;
  terrain: number;
  size: string;
  type: string;
  images?: string[];
  hidden?: boolean;
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