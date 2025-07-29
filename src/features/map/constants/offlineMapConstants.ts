// Constants for offline map functionality

// Map tile URLs and configurations
export const OFFLINE_MAP_CONFIG = {
  maxZoom: 19,
  tileUrl: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  errorTileUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
};

// Tile download limits
export const TILE_DOWNLOAD_LIMITS = {
  maxTilesPerLevel: 50,
  maxZoomLevel: 15,
  minZoomLevel: 8,
  downloadDelay: 100, // ms between tile downloads
};

// Default map settings
export const DEFAULT_MAP_SETTINGS = {
  center: [40.7128, -74.0060] as [number, number], // NYC
  zoom: 13,
  height: '400px'
};