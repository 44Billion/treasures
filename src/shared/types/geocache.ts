/**
 * Geocache-specific type definitions
 */

import type { Coordinates, EntityId, Timestamp } from './common';

/** Geocache difficulty levels (1-5) */
export type GeocacheDifficulty = 1 | 2 | 3 | 4 | 5;

/** Geocache terrain levels (1-5) */
export type GeocacheTerrain = 1 | 2 | 3 | 4 | 5;

/** Geocache size categories */
export type GeocacheSize = 'micro' | 'small' | 'regular' | 'large' | 'other';

/** Geocache status */
export type GeocacheStatus = 'active' | 'disabled' | 'archived' | 'locked';

/** Geocache type */
export type GeocacheType = 'traditional' | 'multi' | 'mystery' | 'letterbox' | 'event' | 'virtual' | 'webcam' | 'earthcache' | 'wherigo';

/** Log type for geocache logs */
export type LogType = 'found' | 'not_found' | 'note' | 'maintenance' | 'owner_maintenance' | 'needs_maintenance' | 'archive' | 'unarchive' | 'enable' | 'disable';

/** Geocache coordinates with optional precision */
export interface GeocacheCoordinates extends Coordinates {
  /** Coordinate precision in meters (for puzzle caches) */
  precision?: number;
  /** Whether coordinates are the final location */
  isFinal?: boolean;
}

/** Geocache waypoint */
export interface GeocacheWaypoint {
  id: string;
  name: string;
  description?: string;
  coordinates: GeocacheCoordinates;
  type: 'parking' | 'trailhead' | 'stage' | 'final' | 'reference' | 'question';
  symbol?: string;
}

