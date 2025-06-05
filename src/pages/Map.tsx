import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { MapPin, Navigation, Filter, X, Locate, Compass, RefreshCw, Sparkles } from "lucide-react";
import L from "leaflet";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { DesktopHeader } from "@/components/DesktopHeader";
import { LoginArea } from "@/components/auth/LoginArea";
import { useAdaptiveGeocaches, type GeocacheWithDistance } from "@/hooks/useProximityGeocaches";
import { useMapPageGeocaches } from "@/hooks/useOptimisticGeocaches";
import { useGeolocation } from "@/hooks/useGeolocation";
import { GeocacheMap } from "@/components/GeocacheMap";
import { DetailedGeocacheCard, CompactGeocacheCard } from "@/components/ui/geocache-card";
import { GeocacheDialog } from "@/components/GeocacheDialog";
import { LocationSearch } from "@/components/LocationSearch";
import { MapViewTabs } from "@/components/ui/mobile-button-patterns";
import { ComparisonFilter, type ComparisonOperator } from "@/components/ui/comparison-filter";
import { FilterButton } from "@/components/FilterButton";
import { DIFFICULTY_TERRAIN_OPTIONS } from "@/lib/geocache-constants";
import type { Geocache } from "@/types/geocache";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDistance } from "@/lib/geo";
import { Badge } from "@/components/ui/badge";
import { MapSidebarSkeleton, SmartLoadingState } from "@/components/ui/skeleton-patterns";
import { QUERY_LIMITS } from "@/lib/constants";
import { useNavigate } from "react-router-dom";

