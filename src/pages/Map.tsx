import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { MapPin, Navigation, Filter, X, Locate } from "lucide-react";
import L from "leaflet";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { DesktopHeader } from "@/components/DesktopHeader";
import { LoginArea } from "@/components/auth/LoginArea";
import { useGeocaches } from "@/hooks/useGeocaches";
import { useGeolocation } from "@/hooks/useGeolocation";
import { GeocacheMap } from "@/components/GeocacheMap";
import { DetailedGeocacheCard, CompactGeocacheCard } from "@/components/ui/geocache-card";
import { GeocacheDialog } from "@/components/GeocacheDialog";
import { LocationSearch } from "@/components/LocationSearch";
import type { Geocache } from "@/types/geocache";

type GeocacheWithDistance = Geocache & { distance?: number };

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { sortByDistance, formatDistance, filterByRadius } from "@/lib/geo";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";

export default function Map() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [difficulty, setDifficulty] = useState<string>("all");
  const [terrain, setTerrain] = useState<string>("all");
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [mapZoom, setMapZoom] = useState(10);
  const [showNearMe, setShowNearMe] = useState(false);
  const [searchLocation, setSearchLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [searchRadius, setSearchRadius] = useState(25); // km
  const [mapUpdateKey, setMapUpdateKey] = useState(0);
  const [selectedGeocache, setSelectedGeocache] = useState<Geocache | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const mapRef = useRef<L.Map | null>(null);
  
  const { loading: isGettingLocation, coords, getLocation } = useGeolocation();
  
  const { data: geocaches, isLoading, error } = useGeocaches({
    search: searchQuery,
    difficulty: difficulty === "all" ? undefined : parseInt(difficulty),
    terrain: terrain === "all" ? undefined : parseInt(terrain),
  });

  // Add debugging
  console.log('Map page - isLoading:', isLoading);
  console.log('Map page - error:', error);
  console.log('Map page - geocaches:', geocaches?.length, 'caches');
  if (geocaches && geocaches.length > 0) {
    console.log('Map page - sample geocache:', geocaches[0]);
  }
  console.log('Map page - search params:', {
    search: searchQuery,
    difficulty: difficulty === "all" ? undefined : parseInt(difficulty),
    terrain: terrain === "all" ? undefined : parseInt(terrain),
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
    setMapUpdateKey(prev => prev + 1); // Force map update
  };

  const handleNearMe = () => {
    setShowNearMe(true);
    setSearchLocation(null); // Clear search location
    getLocation();
  };

  const handleMarkerClick = (geocache: Geocache) => {
    setSelectedGeocache(geocache);
    setDialogOpen(true);
  };

  return (
    <div className="bg-gray-50">
      <DesktopHeader variant="map" />

      <div className="hidden lg:flex h-[calc(100vh-73px)]">
        {/* Sidebar */}
        <div className="w-96 border-r bg-white overflow-hidden flex flex-col">
          {/* Search and Filters */}
          <div className="p-4 border-b">
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
                <div className="flex-1">
                  <Label htmlFor="difficulty">Difficulty</Label>
                  <Select value={difficulty} onValueChange={setDifficulty}>
                    <SelectTrigger id="difficulty">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="1">1 - Easy</SelectItem>
                      <SelectItem value="2">2 - Moderate</SelectItem>
                      <SelectItem value="3">3 - Hard</SelectItem>
                      <SelectItem value="4">4 - Very Hard</SelectItem>
                      <SelectItem value="5">5 - Expert</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex-1">
                  <Label htmlFor="terrain">Terrain</Label>
                  <Select value={terrain} onValueChange={setTerrain}>
                    <SelectTrigger id="terrain">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="1">1 - Easy</SelectItem>
                      <SelectItem value="2">2 - Moderate</SelectItem>
                      <SelectItem value="3">3 - Hard</SelectItem>
                      <SelectItem value="4">4 - Very Hard</SelectItem>
                      <SelectItem value="5">5 - Expert</SelectItem>
                    </SelectContent>
                  </Select>
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
            {isLoading ? (
              <div className="p-4 text-center text-gray-500">
                Loading geocaches...
              </div>
            ) : filteredGeocaches.length > 0 ? (
              <div className="p-4">
                <p className="text-sm text-gray-600 mb-4">
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
              <div className="p-4 text-center text-gray-500">
                <MapPin className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p>No geocaches found</p>
                <p className="text-sm mt-2">
                  {searchLocation ? 'Try increasing the search radius or searching a different area' : 'Try adjusting your filters'}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Map */}
        <div className="flex-1 relative">
          <GeocacheMap 
            geocaches={filteredGeocaches} 
            userLocation={userLocation}
            searchLocation={searchLocation || (showNearMe ? userLocation : null)}
            searchRadius={searchRadius}
            center={mapCenter || undefined}
            zoom={mapZoom}
            onMarkerClick={handleMarkerClick}
          />
        </div>
      </div>

      {/* Mobile View */}
      <div className="block lg:hidden h-screen flex flex-col">
        {/* Mobile Filters Header */}
        <div className="bg-white border-b shadow-sm flex-shrink-0">
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
                <Select value={difficulty} onValueChange={setDifficulty}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Difficulty" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="1">D1</SelectItem>
                    <SelectItem value="2">D2</SelectItem>
                    <SelectItem value="3">D3</SelectItem>
                    <SelectItem value="4">D4</SelectItem>
                    <SelectItem value="5">D5</SelectItem>
                  </SelectContent>
                </Select>
                
                <Select value={terrain} onValueChange={setTerrain}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Terrain" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="1">T1</SelectItem>
                    <SelectItem value="2">T2</SelectItem>
                    <SelectItem value="3">T3</SelectItem>
                    <SelectItem value="4">T4</SelectItem>
                    <SelectItem value="5">T5</SelectItem>
                  </SelectContent>
                </Select>
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
          <Tabs defaultValue="list" className="h-full flex flex-col">
            <TabsList className="grid w-full grid-cols-2 rounded-none border-b bg-white h-12 flex-shrink-0">
              <TabsTrigger value="list" className="h-10">List</TabsTrigger>
              <TabsTrigger value="map" className="h-10">Map</TabsTrigger>
            </TabsList>
            <TabsContent value="list" className="flex-1 overflow-y-auto p-4 m-0 data-[state=active]:flex data-[state=active]:flex-col">
              {isLoading ? (
                <div className="flex items-center justify-center flex-1">
                  <div className="text-center text-gray-500">
                    <MapPin className="h-8 w-8 text-gray-400 mx-auto mb-2 animate-pulse" />
                    <p>Loading geocaches...</p>
                  </div>
                </div>
              ) : filteredGeocaches.length > 0 ? (
                <div className="space-y-4">
                  <p className="text-sm text-gray-600">
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
                  <div className="text-center text-gray-500">
                    <MapPin className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <p>No geocaches found</p>
                    <p className="text-sm mt-2">
                      {searchLocation ? 'Try increasing the search radius or searching a different area' : 'Try adjusting your filters'}
                    </p>
                  </div>
                </div>
              )}
            </TabsContent>
            <TabsContent value="map" className="flex-1 m-0 p-0 data-[state=active]:block">
              <div className="h-full">
                <GeocacheMap 
                  geocaches={filteredGeocaches} 
                  userLocation={userLocation}
                  searchLocation={searchLocation || (showNearMe ? userLocation : null)}
                  searchRadius={searchRadius}
                  center={mapCenter || undefined}
                  zoom={mapZoom}
                  onMarkerClick={handleMarkerClick}
                />
              </div>
            </TabsContent>
          </Tabs>
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