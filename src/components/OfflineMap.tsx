/**
 * Offline-aware map component that works without internet connection
 */

import { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import { LatLngBounds, LatLng } from 'leaflet';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Download, MapPin, Wifi, WifiOff } from 'lucide-react';
import { useOfflineMode, useOfflineGeocaches } from '@/hooks/useOfflineStorage';
import { useToast } from '@/hooks/useToast';
import { CACHE_NAMES } from '@/lib/cacheConstants';
import { getCacheEntryCount, clearCache, cacheMapTile } from '@/lib/cacheUtils';
import 'leaflet/dist/leaflet.css';

interface OfflineMapProps {
  center?: [number, number];
  zoom?: number;
  className?: string;
  onLocationSelect?: (lat: number, lng: number) => void;
  showGeocaches?: boolean;
  height?: string;
}

// Component to handle offline tile caching
function OfflineTileManager() {
  const map = useMap();
  const { isOnline } = useOfflineMode();
  const [cachedTiles, setCachedTiles] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);
  const { toast } = useToast();

  const downloadTilesForBounds = async (bounds: LatLngBounds, minZoom: number, maxZoom: number) => {
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

        for (let x = minTileX; x <= maxTileX; x++) {
          for (let y = minTileY; y <= maxTileY; y++) {
            try {
              const tileUrl = `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
              const success = await cacheMapTile(tileUrl);
              if (success) {
                downloadedCount++;
              }
            } catch (error) {
              console.warn(`Failed to download tile ${z}/${x}/${y}:`, error);
            }
          }
        }
      }

      setCachedTiles(prev => prev + downloadedCount);
      toast({
        title: 'Map tiles downloaded',
        description: `Downloaded ${downloadedCount} tiles for offline use.`,
      });
    } catch (error) {
      console.error('Failed to download tiles:', error);
      toast({
        title: 'Download failed',
        description: 'Failed to download map tiles for offline use.',
        variant: 'destructive',
      });
    } finally {
      setIsDownloading(false);
    }
  };

  const downloadCurrentView = () => {
    const bounds = map.getBounds();
    const currentZoom = map.getZoom();
    downloadTilesForBounds(bounds, Math.max(currentZoom - 1, 1), Math.min(currentZoom + 2, 18));
  };

  // Count cached tiles on mount
  useEffect(() => {
    const countCachedTiles = async () => {
      const count = await getCacheEntryCount(CACHE_NAMES.OSM_TILES);
      setCachedTiles(count);
    };

    countCachedTiles();
  }, []);

  if (!isOnline) {
    return (
      <div className="absolute top-2 left-2 z-[1000]">
        <Card className="bg-yellow-50 border-yellow-200">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 text-sm">
              <WifiOff className="h-4 w-4 text-yellow-600" />
              <span className="text-yellow-800">Offline mode</span>
              <Badge variant="secondary" className="text-xs">
                {cachedTiles} tiles cached
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="absolute top-2 left-2 z-[1000]">
      <Card className="bg-white/90 backdrop-blur-sm">
        <CardContent className="p-3">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={downloadCurrentView}
              disabled={isDownloading}
              className="text-xs"
            >
              {isDownloading ? (
                <>
                  <Download className="h-3 w-3 mr-1 animate-pulse" />
                  Downloading...
                </>
              ) : (
                <>
                  <Download className="h-3 w-3 mr-1" />
                  Cache Area
                </>
              )}
            </Button>
            <Badge variant="secondary" className="text-xs">
              {cachedTiles} cached
            </Badge>
          </div>
        </CardContent>
      </Card>
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
        <OfflineTileManager />
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
        <div className="absolute bottom-2 right-2 z-[1000]">
          <Card className="bg-yellow-50 border-yellow-200">
            <CardContent className="p-2">
              <div className="flex items-center gap-2 text-xs text-yellow-800">
                <WifiOff className="h-3 w-3" />
                Using cached map data
              </div>
            </CardContent>
          </Card>
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