export default function Map() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [difficulty, setDifficulty] = useState<number | undefined>(undefined);
  const [difficultyOperator, setDifficultyOperator] = useState<ComparisonOperator>("all");
  const [terrain, setTerrain] = useState<number | undefined>(undefined);
  const [terrainOperator, setTerrainOperator] = useState<ComparisonOperator>("all");
  const [cacheType, setCacheType] = useState<string | undefined>(undefined);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [mapZoom, setMapZoom] = useState(10);
  const [showNearMe, setShowNearMe] = useState(false);
  const [searchLocation, setSearchLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [searchRadius, setSearchRadius] = useState(25); // km
  const [mapUpdateKey, setMapUpdateKey] = useState(0);
  const [selectedGeocache, setSelectedGeocache] = useState<Geocache | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [highlightedGeocache, setHighlightedGeocache] = useState<string | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  
  const { loading: isGettingLocation, coords, getLocation } = useGeolocation();
  
  // Use optimistic loading for base geocaches
  const optimisticGeocaches = useMapPageGeocaches();

  const { data: geocaches, isLoading, error, refetch } = useAdaptiveGeocaches({
    search: searchQuery,
    difficulty,
    difficultyOperator,
    terrain,
    terrainOperator,
    cacheType,
    userLocation,
    searchLocation,
    searchRadius,
    showNearMe,
  });



  useEffect(() => {
    // Update user location when coords change
    if (coords) {
      const location = {
        lat: coords.latitude,
        lng: coords.longitude,
      };
      setUserLocation(location);
      
      // If Near Me is active, update the map center only once when location is first obtained
      if (showNearMe && !userLocation) {
        setMapCenter(location);
        setMapZoom(13);
      }
    }
  }, [coords, showNearMe, userLocation]);

  // Remove automatic location request - only get location when user clicks "Near Me"

  // Filter and sort geocaches based on location
  // Note: Proximity filtering and distance calculation is now handled by useAdaptiveGeocaches
  const filteredGeocaches: GeocacheWithDistance[] = geocaches || [];

  // Check if proximity search is active
  const isProximitySearchActive = !!(searchLocation || (showNearMe && userLocation));
  const proximityCenter = searchLocation || (showNearMe ? userLocation : null);

  const handleLocationSelect = (location: { lat: number; lng: number; name: string }) => {
    // Update all location-related state
    const newCenter = { lat: location.lat, lng: location.lng };
    setMapCenter(newCenter);
    setMapZoom(12); // Slightly more zoomed in for city searches
    setShowNearMe(false);
    setSearchLocation(newCenter);
    setHighlightedGeocache(null); // Clear any highlighted geocache
    setMapUpdateKey(prev => prev + 1); // Force map update
  };

  const handleNearMe = () => {
    setShowNearMe(true);
    setSearchLocation(null); // Clear search location
    setHighlightedGeocache(null); // Clear any highlighted geocache
    getLocation();
  };

  const handleMarkerClick = (geocache: Geocache) => {
    setSelectedGeocache(geocache);
    setDialogOpen(true);
  };

  const handleCardClick = (geocache: Geocache) => {
    // On desktop, snap to the location on the map and highlight it
    setMapCenter({ lat: geocache.location.lat, lng: geocache.location.lng });
    setMapZoom(16); // Zoom in closer for better detail
    setHighlightedGeocache(geocache.dTag); // Highlight this geocache
    setMapUpdateKey(prev => prev + 1); // Force map update
  };

  return (
    <div className="bg-background md:h-mobile-map md:h-screen flex flex-col">
      <DesktopHeader variant="map" />

      <div className="hidden lg:flex flex-1">
        {/* Adventure Sidebar */}
        <div className="w-96 border-r bg-background/95 backdrop-blur-sm overflow-hidden flex flex-col">
          {/* Adventure Search and Filters */}
          <div className="p-4 border-b bg-muted/50">
            <div className="space-y-4">
              <div className="flex gap-2">
                <div className="flex-1">
                  <Label htmlFor="search">Search Caches</Label>
                  <Input
                    id="search"
                    placeholder="Search by name or description..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <div className="flex items-end">
                  <FilterButton
                    difficulty={difficulty}
                    difficultyOperator={difficultyOperator}
                    onDifficultyChange={setDifficulty}
                    onDifficultyOperatorChange={setDifficultyOperator}
                    terrain={terrain}
                    terrainOperator={terrainOperator}
                    onTerrainChange={setTerrain}
                    onTerrainOperatorChange={setTerrainOperator}
                    cacheType={cacheType}
                    onCacheTypeChange={setCacheType}
                  />
                </div>
              </div>

              {/* Location Controls */}
              <div className="space-y-3">
                <div className="relative">
                  <LocationSearch 
                    onLocationSelect={handleLocationSelect}
                    placeholder="Search city or zip..."
                  />
                </div>

                <div className="flex gap-2">
                  <Button 
                    variant={showNearMe ? "default" : "outline"} 
                    className="flex-1 h-8"
                    
                    onClick={handleNearMe}
                    disabled={isGettingLocation}
                  >
                    <Locate className="h-4 w-4 mr-1" />
                    {isGettingLocation ? "Finding..." : "Near Me"}
                  </Button>
                  
                  {(showNearMe || searchLocation) && (
                    <>
                      <Select value={searchRadius.toString()} onValueChange={(v) => setSearchRadius(Number(v) || 25)}>
                        <SelectTrigger className="w-24 h-8" >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">1 km</SelectItem>
                          <SelectItem value="5">5 km</SelectItem>
                          <SelectItem value="10">10 km</SelectItem>
                          <SelectItem value="25">25 km</SelectItem>
                          <SelectItem value="50">50 km</SelectItem>
                          <SelectItem value="100">100 km</SelectItem>
                        </SelectContent>
                      </Select>
                      
                      <Button
                        variant="ghost"
                        
                        className="h-8 w-8 p-0"
                        onClick={() => {
                          setShowNearMe(false);
                          setSearchLocation(null);
                        }}
                        title="Clear location filter"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
              

            </div>
          </div>

          {/* Results */}
          <div className="flex-1 overflow-y-auto">
            <SmartLoadingState
              isLoading={isLoading}
              isError={!!error}
              hasData={filteredGeocaches.length > 0}
              data={filteredGeocaches}
              error={error as Error}
              onRetry={() => {
                optimisticGeocaches.refresh();
                refetch();
              }}
              skeletonCount={QUERY_LIMITS.SKELETON_COUNT}
              skeletonVariant="compact"
              compact={true}
              emptyState={
                <div className="p-4 text-center text-muted-foreground">
                  <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p>No geocaches found</p>
                  <p className="text-sm mt-2">
                    {searchLocation ? 'Try increasing the search radius or searching a different area' : 'Try adjusting your filters'}
                  </p>
                </div>
              }
            >
              <div className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm text-muted-foreground">
                    {filteredGeocaches.length} cache{filteredGeocaches.length !== 1 ? 's' : ''}
                    {isProximitySearchActive && ` • ${searchRadius}km radius`}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => {
                        optimisticGeocaches.refresh();
                        refetch();
                      }}
                      className="h-6 w-6 p-0"
                      title="Refresh geocaches"
                      disabled={isLoading && filteredGeocaches.length === 0}
                    >
                      <RefreshCw className={`h-3 w-3 ${isLoading && filteredGeocaches.length === 0 ? 'animate-spin' : ''}`} />
                    </Button>
                    {isProximitySearchActive && (
                      <Badge variant="secondary" className="text-xs flex items-center gap-1">
                        <Sparkles className="h-3 w-3" />
                        Smart Search
                      </Badge>
                    )}
                    {optimisticGeocaches.isStale && (
                      <Badge variant="outline" className="text-xs flex items-center gap-1">
                        <RefreshCw className="h-2 w-2 animate-spin" />
                        Updating
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="space-y-3">
                  {filteredGeocaches.map((cache) => (
                    <CompactGeocacheCard
                      key={cache.id}
                      cache={cache}
                      distance={cache.distance}
                      onClick={() => handleCardClick(cache)}
                    />
                  ))}
                </div>
              </div>
            </SmartLoadingState>
          </div>
        </div>

        {/* Map */}
        <div className="flex-1 relative bg-background min-h-[600px]" style={{ height: 'calc(100vh - 4rem)' }}>
          <GeocacheMap 
            key={mapUpdateKey}
            geocaches={filteredGeocaches} 
            userLocation={userLocation}
            searchLocation={searchLocation || (showNearMe ? userLocation : null)}
            searchRadius={searchRadius}
            center={mapCenter || undefined}
            zoom={mapZoom}
            onMarkerClick={handleMarkerClick}
            highlightedGeocache={highlightedGeocache || undefined}
            showStyleSelector={true}
            isNearMeActive={showNearMe}
          />
        </div>
      </div>

      {/* Mobile View */}
      <div className="block lg:hidden flex-1 flex flex-col overflow-hidden">
        {/* Adventure Mobile Filters Header */}
        <div className="bg-background/95 backdrop-blur-sm border-b flex-shrink-0">
          <div className="p-3">
            <div className="space-y-3">
              <div className="flex gap-2">
                <Input
                  placeholder="Search caches..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1"
                />
                <FilterButton
                  difficulty={difficulty}
                  difficultyOperator={difficultyOperator}
                  onDifficultyChange={setDifficulty}
                  onDifficultyOperatorChange={setDifficultyOperator}
                  terrain={terrain}
                  terrainOperator={terrainOperator}
                  onTerrainChange={setTerrain}
                  onTerrainOperatorChange={setTerrainOperator}
                  cacheType={cacheType}
                  onCacheTypeChange={setCacheType}
                  compact
                />
              </div>
              
              <div className="space-y-2">
                <LocationSearch 
                  onLocationSelect={handleLocationSelect}
                  placeholder="Search city or zip..."
                />
                
                <div className="flex gap-2">
                  <Button 
                    variant={showNearMe ? "default" : "outline"} 
                    className="flex-1 h-9"
                    
                    onClick={handleNearMe}
                    disabled={isGettingLocation}
                  >
                    <Locate className="h-4 w-4 mr-1" />
                    {isGettingLocation ? "Finding..." : "Near Me"}
                  </Button>
                  
                  {(showNearMe || searchLocation) && (
                    <>
                      <Select value={searchRadius.toString()} onValueChange={(v) => setSearchRadius(Number(v) || 25)}>
                        <SelectTrigger className="w-20 h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">1km</SelectItem>
                          <SelectItem value="5">5km</SelectItem>
                          <SelectItem value="10">10km</SelectItem>
                          <SelectItem value="25">25km</SelectItem>
                          <SelectItem value="50">50km</SelectItem>
                          <SelectItem value="100">100km</SelectItem>
                        </SelectContent>
                      </Select>
                      
                      <Button
                        variant="ghost"
                        
                        className="h-9 w-9 p-0"
                        onClick={() => {
                          setShowNearMe(false);
                          setSearchLocation(null);
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Mobile Content Area */}
        <div className="flex-1 overflow-hidden">
          <MapViewTabs className="h-full flex flex-col">
            <TabsContent value="list" className="flex-1 overflow-y-auto p-4 m-0 data-[state=active]:flex data-[state=active]:flex-col bg-background">
              <SmartLoadingState
                isLoading={isLoading}
                isError={!!error}
                hasData={filteredGeocaches.length > 0}
                data={filteredGeocaches}
                error={error as Error}
                onRetry={() => {
                  optimisticGeocaches.refresh();
                  refetch();
                }}
                skeletonCount={QUERY_LIMITS.SKELETON_COUNT}
                skeletonVariant="compact"
                compact={true}
                emptyState={
                  <div className="flex items-center justify-center flex-1">
                    <div className="text-center text-muted-foreground">
                      <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <p>No geocaches found</p>
                      <p className="text-sm mt-2">
                        {searchLocation ? 'Try increasing the search radius or searching a different area' : 'Try adjusting your filters'}
                      </p>
                    </div>
                  </div>
                }
                className="flex-1 flex flex-col"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      {filteredGeocaches.length} cache{filteredGeocaches.length !== 1 ? 's' : ''}
                      {isProximitySearchActive && ` • ${searchRadius}km radius`}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => {
                          optimisticGeocaches.refresh();
                          refetch();
                        }}
                        className="h-6 w-6 p-0"
                        title="Refresh geocaches"
                        disabled={isLoading && filteredGeocaches.length === 0}
                      >
                        <RefreshCw className={`h-3 w-3 ${isLoading && filteredGeocaches.length === 0 ? 'animate-spin' : ''}`} />
                      </Button>
                      {isProximitySearchActive && (
                        <Badge variant="secondary" className="text-xs flex items-center gap-1">
                          <Sparkles className="h-3 w-3" />
                          Smart Search
                        </Badge>
                      )}
                      {optimisticGeocaches.isStale && (
                        <Badge variant="outline" className="text-xs flex items-center gap-1">
                          <RefreshCw className="h-2 w-2 animate-spin" />
                          Updating
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="space-y-3">
                    {filteredGeocaches.map((cache) => (
                      <CompactGeocacheCard
                        key={cache.id}
                        cache={cache}
                        distance={cache.distance}
                        onClick={() => handleMarkerClick(cache)}
                      />
                    ))}
                  </div>
                </div>
              </SmartLoadingState>
            </TabsContent>
            <TabsContent value="map" className="flex-1 m-0 p-0 data-[state=active]:block">
              <div className="h-full w-full bg-background min-h-[400px]" style={{ height: 'calc(100vh - 12rem)' }}>
                <GeocacheMap 
                  key={mapUpdateKey}
                  geocaches={filteredGeocaches} 
                  userLocation={userLocation}
                  searchLocation={searchLocation || (showNearMe ? userLocation : null)}
                  searchRadius={searchRadius}
                  center={mapCenter || undefined}
                  zoom={mapZoom}
                  onMarkerClick={handleMarkerClick}
                  highlightedGeocache={highlightedGeocache || undefined}
                  showStyleSelector={true}
                  isNearMeActive={showNearMe}
                />
              </div>
            </TabsContent>
          </MapViewTabs>
        </div>
      </div>

      {/* Geocache Dialog */}
      <GeocacheDialog 
        geocache={selectedGeocache}
        isOpen={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  );
}