import React, { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import L from 'leaflet';
import { ArrowLeft, MapPin, Clock, Zap, Filter, List } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { GeocacheMap } from '@/components/GeocacheMap';
import { CompactGeocacheCard } from '@/components/ui/geocache-card';
import { useTreasureMap, useTreasureMapGeocaches } from '../hooks/useTreasureMaps';
// Category info with icons and labels
const CATEGORY_INFO = {
  city: { icon: '🏙️', label: 'City Adventure' },
  park: { icon: '🌳', label: 'Park Expedition' },
  region: { icon: '🗺️', label: 'Regional Quest' },
  trail: { icon: '🥾', label: 'Trail Journey' },
  landmark: { icon: '🏛️', label: 'Landmark Hunt' },
} as const;
import type { Geocache } from '@/features/geocache/types/geocache';

interface TreasureMapViewProps {
  className?: string;
}

export function TreasureMapView({ className }: TreasureMapViewProps) {
  const { mapId } = useParams<{ mapId: string }>();
  const navigate = useNavigate();
  const mapRef = useRef<L.Map | null>(null);
  const [highlightedGeocache, setHighlightedGeocache] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('map');

  const { treasureMap, isLoading: mapLoading } = useTreasureMap(mapId);
  const { geocaches, isLoading: geocachesLoading } = useTreasureMapGeocaches(treasureMap);

  if (mapLoading || !treasureMap) {
    return (
      <div className={className}>
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
          <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-48 bg-gray-200 dark:bg-gray-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const categoryInfo = CATEGORY_INFO[treasureMap.category];

  const handleMarkerClick = (geocache: Geocache) => {
    // Navigate to the cache detail page
    const naddr = geocache.naddr || `${geocache.pubkey}:${geocache.dTag}`;
    navigate(`/${naddr}`);
  };

  const handleCardClick = (geocache: Geocache) => {
    // Center map on the geocache and highlight it
    setHighlightedGeocache(geocache.dTag);
    setActiveTab('map');

    // Use the map controller to center on the geocache
    if (mapRef.current) {
      mapRef.current.setView([geocache.location.lat, geocache.location.lng], 16);
    }
  };

  const handleBack = () => {
    navigate('/treasure-maps');
  };

  // Calculate map bounds from treasure map area
  const getMapBounds = () => {
    if (treasureMap.area.bounds) {
      return {
        northEast: treasureMap.area.bounds.northEast,
        southWest: treasureMap.area.bounds.southWest
      };
    } else if (treasureMap.area.center && treasureMap.area.radius) {
      // Calculate bounds from center and radius (approximate)
      const { center, radius } = treasureMap.area;
      const latDelta = radius / 111; // 1 degree ≈ 111 km
      const lngDelta = radius / (111 * Math.cos(center.lat * Math.PI / 180));

      return {
        northEast: {
          lat: center.lat + latDelta,
          lng: center.lng + lngDelta
        },
        southWest: {
          lat: center.lat - latDelta,
          lng: center.lng - lngDelta
        }
      };
    }
    return null;
  };

  const mapBounds = getMapBounds();

  return (
    <div className={className}>
      {/* Header */}
      <div className="mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleBack}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Maps
        </Button>

        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="flex-1">
            <h1 className="text-3xl font-bold mb-2">{treasureMap.name}</h1>
            {treasureMap.description && (
              <p className="text-muted-foreground mb-4">{treasureMap.description}</p>
            )}

            <div className="flex flex-wrap items-center gap-3">
              {categoryInfo && (
                <Badge variant="outline" className="flex items-center gap-1">
                  {categoryInfo.icon} {categoryInfo.label}
                </Badge>
              )}

              {treasureMap.difficulty && (
                <Badge variant="outline">
                  {treasureMap.difficulty}
                </Badge>
              )}

              {treasureMap.estimatedTime && (
                <Badge variant="outline" className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {treasureMap.estimatedTime}
                </Badge>
              )}

              <Badge variant="secondary" className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {geocaches.length} caches
              </Badge>
            </div>
          </div>

          <Button className="shrink-0">
            <Zap className="h-4 w-4 mr-2" />
            Start Adventure
          </Button>
        </div>
      </div>

      {/* Map and Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Map Section - Takes 2 columns on desktop */}
        <div className="lg:col-span-2">
          <Card className="h-[600px]">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Treasure Map
                <Badge variant="outline" className="ml-auto">Adventure Mode</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 h-[calc(100%-73px)]">
              <div className="h-full w-full rounded-b-lg overflow-hidden">
                <GeocacheMap
                  geocaches={geocaches}
                  center={treasureMap.area.center || undefined}
                  zoom={12}
                  onMarkerClick={handleMarkerClick}
                  highlightedGeocache={highlightedGeocache || undefined}
                  showStyleSelector={false} // Hide style selector for treasure maps
                  mapRef={mapRef}
                  forceTheme="adventure" // Force adventure theme for treasure maps
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Geocache List Section - Takes 1 column on desktop */}
        <div className="lg:col-span-1">
          <Card className="h-[600px] flex flex-col">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <List className="h-5 w-5" />
                Treasures ({geocaches.length})
              </CardTitle>
              <CardDescription>
                Geocaches in this treasure map area
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 p-0 overflow-hidden">
              <div className="h-full overflow-y-auto p-4 space-y-3">
                {geocachesLoading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="animate-pulse">
                        <div className="bg-gray-200 dark:bg-gray-700 rounded-lg p-3 h-24"></div>
                      </div>
                    ))}
                  </div>
                ) : geocaches.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="text-4xl mb-4">🗺️</div>
                    <h3 className="font-semibold mb-2">No treasures found</h3>
                    <p className="text-sm text-muted-foreground">
                      This area doesn't have any geocaches yet. Be the first to explore!
                    </p>
                  </div>
                ) : (
                  geocaches.map((geocache) => (
                    <CompactGeocacheCard
                      key={geocache.id}
                      cache={geocache}
                      onClick={() => handleCardClick(geocache)}
                      statsLoading={false}
                    />
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Additional Info */}
      {treasureMap.filters && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Adventure Filters
            </CardTitle>
            <CardDescription>
              This treasure map includes geocaches with these characteristics
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {treasureMap.filters.difficulty && (
                <div>
                  <p className="text-sm font-medium mb-1">Difficulty</p>
                  <p className="text-sm text-muted-foreground">
                    {treasureMap.filters.difficulty.min} - {treasureMap.filters.difficulty.max}
                  </p>
                </div>
              )}
              {treasureMap.filters.terrain && (
                <div>
                  <p className="text-sm font-medium mb-1">Terrain</p>
                  <p className="text-sm text-muted-foreground">
                    {treasureMap.filters.terrain.min} - {treasureMap.filters.terrain.max}
                  </p>
                </div>
              )}
              {treasureMap.filters.types && (
                <div>
                  <p className="text-sm font-medium mb-1">Types</p>
                  <div className="flex flex-wrap gap-1">
                    {treasureMap.filters.types.map((type) => (
                      <Badge key={type} variant="outline" className="text-xs">
                        {type}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {treasureMap.filters.sizes && (
                <div>
                  <p className="text-sm font-medium mb-1">Sizes</p>
                  <div className="flex flex-wrap gap-1">
                    {treasureMap.filters.sizes.map((size) => (
                      <Badge key={size} variant="outline" className="text-xs">
                        {size}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}