export interface TreasureMap {
  id: string;
  naddr?: string; // NIP-19 address
  pubkey: string; // Creator's pubkey
  created_at: number;
  kind: number; // Event kind
  dTag: string; // Identifier for replaceable events
  name: string;
  description?: string;
  // Define the map area - can be either center+radius or bounds
  area: {
    // Center point and radius approach
    center?: {
      lat: number;
      lng: number;
    };
    radius?: number; // in kilometers

    // Or bounding box approach
    bounds?: {
      northEast: {
        lat: number;
        lng: number;
      };
      southWest: {
        lat: number;
        lng: number;
      };
    };
  };
  // Theme is always adventure for treasure maps
  theme: 'adventure';
  // Optional: filters to apply to geocaches in this area
  filters?: {
    difficulty?: {
      min?: number;
      max?: number;
    };
    terrain?: {
      min?: number;
      max?: number;
    };
    types?: string[];
    sizes?: string[];
  };
  // Metadata
  image?: string; // URL to a map image or illustration
  estimatedTime?: string; // e.g., "2-3 hours"
  difficulty?: string; // e.g., "Easy", "Moderate", "Challenging"
  category: 'city' | 'park' | 'region' | 'trail' | 'landmark';
  relays?: string[]; // Preferred relays
  client?: string; // Client that created this event
}

export interface CreateTreasureMapData {
  name: string;
  description?: string;
  area: {
    center?: {
      lat: number;
      lng: number;
    };
    radius?: number;
    bounds?: {
      northEast: {
        lat: number;
        lng: number;
      };
      southWest: {
        lat: number;
        lng: number;
      };
    };
  };
  filters?: {
    difficulty?: {
      min?: number;
      max?: number;
    };
    terrain?: {
      min?: number;
      max?: number;
    };
    types?: string[];
    sizes?: string[];
  };
  image?: string;
  estimatedTime?: string;
  difficulty?: string;
  category: 'city' | 'park' | 'region' | 'trail' | 'landmark';
  dTag?: string; // Optional pre-generated dTag
}

// Treasure map event kind
export const TREASURE_MAP_KIND = 37520; // Kind for treasure map events