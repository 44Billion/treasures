import type { Geocache } from './geocache';

export type AdventureTheme = 'adventure';
export type AdventureMapStyle = 'original' | 'dark' | 'satellite' | 'adventure';

export interface Adventure {
  id: string;
  pubkey: string;
  created_at: number;
  dTag: string;
  naddr: string;
  title: string;
  description: string;
  summary?: string;
  image?: string;
  location?: {
    lat: number;
    lng: number;
  };
  theme?: AdventureTheme;
  mapStyle?: AdventureMapStyle;
  geocacheRefs: string[]; // Array of "a" tag values: "37516:<pubkey>:<d-tag>"
  geocaches?: Geocache[]; // Resolved geocache objects (populated after fetching)
}

export interface CreateAdventureData {
  title: string;
  description: string;
  summary?: string;
  image?: string;
  location: {
    lat: number;
    lng: number;
  };
  theme?: AdventureTheme;
  mapStyle?: AdventureMapStyle;
  geocacheRefs: string[]; // Array of "a" tag values: "37516:<pubkey>:<d-tag>"
}

export interface UpdateAdventureData extends CreateAdventureData {
  dTag: string;
}