/** Geocache attributes */
export interface GeocacheAttributes {
  /** Available 24/7 */
  available24_7?: boolean;
  /** Requires special equipment */
  specialEquipment?: boolean;
  /** Wheelchair accessible */
  wheelchairAccessible?: boolean;
  /** Dog friendly */
  dogFriendly?: boolean;
  /** Parking available */
  parkingAvailable?: boolean;
  /** Public transportation nearby */
  publicTransport?: boolean;
  /** Drinking water nearby */
  drinkingWater?: boolean;
  /** Restrooms nearby */
  restrooms?: boolean;
  /** Suitable for kids */
  kidFriendly?: boolean;
  /** Requires hiking */
  hiking?: boolean;
  /** Requires climbing */
  climbing?: boolean;
  /** Requires swimming */
  swimming?: boolean;
  /** May be dangerous */
  dangerous?: boolean;
  /** Requires flashlight */
  flashlight?: boolean;
  /** Scenic view */
  scenicView?: boolean;
  /** Historical significance */
  historical?: boolean;
  /** Stealth required */
  stealth?: boolean;
  /** Night cache */
  night?: boolean;
  /** Winter friendly */
  winter?: boolean;
  /** Poisonous plants */
  poisonousPlants?: boolean;
  /** Ticks */
  ticks?: boolean;
  /** Hunting area */
  hunting?: boolean;
  /** Thorns */
  thorns?: boolean;
  /** Requires boat */
  boat?: boolean;
  /** Requires scuba gear */
  scuba?: boolean;
  /** May require wading */
  wading?: boolean;
  /** Seasonal access */
  seasonal?: boolean;
  /** Requires fee */
  fee?: boolean;
  /** Requires permit */
  permit?: boolean;
  /** Rappelling required */
  rappelling?: boolean;
  /** Requires special tools */
  specialTools?: boolean;
  /** UV light required */
  uvLight?: boolean;
  /** Snowshoes required */
  snowshoes?: boolean;
  /** Cross country skis required */
  skiis?: boolean;
  /** S-tool required */
  stool?: boolean;
  /** Magnetic */
  magnetic?: boolean;
  /** In water */
  inWater?: boolean;
  /** Tide required */
  tide?: boolean;
  /** All weather */
  allWeather?: boolean;
  /** May require tree climbing */
  treeClimbing?: boolean;
  /** Front yard */
  frontYard?: boolean;
  /** Teamwork required */
  teamwork?: boolean;
  /** Partnership cache */
  partnership?: boolean;
  /** Seasonal hours */
  seasonalHours?: boolean;
  /** Tourist friendly */
  touristFriendly?: boolean;
  /** Requires reservation */
  reservation?: boolean;
  /** Parking fee */
  parkingFee?: boolean;
  /** Public restrooms */
  publicRestrooms?: boolean;
  /** Picnic tables */
  picnicTables?: boolean;
  /** Camping available */
  camping?: boolean;
  /** Bicycles allowed */
  bicycles?: boolean;
  /** Motorcycles allowed */
  motorcycles?: boolean;
  /** Quads allowed */
  quads?: boolean;
  /** Off-road vehicles allowed */
  offRoadVehicles?: boolean;
  /** Snowmobiles allowed */
  snowmobiles?: boolean;
  /** Horses allowed */
  horses?: boolean;
  /** Campfires allowed */
  campfires?: boolean;
  /** RVs allowed */
  rvs?: boolean;
  /** May require maintenance */
  maintenance?: boolean;
  /** Watch for livestock */
  livestock?: boolean;
  /** Field puzzle */
  fieldPuzzle?: boolean;
  /** UV required */
  uvRequired?: boolean;
  /** Snowshoes recommended */
  snowshoesRecommended?: boolean;
  /** May require cross country skis */
  skiisRecommended?: boolean;
  /** May require special equipment */
  specialEquipmentRecommended?: boolean;
  /** May require wading/swimming */
  waterRequired?: boolean;
  /** Recommended for tourists */
  recommendedForTourists?: boolean;
  /** May require tree climbing */
  treeClimbingRecommended?: boolean;
  /** May require front yard access */
  frontYardRecommended?: boolean;
  /** Teamwork recommended */
  teamworkRecommended?: boolean;
  /** May require partnership */
  partnershipRecommended?: boolean;
  /** May have seasonal access only */
  seasonalAccessOnly?: boolean;
  /** Tourist cache */
  touristCache?: boolean;
  /** May require reservation/permission */
  reservationRecommended?: boolean;
  /** May require parking fee */
  parkingFeeRequired?: boolean;
  /** Public restrooms available */
  publicRestroomsAvailable?: boolean;
  /** Picnic tables available */
  picnicTablesAvailable?: boolean;
  /** Camping available nearby */
  campingAvailableNearby?: boolean;
  /** Bicycles recommended */
  bicyclesRecommended?: boolean;
  /** Motorcycles recommended */
  motorcyclesRecommended?: boolean;
  /** Quads recommended */
  quadsRecommended?: boolean;
  /** Off-road vehicles recommended */
  offRoadVehiclesRecommended?: boolean;
  /** Snowmobiles recommended */
  snowmobilesRecommended?: boolean;
  /** Horses recommended */
  horsesRecommended?: boolean;
  /** Campfires available */
  campfiresAvailable?: boolean;
  /** RVs recommended */
  rvsRecommended?: boolean;
  /** May require maintenance */
  maintenanceRequired?: boolean;
  /** Watch for livestock */
  livestockPresent?: boolean;
  /** Field puzzle present */
  fieldPuzzlePresent?: boolean;
}

/** Geocache inventory item */
export interface GeocacheInventoryItem {
  id: string;
  name: string;
  description?: string;
  trackingNumber?: string;
  imageUrl?: string;
}

/** Geocache hint */
export interface GeocacheHint {
  text: string;
  encrypted?: boolean;
  images?: string[];
}

