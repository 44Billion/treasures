import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { MapPin, Navigation, Filter, X, Locate, Compass, RefreshCw } from "lucide-react";
import L from "leaflet";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { DesktopHeader } from "@/components/DesktopHeader";
import { LoginArea } from "@/components/auth/LoginArea";
import { useAdvancedGeocaches } from "@/hooks/useAdvancedGeocaches";
import { useGeolocation } from "@/hooks/useGeolocation";
import { GeocacheMap } from "@/components/GeocacheMap";
import { DetailedGeocacheCard, CompactGeocacheCard } from "@/components/ui/geocache-card";
import { GeocacheDialog } from "@/components/GeocacheDialog";
import { LocationSearch } from "@/components/LocationSearch";
import { MapViewTabs } from "@/components/ui/mobile-button-patterns";
import { ComparisonFilter, type ComparisonOperator } from "@/components/ui/comparison-filter";
import { DIFFICULTY_TERRAIN_OPTIONS } from "@/lib/geocache-constants";
import type { Geocache } from "@/types/geocache";

type GeocacheWithDistance = Geocache & { distance?: number };

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { sortByDistance, formatDistance, filterByRadius } from "@/lib/geo";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";

export default function Map() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [difficulty, setDifficulty] = useState<number | undefined>(undefined);
  const [difficultyOperator, setDifficultyOperator] = useState<ComparisonOperator>("all");
  const [terrain, setTerrain] = useState<number | undefined>(undefined);
  const [terrainOperator, setTerrainOperator] = useState<ComparisonOperator>("all");
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
  
  const { data: geocaches, isLoading, error, refetch } = useAdvancedGeocaches({
    search: searchQuery,
    difficulty,
    difficultyOperator,
    terrain,
    terrainOperator,
  });

  // Shared value change handler for consistent logic
  const createValueChangeHandler = (setter: (value: number | undefined) => void) => 
    (value: string) => setter(value === "all" ? undefined : parseInt(value));

  // Shared value converter for consistent display
  const getValueForDisplay = (value: number | undefined) => value?.toString() || "all";

  // Reusable filter pair component
  const FilterPair = ({ compact = false }: { compact?: boolean }) => (
    <>
      <ComparisonFilter
        label="Difficulty"
        value={getValueForDisplay(difficulty)}
        onValueChange={createValueChangeHandler(setDifficulty)}
        operator={difficultyOperator}
        onOperatorChange={setDifficultyOperator}
        options={DIFFICULTY_TERRAIN_OPTIONS}
        className="flex-1"
        compact={compact}
      />
      
      <ComparisonFilter
        label="Terrain"
        value={getValueForDisplay(terrain)}
        onValueChange={createValueChangeHandler(setTerrain)}
        operator={terrainOperator}
        onOperatorChange={setTerrainOperator}
        options={DIFFICULTY_TERRAIN_OPTIONS}
        className="flex-1"
        compact={compact}
      />
    </>
  );

  // Add debugging
  console.log('Map page - isLoading:', isLoading);
  console.log('Map page - error:', error);
  console.log('Map page - geocaches:', geocaches?.length, 'caches');
  if (geocaches && geocaches.length > 0) {
    console.log('Map page - sample geocache:', geocaches[0]);
  }
  console.log('Map page - search params:', {
    search: searchQuery,
    difficulty,
    difficultyOperator,
    terrain,
    terrainOperator,
  });

  useEffect(() => {
    // Update user location when coords change
    if (coords) {
      const location = {
        lat: coords.latitude,
        lng: coords.longitude,
      };
      setUserLocation(location);
      
      // If Near Me is active, update the map center
      if (showNearMe) {
        setMapCenter(location);
        setMapZoom(13);
      }
    }
  }, [coords, showNearMe]);

  // Remove automatic location request - only get location when user clicks "Near Me"

  // Filter and sort geocaches based on location
  const filteredGeocaches: GeocacheWithDistance[] = (() => {
    let caches = geocaches || [];
    
    // Filter by search location if set
    if (searchLocation) {
      caches = filterByRadius(caches, searchLocation.lat, searchLocation.lng, searchRadius);
      const sorted = sortByDistance(caches, searchLocation.lat, searchLocation.lng);
      return sorted;
    }
    // Or filter by user location if "Near Me" is active
    else if (showNearMe && userLocation) {
      caches = filterByRadius(caches, userLocation.lat, userLocation.lng, searchRadius);
      const sorted = sortByDistance(caches, userLocation.lat, userLocation.lng);
      return sorted;
    }
    // If user location is available but no active filtering, preserve distances
    else if (userLocation) {
      const sorted = sortByDistance(caches, userLocation.lat, userLocation.lng);
      return sorted;
    }
    
    return caches;
  })();

  const handleLocationSelect = (location: { lat: number; lng: number; name: string }) => {
    console.log('Location selected:', location);
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
              <div>
                <Label htmlFor="search">Search Caches</Label>
                <Input
                  id="search"
                  placeholder="Search by name or description..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              
              <div className="flex gap-2">
                <FilterPair />
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
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <Compass className="h-6 w-6 animate-spin text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm font-medium">Loading geocaches...</p>
                  <p className="text-xs text-muted-foreground">Searching the network</p>
                </div>
              </div>
            ) : error ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <RefreshCw className="h-6 w-6 text-red-400 mx-auto mb-2" />
                  <p className="text-sm font-medium">Failed to load caches</p>
                  <p className="text-xs text-muted-foreground mb-3">
                    {error instanceof Error ? error.message : 'Network connection issue'}
                  </p>
                  <Button 
                    size="sm" 
                    onClick={() => refetch()} 
                    className="h-8 px-3"
                  >
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Try Again
                  </Button>
                </div>
              </div>
            ) : filteredGeocaches.length > 0 ? (
              <div className="p-4">
                <p className="text-sm text-muted-foreground mb-4">
                  {filteredGeocaches.length} cache{filteredGeocaches.length !== 1 ? 's' : ''}
                  {(searchLocation || (showNearMe && userLocation)) && ` • ${searchRadius}km radius`}
                </p>
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
            ) : (
              <div className="p-4 text-center text-muted-foreground">
                <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p>No geocaches found</p>
                <p className="text-sm mt-2">
                  {searchLocation ? 'Try increasing the search radius or searching a different area' : 'Try adjusting your filters'}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Map */}
        <div className="flex-1 relative bg-background">
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
          />
        </div>
      </div>

      {/* Mobile View */}
      <div className="block lg:hidden flex-1 flex flex-col overflow-hidden">
        {/* Adventure Mobile Filters Header */}
        <div className="bg-background/95 backdrop-blur-sm border-b flex-shrink-0">
          <div className="p-3">
            <div className="space-y-3">
              <div>
                <Input
                  placeholder="Search caches..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full"
                />
              </div>
              
              <div className="flex gap-2">
                <FilterPair compact />
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
              {isLoading ? (
                <div className="flex items-center justify-center flex-1">
                  <div className="text-center">
                    <Compass className="h-6 w-6 animate-spin text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm font-medium">Loading geocaches...</p>
                    <p className="text-xs text-muted-foreground">Searching the network</p>
                  </div>
                </div>
              ) : error ? (
                <div className="flex items-center justify-center flex-1">
                  <div className="text-center">
                    <RefreshCw className="h-6 w-6 text-red-400 mx-auto mb-2" />
                    <p className="text-sm font-medium">Failed to load caches</p>
                    <p className="text-xs text-muted-foreground mb-3">
                      {error instanceof Error ? error.message : 'Network connection issue'}
                    </p>
                    <Button 
                      size="sm" 
                      onClick={() => refetch()} 
                      className="h-8 px-3"
                    >
                      <RefreshCw className="h-3 w-3 mr-1" />
                      Try Again
                    </Button>
                  </div>
                </div>
              ) : filteredGeocaches.length > 0 ? (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    {filteredGeocaches.length} cache{filteredGeocaches.length !== 1 ? 's' : ''}
                    {(searchLocation || (showNearMe && userLocation)) && ` • ${searchRadius}km radius`}
                  </p>
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
              ) : (
                <div className="flex items-center justify-center flex-1">
                  <div className="text-center text-muted-foreground">
                    <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p>No geocaches found</p>
                    <p className="text-sm mt-2">
                      {searchLocation ? 'Try increasing the search radius or searching a different area' : 'Try adjusting your filters'}
                    </p>
                  </div>
                </div>
              )}
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