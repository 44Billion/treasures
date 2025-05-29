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
  type: "traditional" | "multi" | "mystery" | "earth";
  images?: string[];
  foundCount?: number;
  logCount?: number;
}

export interface GeocacheLog {
  id: string;
  pubkey: string;
  created_at: number;
  geocacheId: string;
  type: "found" | "dnf" | "note";
  text: string;
  images?: string[];
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
  type: "found" | "dnf" | "note";
  text: string;
  images?: string[];
}