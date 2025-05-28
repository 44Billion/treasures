import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { MapPin, Navigation, Filter, X, Locate } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { LoginArea } from "@/components/auth/LoginArea";
import { useGeocaches } from "@/hooks/useGeocaches";
import { GeocacheMap } from "@/components/GeocacheMap";
import { GeocacheList } from "@/components/GeocacheList";
import { LocationSearch } from "@/components/LocationSearch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { sortByDistance, formatDistance } from "@/lib/geo";
import { Badge } from "@/components/ui/badge";

export default function Map() {
  const [searchQuery, setSearchQuery] = useState("");
  const [difficulty, setDifficulty] = useState<string>("all");
  const [terrain, setTerrain] = useState<string>("all");
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [mapZoom, setMapZoom] = useState(10);
  const [showNearMe, setShowNearMe] = useState(false);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const mapRef = useRef<any>(null);
  
  const { data: geocaches, isLoading } = useGeocaches({
    search: searchQuery,
    difficulty: difficulty === "all" ? undefined : parseInt(difficulty),
    terrain: terrain === "all" ? undefined : parseInt(terrain),
  });

  useEffect(() => {
    // Get user's location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          console.error("Error getting location:", error);
        }
      );
    }
  }, []);

  // Sort geocaches by distance if user location is available and "Near Me" is active
  const filteredGeocaches = (() => {
    const caches = geocaches || [];
    
    if (showNearMe && userLocation) {
      const cachesWithDistance = sortByDistance(caches, userLocation.lat, userLocation.lng);
      return cachesWithDistance;
    }
    
    return caches;
  })();

  const handleLocationSelect = (location: { lat: number; lng: number; name: string }) => {
    setMapCenter({ lat: location.lat, lng: location.lng });
    setMapZoom(13);
    setShowNearMe(false);
  };

  const handleNearMe = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      return;
    }

    setIsGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const location = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setUserLocation(location);
        setMapCenter(location);
        setMapZoom(13);
        setShowNearMe(true);
        setIsGettingLocation(false);
      },
      (error) => {
        console.error("Error getting location:", error);
        alert("Unable to get your location. Please check your browser settings.");
        setIsGettingLocation(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b bg-white sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2">
              <MapPin className="h-8 w-8 text-green-600" />
              <h1 className="text-2xl font-bold text-gray-900">NostrCache</h1>
            </Link>
            <div className="flex items-center gap-4">
              <div className="hidden md:block w-96">
                <LocationSearch 
                  onLocationSelect={handleLocationSelect}
                  placeholder="Search location: city, zip code, or coordinates..."
                />
              </div>
              <LoginArea />
            </div>
          </div>
        </div>
      </header>

      <div className="flex h-[calc(100vh-73px)]">
        {/* Sidebar */}
        <div className="w-96 border-r bg-white overflow-hidden flex flex-col">
          {/* Search and Filters */}
          <div className="p-4 border-b">
            <div className="space-y-4">
              {/* Location Search for mobile */}
              <div className="md:hidden">
                <Label>Search Location</Label>
                <LocationSearch 
                  onLocationSelect={handleLocationSelect}
                  placeholder="City, zip, or coordinates..."
                />
              </div>
              
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

              <Button 
                variant={showNearMe ? "default" : "outline"} 
                className="w-full"
                onClick={handleNearMe}
                disabled={isGettingLocation}
              >
                <Locate className="h-4 w-4 mr-2" />
                {isGettingLocation ? "Getting location..." : showNearMe ? "Showing Near You" : "Find Near Me"}
              </Button>
              
              {showNearMe && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="w-full"
                  onClick={() => setShowNearMe(false)}
                >
                  <X className="h-4 w-4 mr-2" />
                  Clear location filter
                </Button>
              )}
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
                  Found {filteredGeocaches.length} geocache{filteredGeocaches.length !== 1 ? 's' : ''}
                </p>
                <GeocacheList geocaches={filteredGeocaches} compact />
              </div>
            ) : (
              <div className="p-4 text-center text-gray-500">
                <MapPin className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p>No geocaches found</p>
                <p className="text-sm mt-2">Try adjusting your filters</p>
              </div>
            )}
          </div>
        </div>

        {/* Map */}
        <div className="flex-1 relative">
          <GeocacheMap 
            geocaches={filteredGeocaches} 
            userLocation={userLocation}
            center={mapCenter || undefined}
            zoom={mapZoom}
          />
        </div>
      </div>

      {/* Mobile View */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t">
        <Tabs defaultValue="list" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="list">List</TabsTrigger>
            <TabsTrigger value="map">Map</TabsTrigger>
          </TabsList>
          <TabsContent value="list" className="h-[50vh] overflow-y-auto">
            {/* Mobile list view */}
          </TabsContent>
          <TabsContent value="map" className="h-[50vh]">
            {/* Mobile map view */}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}