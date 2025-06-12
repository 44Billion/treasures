/**
 * Offline-aware map component that works without internet connection
 */

import { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import { LatLngBounds } from 'leaflet';
import { Badge } from '@/shared/components/ui/badge';
import { Download, WifiOff } from 'lucide-react';
import { useOfflineMode, useOfflineGeocaches, useOfflineSettings } from '@/features/offline/hooks/useOfflineStorage';
import { useToast } from '@/shared/hooks/useToast';
import { CACHE_NAMES } from '@/shared/config';
import { getCacheEntryCount, clearCache, cacheMapTile } from '@/shared/utils/cacheUtils';
import 'leaflet/dist/leaflet.css';

interface OfflineMapProps {
  center?: [number, number];
  zoom?: number;
  className?: string;
  onLocationSelect?: (lat: number, lng: number) => void;
  showGeocaches?: boolean;
  height?: string;
}

// Component to handle automatic offline tile caching
function AutoOfflineTileManager() {
  const map = useMap();
  const { isOnline, isOfflineMode } = useOfflineMode();
  const { settings } = useOfflineSettings();
  const [cachedTiles, setCachedTiles] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);
  const { toast } = useToast();

  const autoCacheMaps = settings.autoCacheMaps as boolean ?? true;

  const downloadTilesForBounds = async (bounds: LatLngBounds, minZoom: number, maxZoom: number, silent: boolean = false) => {
    if (!isOnline || isOfflineMode) return 0;
    
    setIsDownloading(true);
    let downloadedCount = 0;

    try {
      for (let z = minZoom; z <= maxZoom; z++) {
        const northEast = bounds.getNorthEast();
        const southWest = bounds.getSouthWest();
        
        const minTileX = Math.floor((southWest.lng + 180) / 360 * Math.pow(2, z));
        const maxTileX = Math.floor((northEast.lng + 180) / 360 * Math.pow(2, z));
        const minTileY = Math.floor((1 - Math.log(Math.tan(northEast.lat * Math.PI / 180) + 1 / Math.cos(northEast.lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, z));
        const maxTileY = Math.floor((1 - Math.log(Math.tan(southWest.lat * Math.PI / 180) + 1 / Math.cos(southWest.lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, z));

        // Limit the number of tiles to prevent overwhelming the server
        const totalTiles = (maxTileX - minTileX + 1) * (maxTileY - minTileY + 1);
        if (totalTiles > 50) {
          console.log(`Skipping zoom level ${z} - too many tiles (${totalTiles})`);
          continue;
        }

        for (let x = minTileX; x <= maxTileX; x++) {
          for (let y = minTileY; y <= maxTileY; y++) {
            try {
              const tileUrl = `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
              const success = await cacheMapTile(tileUrl);
              if (success) {
                downloadedCount++;
              }
              
              // Add small delay to avoid overwhelming the server
              await new Promise(resolve => setTimeout(resolve, 100));
            } catch (error) {
              console.warn(`Failed to download tile ${z}/${x}/${y}:`, error);
            }
          }
        }
      }

      setCachedTiles(prev => prev + downloadedCount);
      
      if (!silent && downloadedCount > 0) {
        toast({
          title: 'Map cached for offline use',
          description: `Downloaded ${downloadedCount} tiles automatically.`,
        });
      }
      
      return downloadedCount;
    } catch (error) {
      console.error('Failed to download tiles:', error);
      if (!silent) {
        toast({
          title: 'Auto-cache failed',
          description: 'Failed to cache map tiles automatically.',
          variant: 'destructive',
        });
      }
      return 0;
    } finally {
      setIsDownloading(false);
    }
  };

  // Auto-cache initial map view
  useEffect(() => {
    if (!isOnline || isOfflineMode || !autoCacheMaps) return;

    const cacheInitialView = async () => {
      // Wait a bit for the map to settle
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const bounds = map.getBounds();
      const currentZoom = map.getZoom();
      
      // Cache current view and one zoom level up/down
      await downloadTilesForBounds(
        bounds, 
        Math.max(currentZoom - 1, 8), 
        Math.min(currentZoom + 1, 15),
        true // Silent for initial load
      );
    };

    cacheInitialView();
  }, [map, isOnline, isOfflineMode, autoCacheMaps]);

  // Count cached tiles on mount
  useEffect(() => {
    const countCachedTiles = async () => {
      const count = await getCacheEntryCount(CACHE_NAMES.OSM_TILES);
      setCachedTiles(count);
    };

    countCachedTiles();
  }, []);

  // Show offline status when offline
  if (isOfflineMode || !isOnline || !navigator.onLine) {
    return (
      <div className="absolute top-2 left-2 z-[1000]">
        <div className="bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md px-2 py-1 shadow-sm">
          <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
            <WifiOff className="h-3 w-3" />
            <span>Offline</span>
            <Badge variant="secondary" className="text-xs">
              {cachedTiles} tiles
            </Badge>
          </div>
        </div>
      </div>
    );
  }

  // Show caching status when online
  return (
    <div className="absolute top-2 left-2 z-[1000]">
      {isDownloading && (
        <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-md px-2 py-1 shadow-sm">
          <div className="flex items-center gap-2 text-xs text-blue-700 dark:text-blue-300">
            <Download className="h-3 w-3 animate-pulse" />
            <span>Caching map...</span>
            <Badge variant="secondary" className="text-xs">
              {cachedTiles}
            </Badge>
          </div>
        </div>
      )}
    </div>
  );
}

// Custom tile layer that works offline
function OfflineTileLayer() {
  const { isOnline } = useOfflineMode();

  return (
    <TileLayer
      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      url={isOnline 
        ? "https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        : "https://tile.openstreetmap.org/{z}/{x}/{y}.png" // Same URL, but will be served from cache when offline
      }
      maxZoom={19}
      // Add error handling for offline mode
      errorTileUrl="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
    />
  );
}

// Geocache markers component
function GeocacheMarkers() {
  const { geocaches, isLoading } = useOfflineGeocaches();
  const { isOnline } = useOfflineMode();

  if (isLoading) return null;

  return (
    <>
      {geocaches.map((geocache) => {
        if (!geocache.coordinates) return null;

        const [lat, lng] = geocache.coordinates;
        
        return (
          <Marker key={geocache.id} position={[lat, lng]}>
            <Popup>
              <div className="space-y-2">
                <div className="font-medium">
                  {geocache.event.content.split('\n')[0] || 'Unnamed Cache'}
                </div>
                <div className="flex gap-2 text-xs">
                  <Badge variant="outline">D{geocache.difficulty}</Badge>
                  <Badge variant="outline">T{geocache.terrain}</Badge>
                  <Badge variant="outline">{geocache.type}</Badge>
                </div>
                {!isOnline && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <WifiOff className="h-3 w-3" />
                    Cached offline
                  </div>
                )}
              </div>
            </Popup>
          </Marker>
        );
      })}
    </>
  );
}

export function OfflineMap({
  center = [40.7128, -74.0060], // Default to NYC
  zoom = 13,
  className = '',
  onLocationSelect,
  showGeocaches = true,
  height = '400px',
}: OfflineMapProps) {
  const { isOnline } = useOfflineMode();
  const [selectedPosition, setSelectedPosition] = useState<[number, number] | null>(null);
  const mapRef = useRef<any>(null);

  // Map click handler component
  function MapClickHandler() {
    useMapEvents({
      click: (e) => {
        if (onLocationSelect) {
          const { lat, lng } = e.latlng;
          setSelectedPosition([lat, lng]);
          onLocationSelect(lat, lng);
        }
      },
    });
    return null;
  }

  return (
    <div className={`relative ${className}`} style={{ height }}>
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ height: '100%', width: '100%' }}
        ref={mapRef}
      >
        <OfflineTileLayer />
        <AutoOfflineTileManager />
        <MapClickHandler />
        
        {showGeocaches && <GeocacheMarkers />}
        
        {selectedPosition && (
          <Marker position={selectedPosition}>
            <Popup>
              <div className="text-sm">
                <div className="font-medium">Selected Location</div>
                <div className="text-muted-foreground">
                  {selectedPosition[0].toFixed(6)}, {selectedPosition[1].toFixed(6)}
                </div>
              </div>
            </Popup>
          </Marker>
        )}
      </MapContainer>

      {/* Offline status overlay */}
      {!isOnline && (
        <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 z-[1000]">
          <div className="bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md px-2 py-1 shadow-sm">
            <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
              <WifiOff className="h-3 w-3" />
              <span>Cached map</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Hook for managing offline map data
export function useOfflineMapData() {
  const { isOnline } = useOfflineMode();
  const [cachedAreas, setCachedAreas] = useState<Array<{
    bounds: LatLngBounds;
    zoomLevels: number[];
    downloadDate: Date;
  }>>([]);

  const downloadAreaForOffline = async (
    bounds: LatLngBounds,
    minZoom: number = 10,
    maxZoom: number = 16
  ) => {
    if (!isOnline) {
      throw new Error('Cannot download map data while offline');
    }

    // Implementation would download and cache map tiles for the specified area
    // This is a placeholder for the actual implementation
    console.log('Downloading map data for area:', bounds, 'zoom levels:', minZoom, 'to', maxZoom);
  };

  const getCachedAreas = async () => {
    return await getCacheEntryCount(CACHE_NAMES.OSM_TILES);
  };

  const clearCachedMapData = async () => {
    const success = await clearCache(CACHE_NAMES.OSM_TILES);
    if (success) {
      setCachedAreas([]);
    }
  };

  return {
    cachedAreas,
    downloadAreaForOffline,
    getCachedAreas,
    clearCachedMapData,
    isOnline,
  };
}