/** Main geocache interface - matches existing structure */
export interface Geocache {
  /** Unique identifier (Nostr event ID) */
  id: string;
  /** Cache owner public key */
  pubkey: string;
  /** Cache creation timestamp (Unix timestamp) */
  created_at: number;
  /** Store the d-tag for proper replacement */
  dTag: string;
  /** The naddr of the geocache */
  naddr?: string;
  /** Original event kind (37515 for legacy, 37516 for new) */
  kind?: number;
  /** Cache name/title */
  name: string;
  /** Cache description */
  description: string;
  /** Cache hint */
  hint?: string;
  /** Cache coordinates */
  location: {
    lat: number;
    lng: number;
  };
  /** Cache difficulty (1-5) */
  difficulty: number;
  /** Cache terrain (1-5) */
  terrain: number;
  /** Cache size */
  size: "micro" | "small" | "regular" | "large" | "other";
  /** Cache type */
  type: "traditional" | "multi" | "mystery";
  /** Cache images */
  images?: string[];
  /** Number of finds */
  foundCount?: number;
  /** Number of logs */
  logCount?: number;
  /** Total zap amount in sats */
  zapTotal?: number;
  /** Preferred relays from the geocache event */
  relays?: string[];
  /** The relay this event was fetched from */
  sourceRelay?: string;
  /** The client that created this event */
  client?: string;
  /** Public key for verification */
  verificationPubkey?: string;
  /** Whether the cache is hidden from public listings */
  hidden?: boolean;
  /** Additional metadata from OSM verification */
  accessibility?: {
    wheelchair?: boolean;
    parking?: boolean;
    publicTransport?: boolean;
    fee?: boolean;
    openingHours?: string;
  };
  /** Terrain information */
  terrainInfo?: {
    surface?: string;
    hazards?: string[];
    lit?: boolean;
    covered?: boolean;
  };
  /** Restrictions */
  restrictions?: string[];
  /** Environmental information */
  environmental?: {
    nesting?: boolean;
    protected?: string;
    leaveNoTrace?: boolean;
  };
  /** Safety information */
  safety?: {
    surveillance?: boolean;
    cellCoverage?: boolean;
    lighting?: string;
  };
}

/** Geocache log entry - matches existing structure */
export interface GeocacheLog {
  /** Unique identifier (Nostr event ID) */
  id: string;
  /** Logger public key */
  pubkey: string;
  /** Log creation timestamp (Unix timestamp) */
  created_at: number;
  /** Geocache ID this log belongs to */
  geocacheId: string;
  /** Log type */
  type: "found" | "dnf" | "note" | "maintenance" | "archived";
  /** Log text content */
  text: string;
  /** Log images */
  images?: string[];
  /** The relay this event was fetched from */
  sourceRelay?: string;
  /** The client that created this event */
  client?: string;
  /** Relay tags from the event */
  relays?: string[];
  /** Whether this log has a valid embedded verification event */
  isVerified?: boolean;
}

/** Geocache search filters */
export interface GeocacheSearchFilters {
  /** Search by name/description */
  query?: string;
  /** Filter by difficulty range */
  difficulty?: {
    min?: GeocacheDifficulty;
    max?: GeocacheDifficulty;
  };
  /** Filter by terrain range */
  terrain?: {
    min?: GeocacheTerrain;
    max?: GeocacheTerrain;
  };
  /** Filter by size */
  size?: GeocacheSize[];
  /** Filter by type */
  type?: GeocacheType[];
  /** Filter by status */
  status?: GeocacheStatus[];
  /** Filter by attributes */
  attributes?: Partial<GeocacheAttributes>;
  /** Filter by distance from coordinates */
  location?: {
    coordinates: Coordinates;
    radius: number; // in kilometers
  };
  /** Filter by owner */
  owner?: string; // pubkey
  /** Filter by placement date range */
  placedDate?: {
    from?: Timestamp;
    to?: Timestamp;
  };
  /** Filter by last activity date range */
  lastActivity?: {
    from?: Timestamp;
    to?: Timestamp;
  };
  /** Filter by find count range */
  findCount?: {
    min?: number;
    max?: number;
  };
  /** Filter by favorite count range */
  favoriteCount?: {
    min?: number;
    max?: number;
  };
  /** Filter by tags */
  tags?: string[];
  /** Filter by country */
  country?: string;
  /** Filter by state/region */
  state?: string;
  /** Filter by locality */
  locality?: string;
  /** Only show caches with verification */
  verifiedOnly?: boolean;
  /** Only show caches found by user */
  foundByUser?: string; // pubkey
  /** Only show caches not found by user */
  notFoundByUser?: string; // pubkey
  /** Only show caches owned by user */
  ownedByUser?: string; // pubkey
  /** Only show caches with recent activity */
  recentActivity?: boolean;
  /** Only show premium caches */
  premiumOnly?: boolean;
}

