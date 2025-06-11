import { useState, useEffect, useRef } from "react";
import { useAppContext } from "@/shared/hooks/useAppContext";
import { useSearchParams } from "react-router-dom";
import { MapPin, X, Locate, RefreshCw, Sparkles } from "lucide-react";
import L from "leaflet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DesktopHeader } from "@/components/DesktopHeader";
import { useAdaptiveReliableGeocaches, type GeocacheWithDistance } from "@/features/geocache/hooks/useReliableProximitySearch";
import { useMapPageGeocaches } from "@/features/geocache/hooks/useOptimisticGeocaches";
import { useGeolocation } from "@/features/map/hooks/useGeolocation";
import { GeocacheMap } from "@/components/GeocacheMap";
import { CompactGeocacheCard } from "@/components/ui/geocache-card";
import { GeocacheDialog } from "@/components/GeocacheDialog";
import { LocationSearch } from "@/components/LocationSearch";
import { MapViewTabs } from "@/components/ui/mobile-button-patterns";
import { type ComparisonOperator } from "@/components/ui/comparison-filter";
import { FilterButton } from "@/components/FilterButton";
import type { Geocache } from "@/types/geocache";

import { TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { SmartLoadingState } from "@/components/ui/skeleton-patterns";
import { useNavigate } from "react-router-dom";


export default function Map() {
  const navigate = useNavigate();
  const { config } = useAppContext();
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
  
  const [isRetrying, setIsRetrying] = useState(false);
  const [isPullRefreshing, setIsPullRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const pullStartY = useRef<number | null>(null);
  const pullThreshold = 80; // pixels to trigger refresh

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

    // Handle tab switching logic
    if (tab && (tab === 'list' || tab === 'map')) {
      // Explicit tab parameter takes priority
      setActiveTab(tab);
    } else if (lat && lng) {
      // If coordinates are provided but no valid tab, switch to map tab on mobile
      setActiveTab('map');
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
      
      // If Near Me is active, update the map center when location is obtained
      // Force map update even if we already have a location (in case it's more accurate)
      if (showNearMe) {
        clearMapInteractionLock(); // Clear any interaction locks for explicit location update
        setMapCenter(location);
        setMapZoom(13);
        setMapUpdateKey(prev => prev + 1); // Force map update
      }
    }
  }, [coords, showNearMe]);

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

  const handleNearMe = async () => {
    // This is an explicit user action - clear all interaction locks
    clearMapInteractionLock();
    
    setShowNearMe(true);
    setSearchLocation(null); // Clear search location
    setSearchInView(false); // Clear search in view
    setViewBounds(null); // Clear view bounds
    setHighlightedGeocache(null); // Clear any highlighted geocache
    
    // Start location request
    try {
      await getLocation();
      // Location will be handled by the useEffect that watches coords
    } catch (error) {
      // If location fails, turn off Near Me mode
      console.warn('Location request failed:', error);
      setShowNearMe(false);
    }
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
    // Clear highlighted geocache when opening dialog to prevent popup conflicts
    setHighlightedGeocache(null);
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

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      await Promise.all([
        optimisticGeocaches.refresh(),
        refetch()
      ]);
    } catch (error) {
      console.error('Refresh failed:', error);
    } finally {
      setIsRetrying(false);
    }
  };

  // Pull-to-refresh handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      pullStartY.current = e.touches[0].clientY;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (pullStartY.current === null || e.touches.length !== 1) return;
    
    const currentY = e.touches[0].clientY;
    const distance = currentY - pullStartY.current;
    
    // Only allow pull down when at the top of the scroll container
    const scrollContainer = e.currentTarget as HTMLElement;
    if (scrollContainer.scrollTop === 0 && distance > 0) {
      e.preventDefault();
      setPullDistance(Math.min(distance, pullThreshold * 1.5));
    }
  };

  const handleTouchEnd = async () => {
    if (pullDistance >= pullThreshold && !isPullRefreshing) {
      setIsPullRefreshing(true);
      try {
        await Promise.all([
          optimisticGeocaches.refresh(),
          refetch()
        ]);
      } finally {
        setIsPullRefreshing(false);
      }
    }
    
    pullStartY.current = null;
    setPullDistance(0);
  };

  // Auto-refresh when relay changes
  useEffect(() => {
    // This effect can be used to refresh data when config changes
    // Currently no implementation needed
  }, [config]);

  return (
    <div className="h-screen flex flex-col">
      <DesktopHeader />
      
      {/* Desktop View */}
      <div className="hidden lg:flex flex-1 overflow-hidden min-h-0">
        {/* Sidebar */}
        <div className="w-96 border-r bg-background flex flex-col">
          {/* Filters */}
          <div className="p-4 border-b bg-background/95 backdrop-blur-sm flex-shrink-0">
            <div className="space-y-4">
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
                />
              </div>
              
              <div className="space-y-3">
                <LocationSearch 
                  onLocationSelect={handleLocationSelect}
                  placeholder="Search city or zip..."
                />
                
                <div className="flex gap-2">
                  <Button 
                    variant={showNearMe ? "default" : "outline"} 
                    className={`h-9 text-xs ${(showNearMe || searchLocation || searchInView) ? 'px-3' : 'flex-1'}`}
                    onClick={handleNearMe}
                    disabled={isGettingLocation}
                  >
                    <Locate className={`h-3 w-3 mr-1 ${isGettingLocation ? 'animate-spin' : ''}`} />
                    {isGettingLocation ? "Locating..." : showNearMe && userLocation ? "Near Me ✓" : "Near Me"}
                  </Button>
                  
                  <Button 
                    variant={searchInView ? "default" : "outline"} 
                    className={`h-9 text-xs ${(showNearMe || searchLocation || searchInView) ? 'px-3' : 'flex-1'}`}
                    onClick={handleSearchInView}
                    disabled={isLoading}
                  >
                    <MapPin className="h-3 w-3 mr-1" />
                    {(showNearMe || searchLocation || searchInView) ? 'In View' : 'Search in View'}
                  </Button>
                  
                  {(showNearMe || searchLocation || searchInView) && (
                    <>
                      <Select value={searchRadius.toString()} onValueChange={(v) => setSearchRadius(Number(v) || 25)}>
                        <SelectTrigger className="flex-1 min-w-0 h-9 text-xs">
                          <SelectValue placeholder="25 km" />
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
                        className="h-9 w-9 p-0 flex-shrink-0"
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
          <div className="flex-1 overflow-y-auto min-h-0">
            <SmartLoadingState
              isLoading={isProximitySearchActive ? isLoading && filteredGeocaches.length === 0 : optimisticGeocaches.isLoading && !optimisticGeocaches.hasInitialData}
              isError={isProximitySearchActive ? !!error : optimisticGeocaches.isError}
              hasData={filteredGeocaches.length > 0 || optimisticGeocaches.hasInitialData}
              data={filteredGeocaches}
              error={(isProximitySearchActive ? error : optimisticGeocaches.error) as Error}
              onRetry={handleRetry}
              isRetrying={isRetrying}
              skeletonCount={3}
              skeletonVariant="compact"
              compact={true}
              showRelayFallback={true}
              className="h-full"
            >
              <div className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="text-sm text-muted-foreground">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span>
                        {filteredGeocaches.length} cache{filteredGeocaches.length !== 1 ? 's' : ''}
                        {isProximitySearchActive && ` • ${searchRadius}km radius`}
                      </span>
                      

                      
                      {((isProximitySearchActive ? isLoading : optimisticGeocaches.isLoading) && filteredGeocaches.length === 0) && (
                        <div className="flex items-center gap-1 text-xs">
                          <div className="animate-spin rounded-full h-3 w-3 border border-muted-foreground/30 border-t-muted-foreground"></div>
                          <span>searching...</span>
                        </div>
                      )}
                      {optimisticGeocaches.isStale && !optimisticGeocaches.isFetching && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleRetry}
                          className="h-6 px-2 text-xs text-red-900 hover:text-red-950 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-950/20"
                        >
                          <RefreshCw className="h-3 w-3 mr-1" />
                          Update available
                        </Button>
                      )}
                      {optimisticGeocaches.isFetching && (
                        <div className="flex items-center gap-1 text-xs">
                          <div className="animate-pulse h-2 w-2 bg-primary rounded-full"></div>
                          <span>updating</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">

                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={handleRetry}
                      className={`h-8 px-3 hover:bg-muted/50 border-muted-foreground/20 transition-all duration-200 ${
                        optimisticGeocaches.isStale && !optimisticGeocaches.isFetching 
                          ? 'border-red-300 bg-red-50 text-red-900 hover:bg-red-100 dark:border-red-600 dark:bg-red-950/20 dark:text-red-400 dark:hover:bg-red-950/40' 
                          : ''
                      }`}
                      title="Refresh geocaches (R)"
                      disabled={isRetrying}
                    >
                      <RefreshCw className={`h-3 w-3 mr-1 ${isRetrying ? 'animate-spin' : optimisticGeocaches.isStale && !optimisticGeocaches.isFetching ? 'animate-pulse' : ''}`} />
                      <span className="text-xs">Refresh</span>
                    </Button>
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

        {/* Map - render immediately with progressive geocache loading */}
        <div className="flex-1 relative bg-background min-h-0">
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
          
          {/* Progressive loading indicator for geocaches */}
          {(isProximitySearchActive ? isLoading : optimisticGeocaches.isLoading) && filteredGeocaches.length === 0 && (
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-20 bg-background/95 backdrop-blur-sm border rounded-full px-4 py-2 shadow-lg">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-muted-foreground/30 border-t-primary"></div>
                <span>Finding geocaches...</span>
              </div>
            </div>
          )}
          
          {/* Floating refresh button when data is stale */}
          {optimisticGeocaches.isStale && !optimisticGeocaches.isFetching && filteredGeocaches.length > 0 && (
            <div className="absolute top-4 right-4 z-20">
              <Button
                onClick={handleRetry}
                className="bg-red-900 hover:bg-red-950 text-white shadow-lg animate-in fade-in duration-300"
                size="sm"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isRetrying ? "animate-spin" : ""}`} />
                New caches available
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile View */}
      <div className="block lg:hidden fixed inset-0 flex flex-col" style={{ top: '4rem', bottom: '4rem' }}>
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
                    className={`h-9 text-xs ${(showNearMe || searchLocation || searchInView) ? 'px-3' : 'flex-1'}`}
                    onClick={handleNearMe}
                    disabled={isGettingLocation}
                  >
                    <Locate className={`h-3 w-3 mr-1 ${isGettingLocation ? 'animate-spin' : ''}`} />
                    {isGettingLocation ? "Locating..." : showNearMe && userLocation ? "Near Me ✓" : "Near Me"}
                  </Button>
                  
                  <Button 
                    variant={searchInView ? "default" : "outline"} 
                    className={`h-9 text-xs ${(showNearMe || searchLocation || searchInView) ? 'px-3' : 'flex-1'}`}
                    onClick={handleSearchInView}
                    disabled={isLoading}
                  >
                    <MapPin className="h-3 w-3 mr-1" />
                    {(showNearMe || searchLocation || searchInView) ? 'In View' : 'Search in View'}
                  </Button>
                  
                  {(showNearMe || searchLocation || searchInView) && (
                    <>
                      <Select value={searchRadius.toString()} onValueChange={(v) => setSearchRadius(Number(v) || 25)}>
                        <SelectTrigger className="flex-1 min-w-0 h-9 text-xs">
                          <SelectValue placeholder="25 km" />
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
                        className="h-9 w-9 p-0 flex-shrink-0"
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
        </div>
        

        {/* Mobile Content Area */}
        <div className="flex-1 overflow-hidden">
          <MapViewTabs 
            className="h-full flex flex-col"
            value={activeTab}
            onValueChange={setActiveTab}
          >
            <TabsContent value="list" className="flex-1 mt-0 m-0 p-0 data-[state=active]:flex data-[state=active]:flex-col bg-background overflow-hidden">
              <div 
                className="flex-1 overflow-y-auto p-4 pb-6 min-h-0 relative"
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
              >
                {/* Pull-to-refresh indicator */}
                {(pullDistance > 0 || isPullRefreshing) && (
                  <div 
                    className="absolute top-0 left-0 right-0 flex items-center justify-center bg-background/95 backdrop-blur-sm border-b transition-all duration-200 z-10"
                    style={{ 
                      height: `${Math.min(pullDistance, pullThreshold)}px`,
                      opacity: pullDistance > 20 ? 1 : pullDistance / 20 
                    }}
                  >
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <RefreshCw className={`h-4 w-4 ${(isPullRefreshing || pullDistance >= pullThreshold) ? 'animate-spin' : ''}`} />
                      <span>
                        {isPullRefreshing 
                          ? 'Refreshing...' 
                          : pullDistance >= pullThreshold 
                            ? 'Release to refresh' 
                            : 'Pull to refresh'
                        }
                      </span>
                    </div>
                  </div>
                )}
                
                <div style={{ paddingTop: pullDistance > 0 ? `${Math.min(pullDistance, pullThreshold)}px` : '0' }}>
                <SmartLoadingState
                  isLoading={isProximitySearchActive ? isLoading && filteredGeocaches.length === 0 : optimisticGeocaches.isLoading && !optimisticGeocaches.hasInitialData}
                  isError={isProximitySearchActive ? !!error : optimisticGeocaches.isError}
                  hasData={filteredGeocaches.length > 0 || optimisticGeocaches.hasInitialData}
                  data={filteredGeocaches}
                  error={(isProximitySearchActive ? error : optimisticGeocaches.error) as Error}
                  onRetry={handleRetry}
                  isRetrying={isRetrying}
                  skeletonCount={3}
                  skeletonVariant="compact"
                  compact={true}
                  showRelayFallback={true}
                  className="h-full"
                >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <span>
                          {filteredGeocaches.length} cache{filteredGeocaches.length !== 1 ? 's' : ''}
                          {isProximitySearchActive && ` • ${searchRadius}km radius`}
                          {searchInView && ' • in view'}
                        </span>
                        {((isProximitySearchActive ? isLoading : optimisticGeocaches.isLoading) && filteredGeocaches.length === 0) && (
                          <div className="flex items-center gap-1 text-xs">
                            <div className="animate-spin rounded-full h-3 w-3 border border-muted-foreground/30 border-t-muted-foreground"></div>
                            <span>searching...</span>
                          </div>
                        )}
                        {optimisticGeocaches.isStale && !optimisticGeocaches.isFetching && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleRetry}
                            className="h-6 px-2 text-xs text-red-900 hover:text-red-950 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-950/20"
                          >
                            <RefreshCw className="h-3 w-3 mr-1" />
                            Update
                          </Button>
                        )}
                        {optimisticGeocaches.isFetching && (
                          <div className="flex items-center gap-1 text-xs">
                            <div className="animate-pulse h-2 w-2 bg-primary rounded-full"></div>
                            <span>updating</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={handleRetry}
                        className={`h-8 px-3 hover:bg-muted/50 border-muted-foreground/20 transition-all duration-200 ${
                          optimisticGeocaches.isStale && !optimisticGeocaches.isFetching 
                            ? 'border-red-300 bg-red-50 text-red-900 hover:bg-red-100 dark:border-red-600 dark:bg-red-950/20 dark:text-red-400 dark:hover:bg-red-950/40' 
                            : ''
                        }`}
                        title="Refresh geocaches (R)"
                        disabled={isRetrying}
                      >
                        <RefreshCw className={`h-3 w-3 mr-1 ${isRetrying ? 'animate-spin' : optimisticGeocaches.isStale && !optimisticGeocaches.isFetching ? 'animate-pulse' : ''}`} />
                        <span className="text-xs">Refresh</span>
                      </Button>
                      {isProximitySearchActive && (
                        <Badge 
                          variant={proximitySuccessful ? "secondary" : "outline"} 
                          className="text-xs flex items-center gap-1"
                          title={proximityAttempted ? (proximitySuccessful ? "Proximity search successful" : "Proximity search failed, using fallback") : "Using broad search"}
                        >
                          <Sparkles className="h-2 w-2" />
                          {proximitySuccessful ? "Smart" : searchStrategy === "fallback" ? "Fallback" : "Broad"}
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
              </div>
            </TabsContent>
            <TabsContent value="map" className="flex-1 mt-0 m-0 p-0 data-[state=active]:block">
              <div className="h-full w-full bg-background relative">
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
                
                {/* Progressive loading indicator for mobile map */}
                {(isProximitySearchActive ? isLoading : optimisticGeocaches.isLoading) && filteredGeocaches.length === 0 && (
                  <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-20 bg-background/95 backdrop-blur-sm border rounded-full px-4 py-2 shadow-lg">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-muted-foreground/30 border-t-primary"></div>
                      <span>Finding geocaches...</span>
                    </div>
                  </div>
                )}
                
                {/* Floating refresh button for mobile map when data is stale */}
                {optimisticGeocaches.isStale && !optimisticGeocaches.isFetching && filteredGeocaches.length > 0 && (
                  <div className="absolute top-4 right-4 z-20">
                    <Button
                      onClick={handleRetry}
                      className="bg-red-900 hover:bg-red-950 text-white shadow-lg animate-in fade-in duration-300"
                      size="sm"
                    >
                      <RefreshCw className={`h-4 w-4 mr-1 ${isRetrying ? "animate-spin" : ""}`} />
                      <span className="hidden sm:inline">New caches</span>
                      <span className="sm:hidden">Update</span>
                    </Button>
                  </div>
                )}
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