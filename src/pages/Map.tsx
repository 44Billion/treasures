import { useState, useEffect, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
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
import { useAdaptiveReliableGeocaches, type GeocacheWithDistance } from "@/hooks/useReliableProximitySearch";
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
import { SmartLoadingState } from "@/components/ui/skeleton-patterns";
import { QUERY_LIMITS } from "@/lib/constants";
import { useNavigate } from "react-router-dom";

export default function Map() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState("");
  const [difficulty, setDifficulty] = useState<number | undefined>(undefined);
  const [difficultyOperator, setDifficultyOperator] = useState<ComparisonOperator>("all");
  const [terrain, setTerrain] = useState<number | undefined>(undefined);
  const [terrainOperator, setTerrainOperator] = useState<ComparisonOperator>("all");
  const [cacheType, setCacheType] = useState<string | undefined>(undefined);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [mapZoom, setMapZoom] = useState(10);
  const [isMapCenterLocked, setIsMapCenterLocked] = useState(false);
  
  // Function to clear interaction state for explicit user actions
  const clearMapInteractionLock = () => {
    setIsMapCenterLocked(false);
  };
  const [showNearMe, setShowNearMe] = useState(false);
  const [searchLocation, setSearchLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [searchRadius, setSearchRadius] = useState(25); // km
  const [searchInView, setSearchInView] = useState(false);
  const [viewBounds, setViewBounds] = useState<{ north: number; south: number; east: number; west: number } | null>(null);
  const [mapUpdateKey, setMapUpdateKey] = useState(0);
  const [selectedGeocache, setSelectedGeocache] = useState<Geocache | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [highlightedGeocache, setHighlightedGeocache] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("list");
  const mapRef = useRef<L.Map | null>(null);
  
  const { loading: isGettingLocation, coords, getLocation } = useGeolocation();
  
  // Use optimistic loading for base geocaches - don't block map rendering
  const optimisticGeocaches = useMapPageGeocaches();

  const { 
    data: geocaches, 
    isLoading, 
    error, 
    refetch,
    searchStrategy,
    proximityAttempted,
    proximitySuccessful,
    totalFound,
    debugInfo
  } = useAdaptiveReliableGeocaches({
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



  // Parse URL parameters on mount - these are explicit navigation actions
  useEffect(() => {
    const lat = searchParams.get('lat');
    const lng = searchParams.get('lng');
    const zoom = searchParams.get('zoom');
    const highlight = searchParams.get('highlight');
    const tab = searchParams.get('tab');

    if (lat && lng) {
      // URL navigation is an explicit action - clear interaction locks
      clearMapInteractionLock();
      
      const center = {
        lat: parseFloat(lat),
        lng: parseFloat(lng),
      };
      setMapCenter(center);
      setMapUpdateKey(prev => prev + 1);
      
      // If coordinates are provided, switch to map tab on mobile
      if (tab === 'map' || (lat && lng && !tab)) {
        setActiveTab('map');
      }
    }

    if (zoom) {
      const zoomLevel = parseInt(zoom, 10);
      if (zoomLevel >= 1 && zoomLevel <= 18) {
        setMapZoom(zoomLevel);
      }
    }

    if (highlight) {
      setHighlightedGeocache(highlight);
    }

    if (tab && (tab === 'list' || tab === 'map')) {
      setActiveTab(tab);
    }
  }, [searchParams]);

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

  // Lock map center after user interactions to prevent unwanted updates
  useEffect(() => {
    if (mapRef.current) {
      const map = mapRef.current;
      let lockTimeout: NodeJS.Timeout | null = null;
      
      const handleUserInteraction = () => {
        setIsMapCenterLocked(true);
        
        // Clear any existing timeout
        if (lockTimeout) {
          clearTimeout(lockTimeout);
        }
        
        // Unlock after 20 seconds to allow programmatic updates
        lockTimeout = setTimeout(() => {
          setIsMapCenterLocked(false);
        }, 20000); // Much longer protection - 20 seconds
      };
      
      // Listen to comprehensive interaction events
      map.on('dragstart', handleUserInteraction);
      map.on('zoomstart', handleUserInteraction);
      map.on('movestart', handleUserInteraction);
      
      // Also listen for mouse/touch events on the map container
      const mapContainer = map.getContainer();
      mapContainer.addEventListener('mousedown', handleUserInteraction);
      mapContainer.addEventListener('touchstart', handleUserInteraction);
      
      return () => {
        map.off('dragstart', handleUserInteraction);
        map.off('zoomstart', handleUserInteraction);
        map.off('movestart', handleUserInteraction);
        
        mapContainer.removeEventListener('mousedown', handleUserInteraction);
        mapContainer.removeEventListener('touchstart', handleUserInteraction);
        
        if (lockTimeout) {
          clearTimeout(lockTimeout);
        }
      };
    }
  }, [mapRef.current]);

  // Remove automatic location request - only get location when user clicks "Near Me"

  // Check if proximity search is active
  const isProximitySearchActive = !!(searchLocation || (showNearMe && userLocation) || searchInView);
  const proximityCenter = searchLocation || (showNearMe ? userLocation : null);

  // Use proximity search results when active, otherwise fall back to optimistic geocaches
  // Apply client-side filtering when using optimistic geocaches
  const filteredGeocaches: GeocacheWithDistance[] = isProximitySearchActive 
    ? (geocaches || [])
    : applyClientSideFilters(optimisticGeocaches.geocaches || []);

  // Client-side filtering function for optimistic geocaches
  function applyClientSideFilters(caches: any[]): GeocacheWithDistance[] {
    let filtered = [...caches];

    // Text search filter
    if (searchQuery) {
      const searchLower = searchQuery.toLowerCase();
      filtered = filtered.filter(g => 
        g.name.toLowerCase().includes(searchLower) ||
        g.description.toLowerCase().includes(searchLower)
      );
    }

    // Difficulty filter
    if (difficulty !== undefined && difficultyOperator && difficultyOperator !== 'all') {
      filtered = filtered.filter(g => 
        applyComparison(g.difficulty, difficultyOperator, difficulty)
      );
    }

    // Terrain filter
    if (terrain !== undefined && terrainOperator && terrainOperator !== 'all') {
      filtered = filtered.filter(g => 
        applyComparison(g.terrain, terrainOperator, terrain)
      );
    }

    // Cache type filter
    if (cacheType && cacheType !== 'all') {
      filtered = filtered.filter(g => g.type === cacheType);
    }

    // Sort by creation date
    filtered.sort((a, b) => b.created_at - a.created_at);

    return filtered;
  }

  function applyComparison(value: number, operator: string, target: number): boolean {
    switch (operator) {
      case 'eq': return value === target;
      case 'gt': return value > target;
      case 'gte': return value >= target;
      case 'lt': return value < target;
      case 'lte': return value <= target;
      case 'all':
      default: return true;
    }
  }

  const handleLocationSelect = (location: { lat: number; lng: number; name: string }) => {
    // This is an explicit user action - clear all interaction locks
    clearMapInteractionLock();
    
    // Update all location-related state
    const newCenter = { lat: location.lat, lng: location.lng };
    setMapCenter(newCenter);
    setMapZoom(12); // Slightly more zoomed in for city searches
    setShowNearMe(false);
    setSearchInView(false); // Clear search in view
    setViewBounds(null); // Clear view bounds
    setSearchLocation(newCenter);
    setHighlightedGeocache(null); // Clear any highlighted geocache
    setMapUpdateKey(prev => prev + 1); // Force map update
  };

  const handleNearMe = () => {
    // This is an explicit user action - clear all interaction locks
    clearMapInteractionLock();
    
    setShowNearMe(true);
    setSearchLocation(null); // Clear search location
    setSearchInView(false); // Clear search in view
    setViewBounds(null); // Clear view bounds
    setHighlightedGeocache(null); // Clear any highlighted geocache
    getLocation();
  };

  const handleSearchInView = () => {
    // This is an explicit user action - clear all interaction locks
    clearMapInteractionLock();
    
    // Get current map bounds from the map ref
    if (mapRef.current) {
      const bounds = mapRef.current.getBounds();
      const center = bounds.getCenter();
      
      // Calculate approximate radius from bounds
      const northEast = bounds.getNorthEast();
      const southWest = bounds.getSouthWest();
      const radiusKm = Math.max(
        calculateDistance(center.lat, center.lng, northEast.lat, northEast.lng),
        calculateDistance(center.lat, center.lng, southWest.lat, southWest.lng)
      );
      
      setSearchInView(true);
      setShowNearMe(false); // Clear near me
      setSearchLocation({ lat: center.lat, lng: center.lng });
      setSearchRadius(Math.ceil(radiusKm));
      setViewBounds({
        north: bounds.getNorth(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        west: bounds.getWest()
      });
      setHighlightedGeocache(null); // Clear any highlighted geocache
    }
  };

  // Helper function to calculate distance between two points
  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const handleMarkerClick = (geocache: Geocache) => {
    setSelectedGeocache(geocache);
    setDialogOpen(true);
  };

  const handleCardClick = (geocache: Geocache) => {
    // This is an explicit user action - clear all interaction locks
    clearMapInteractionLock();
    
    // On desktop, snap to the location on the map and highlight it
    setMapCenter({ lat: geocache.location.lat, lng: geocache.location.lng });
    setMapZoom(16); // Zoom in closer for better detail
    setHighlightedGeocache(geocache.dTag); // Highlight this geocache
    setMapUpdateKey(prev => prev + 1); // Force map update
    
    // Clear any location-based searches to prevent conflicts
    setShowNearMe(false);
    setSearchLocation(null);
    setSearchInView(false);
    setViewBounds(null);
  };

  return (
    <div className="bg-background h-screen flex flex-col">
      <DesktopHeader variant="map" />

      <div className="hidden lg:flex flex-1 min-h-0">
        {/* Adventure Sidebar */}
        <div className="w-96 border-r bg-background/95 backdrop-blur-sm overflow-hidden flex flex-col min-h-0">
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
                    className={`h-8 ${(showNearMe || searchLocation || searchInView) ? 'px-3' : 'flex-1'}`}
                    onClick={handleNearMe}
                    disabled={isGettingLocation}
                  >
                    <Locate className="h-4 w-4 mr-1" />
                    {isGettingLocation ? "Finding..." : "Near Me"}
                  </Button>
                  
                  <Button 
                    variant={searchInView ? "default" : "outline"} 
                    className={`h-8 ${(showNearMe || searchLocation || searchInView) ? 'px-3' : 'flex-1'}`}
                    onClick={handleSearchInView}
                    disabled={isLoading}
                  >
                    <MapPin className="h-4 w-4 mr-1" />
                    {(showNearMe || searchLocation || searchInView) ? 'In View' : 'Search in View'}
                  </Button>
                  
                  {(showNearMe || searchLocation || searchInView) && (
                    <>
                      <Select value={searchRadius.toString()} onValueChange={(v) => setSearchRadius(Number(v) || 25)}>
                        <SelectTrigger className="w-20 h-8" >
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
                          setSearchInView(false);
                          setViewBounds(null);
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
          <div className="flex-1 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 16rem)' }}>
            <SmartLoadingState
              isLoading={isProximitySearchActive ? isLoading : optimisticGeocaches.isLoading}
              isError={isProximitySearchActive ? !!error : optimisticGeocaches.isError}
              hasData={filteredGeocaches.length > 0}
              data={filteredGeocaches}
              error={(isProximitySearchActive ? error : optimisticGeocaches.error) as Error}
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
              className="h-full"
            >
              <div className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="text-sm text-muted-foreground">
                    <p>
                      {filteredGeocaches.length} cache{filteredGeocaches.length !== 1 ? 's' : ''}
                      {isProximitySearchActive && ` • ${searchRadius}km radius`}
                    </p>
                    {import.meta.env.DEV && debugInfo && (
                      <details className="mt-1">
                        <summary className="cursor-pointer text-xs opacity-60">Debug Info</summary>
                        <pre className="text-xs mt-1 opacity-60 whitespace-pre-wrap">
                          {JSON.stringify(debugInfo, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
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
                      disabled={(isProximitySearchActive ? isLoading : optimisticGeocaches.isLoading) && filteredGeocaches.length === 0}
                    >
                      <RefreshCw className={`h-3 w-3 ${(isProximitySearchActive ? isLoading : optimisticGeocaches.isLoading) && filteredGeocaches.length === 0 ? 'animate-spin' : ''}`} />
                    </Button>
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

        {/* Map - render immediately, don't wait for geocache data */}
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
            mapRef={mapRef}
            isMapCenterLocked={isMapCenterLocked}
          />
        </div>
      </div>

      {/* Mobile View */}
      <div className="block lg:hidden flex-1 flex flex-col min-h-0">
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
                    className={`h-9 ${(showNearMe || searchLocation || searchInView) ? 'px-3' : 'flex-1'}`}
                    onClick={handleNearMe}
                    disabled={isGettingLocation}
                  >
                    <Locate className="h-4 w-4 mr-1" />
                    {isGettingLocation ? "Finding..." : "Near Me"}
                  </Button>
                  
                  <Button 
                    variant={searchInView ? "default" : "outline"} 
                    className={`h-9 ${(showNearMe || searchLocation || searchInView) ? 'px-3' : 'flex-1'}`}
                    onClick={handleSearchInView}
                    disabled={isLoading}
                  >
                    <MapPin className="h-4 w-4 mr-1" />
                    {(showNearMe || searchLocation || searchInView) ? 'In View' : 'Search in View'}
                  </Button>
                  
                  {(showNearMe || searchLocation || searchInView) && (
                    <>
                      <Select value={searchRadius.toString()} onValueChange={(v) => setSearchRadius(Number(v) || 25)}>
                        <SelectTrigger className="w-20 h-9">
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
                        className="h-9 w-9 p-0"
                        onClick={() => {
                          setShowNearMe(false);
                          setSearchLocation(null);
                          setSearchInView(false);
                          setViewBounds(null);
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
        <div className="flex-1 min-h-0">
          <MapViewTabs 
            className="h-full flex flex-col"
            value={activeTab}
            onValueChange={setActiveTab}
          >
            <TabsContent value="list" className="flex-1 mt-0 m-0 p-0 data-[state=active]:flex data-[state=active]:flex-col bg-background overflow-hidden">
              <div className="flex-1 overflow-y-auto p-4" style={{ maxHeight: 'calc(100vh - 14rem)' }}>
                <SmartLoadingState
                  isLoading={isProximitySearchActive ? isLoading : optimisticGeocaches.isLoading}
                  isError={isProximitySearchActive ? !!error : optimisticGeocaches.isError}
                  hasData={filteredGeocaches.length > 0}
                  data={filteredGeocaches}
                  error={(isProximitySearchActive ? error : optimisticGeocaches.error) as Error}
                  onRetry={() => {
                    optimisticGeocaches.refresh();
                    refetch();
                  }}
                  skeletonCount={QUERY_LIMITS.SKELETON_COUNT}
                  skeletonVariant="compact"
                  compact={true}
                  emptyState={
                    <div className="flex items-center justify-center min-h-[300px]">
                      <div className="text-center text-muted-foreground">
                        <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <p>No geocaches found</p>
                        <p className="text-sm mt-2">
                          {searchLocation ? 'Try increasing the search radius or searching a different area' : 'Try adjusting your filters'}
                        </p>
                      </div>
                    </div>
                  }
                  className="h-full"
                >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      <p>
                        {filteredGeocaches.length} cache{filteredGeocaches.length !== 1 ? 's' : ''}
                        {isProximitySearchActive && ` • ${searchRadius}km radius`}
                        {searchInView && ' • in view'}
                      </p>
                      {import.meta.env.DEV && debugInfo && (
                        <details className="mt-1">
                          <summary className="cursor-pointer text-xs opacity-60">Debug Info</summary>
                          <pre className="text-xs mt-1 opacity-60 whitespace-pre-wrap">
                            {JSON.stringify(debugInfo, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
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
                        disabled={(isProximitySearchActive ? isLoading : optimisticGeocaches.isLoading) && filteredGeocaches.length === 0}
                      >
                        <RefreshCw className={`h-2 w-2 ${(isProximitySearchActive ? isLoading : optimisticGeocaches.isLoading) && filteredGeocaches.length === 0 ? 'animate-spin' : ''}`} />
                      </Button>
                      {isProximitySearchActive && (
                        <Badge 
                          variant={proximitySuccessful ? "secondary" : "outline"} 
                          className="text-xs flex items-center gap-1"
                          title={proximityAttempted ? (proximitySuccessful ? "Proximity search successful" : "Proximity search failed, using fallback") : "Using broad search"}
                        >
                          <Sparkles className="h-2 w-2" />
                          {proximitySuccessful ? "Smart Search" : searchStrategy === "fallback" ? "Fallback Search" : "Broad Search"}
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
              </div>
            </TabsContent>
            <TabsContent value="map" className="flex-1 mt-0 m-0 p-0 data-[state=active]:block">
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
                  mapRef={mapRef}
                  isMapCenterLocked={isMapCenterLocked}
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