export interface Geocache {
  id: string;
  pubkey: string;
  created_at: number;
  dTag: string; // Store the d-tag for proper replacement
  name: string;
  description: string;
  hint?: string;
  location: {
    lat: number;
    lng: number;
  };
  difficulty: number; // 1-5
  terrain: number; // 1-5
  size: "micro" | "small" | "regular" | "large";
  type: "traditional" | "multi" | "mystery" | "earth" | "virtual" | "letterbox" | "event";
  images?: string[];
  foundCount?: number;
  logCount?: number;
  relays?: string[]; // Preferred relays from the geocache event
  sourceRelay?: string; // The relay this event was fetched from
  client?: string; // The client that created this event
}

export interface GeocacheLog {
  id: string;
  pubkey: string;
  created_at: number;
  geocacheId: string;
  type: "found" | "dnf" | "note" | "maintenance" | "disabled" | "enabled" | "archived";
  text: string;
  images?: string[];
  sourceRelay?: string; // The relay this event was fetched from
  client?: string; // The client that created this event
  relays?: string[]; // Relay tags from the event
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
}

export interface CreateLogData {
  geocacheId: string;
  geocacheDTag?: string; // For linking to stable d-tag
  geocachePubkey?: string; // Pubkey of the cache owner
  relayUrl?: string; // Optional relay URL where the cache can be found
  preferredRelays?: string[]; // Preferred relays from the geocache for publishing logs
  type: "found" | "dnf" | "note" | "maintenance" | "disabled" | "enabled" | "archived";
  text: string;
  images?: string[];
  location?: { lat: number; lng: number }; // Optional user location for the log
}