/** Geocache search sort options */
export interface GeocacheSearchSort {
  field: 'name' | 'difficulty' | 'terrain' | 'size' | 'type' | 'distance' | 'placedDate' | 'lastActivity' | 'findCount' | 'favoriteCount';
  direction: 'asc' | 'desc';
}

/** Geocache search result */
export interface GeocacheSearchResult {
  geocaches: Geocache[];
  total: number;
  hasMore: boolean;
  nextCursor?: string;
}

/** Geocache statistics */
export interface GeocacheStats {
  totalCaches: number;
  activeCaches: number;
  archivedCaches: number;
  totalFinds: number;
  totalDNFs: number;
  totalLogs: number;
  averageDifficulty: number;
  averageTerrain: number;
  cachesByType: Record<GeocacheType, number>;
  cachesBySize: Record<GeocacheSize, number>;
  cachesByDifficulty: Record<GeocacheDifficulty, number>;
  cachesByTerrain: Record<GeocacheTerrain, number>;
  topOwners: Array<{
    pubkey: string;
    count: number;
  }>;
  topFinders: Array<{
    pubkey: string;
    count: number;
  }>;
  recentActivity: Array<{
    type: 'cache_created' | 'cache_found' | 'cache_logged';
    timestamp: Timestamp;
    geocacheId: EntityId;
    userPubkey: string;
  }>;
}

/** Geocache creation form data */
export interface GeocacheFormData {
  name: string;
  description: string;
  coordinates: GeocacheCoordinates;
  waypoints?: Omit<GeocacheWaypoint, 'id'>[];
  difficulty: GeocacheDifficulty;
  terrain: GeocacheTerrain;
  size: GeocacheSize;
  type: GeocacheType;
  attributes?: GeocacheAttributes;
  hint?: Omit<GeocacheHint, 'encrypted'>;
  inventory?: Omit<GeocacheInventoryItem, 'id'>[];
  images?: File[];
  tags?: string[];
  requiresVerification?: boolean;
  placedAt?: Timestamp;
}

/** Geocache log form data */
export interface GeocacheLogFormData {
  type: LogType;
  text: string;
  images?: File[];
  coordinates?: GeocacheCoordinates;
  verificationProof?: string;
  tags?: string[];
}

/** Geocache import/export format */
export interface GeocacheExport {
  version: string;
  exportDate: Timestamp;
  geocaches: Geocache[];
  logs: GeocacheLog[];
  metadata: {
    totalCaches: number;
    totalLogs: number;
    exportedBy: string;
    format: 'nostr-geocaching';
  };
}

/** Geocache validation result */
export interface GeocacheValidationResult {
  isValid: boolean;
  errors: Array<{
    field: string;
    message: string;
    code: string;
  }>;
  warnings: Array<{
    field: string;
    message: string;
    code: string;
  }>;
}

/** Geocache proximity search result */
export interface GeocacheProximityResult extends Geocache {
  /** Distance from search coordinates in kilometers */
  distance: number;
  /** Bearing from search coordinates in degrees */
  bearing: number;
}