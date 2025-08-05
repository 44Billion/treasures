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
import { useGeocaches } from "@/features/geocache/hooks/useGeocaches";
import { useGeolocation } from "@/features/map/hooks/useGeolocation";
import { GeocacheMap } from "@/components/GeocacheMap";
import { CompactGeocacheCard } from "@/components/ui/geocache-card";
import { GeocacheDialog } from "@/components/GeocacheDialog";
import { LocationSearch } from "@/components/LocationSearch";
import { MapViewTabs } from "@/components/ui/mobile-button-patterns";
import { type ComparisonOperator } from "@/components/ui/comparison-filter";
import { FilterButton } from "@/components/FilterButton";
import type { Geocache } from "@/types/geocache";
import { useIsMobile } from "@/shared/hooks/useIsMobile";

import { TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { SmartLoadingState } from "@/components/ui/skeleton-patterns";



export default function Map() {

  const { config } = useAppContext();
  const [searchParams] = useSearchParams();
  const isMobile = useIsMobile();
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


  const [selectedGeocache, setSelectedGeocache] = useState<Geocache | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [highlightedGeocache, setHighlightedGeocache] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("list");

  const mapRef = useRef<L.Map | null>(null);
  
  const { loading: isGettingLocation, coords, getLocation } = useGeolocation();
  
  // Use the same geocaches hook as Home page to ensure consistent stats
  const baseGeocaches = useGeocaches();
  
  // Add state for skeleton loading
  const [showMapSkeletons, setShowMapSkeletons] = useState(true);
  
  // Hide skeletons after data loads or timeout
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowMapSkeletons(false);
    }, 2000); // Show skeletons for at least 2 seconds
    
    return () => clearTimeout(timer);
  }, []);
  
  // Hide skeletons immediately if we have data and it's not the initial load
  useEffect(() => {
    if (baseGeocaches.data && baseGeocaches.data.length > 0) {
      const timer = setTimeout(() => {
        setShowMapSkeletons(false);
      }, 1000); // Keep skeletons for at least 1 second even with data
      
      return () => clearTimeout(timer);
    }
    return;
  }, [baseGeocaches.data]);
  
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
    proximitySuccessful
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
    baseGeocaches: baseGeocaches.data, // Pass the geocaches with stats from useGeocaches
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
      }
    }
  }, [coords, showNearMe]);

  // Check if proximity search is active
  const isProximitySearchActive = !!(searchLocation || (showNearMe && userLocation) || searchInView);


  // Use proximity search results when active, otherwise fall back to base geocaches
  // Apply client-side filtering when using base geocaches
  const filteredGeocaches: GeocacheWithDistance[] = isProximitySearchActive 
    ? (geocaches || [])
    : applyClientSideFilters(baseGeocaches.data || []);

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

    setSearchLocation(newCenter);
    setHighlightedGeocache(null); setHighlightedGeocache(null); setHighlightedGeocache(null); // Clear any highlighted geocache
  };

  const handleNearMe = async () => {
    // This is an explicit user action - clear all interaction locks
    clearMapInteractionLock();
    
    setShowNearMe(true);
    setSearchLocation(null); // Clear search location
    setSearchInView(false); // Clear search in view

    // Clear any highlighted geocache
    
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

      // Clear any highlighted geocache
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
    
    // Check if we're on mobile AND in list view - only then open the dialog
    if (isMobile && activeTab === 'list') {
      setSelectedGeocache(geocache);
      setDialogOpen(true);
      // Switch to map tab to show the location after modal closes
      setActiveTab('map');
      return;
    }
    
    // On desktop (or when in map tab), center map on the geocache and highlight it to show popup
    setMapCenter({ lat: geocache.location.lat, lng: geocache.location.lng });
    setMapZoom(16);
    setHighlightedGeocache(geocache.dTag);
    
    // Clear any location-based searches to prevent conflicts
    setShowNearMe(false);
    setSearchLocation(null);
    setSearchInView(false);

    // Use the new map controller for immediate navigation
    if (typeof window !== 'undefined' && (window as any).handleMapCardClick) {
      (window as any).handleMapCardClick(
        { lat: geocache.location.lat, lng: geocache.location.lng },
        16
      );
    }
  };

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      await Promise.all([
        baseGeocaches.refetch(),
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
      pullStartY.current = e.touches[0]?.clientY || 0;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (pullStartY.current === null || e.touches.length !== 1) return;
    
    const currentY = e.touches[0]?.clientY || 0;
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
          baseGeocaches.refetch(),
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
            {showMapSkeletons ? (
              // Show skeleton cards during loading
              <div className="p-4">
                <div className="space-y-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="animate-pulse">
                      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-3">
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 bg-slate-200 dark:bg-slate-700 rounded-full shrink-0"></div>
                          <div className="flex-1 min-w-0 space-y-2">
                            <div className="h-4 w-3/4 bg-slate-200 dark:bg-slate-700 rounded"></div>
                            <div className="h-3 w-1/2 bg-slate-200 dark:bg-slate-700 rounded"></div>
                            <div className="flex gap-1">
                              <div className="h-5 w-8 bg-slate-200 dark:bg-slate-700 rounded"></div>
                              <div className="h-5 w-8 bg-slate-200 dark:bg-slate-700 rounded"></div>
                              <div className="h-5 w-12 bg-slate-200 dark:bg-slate-700 rounded"></div>
                            </div>
                          </div>
                          <div className="w-7 h-7 bg-slate-200 dark:bg-slate-700 rounded shrink-0"></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <SmartLoadingState
                isLoading={isProximitySearchActive ? isLoading && filteredGeocaches.length === 0 : baseGeocaches.isLoading && baseGeocaches.data === undefined}
                isError={isProximitySearchActive ? !!error : baseGeocaches.isError}
                hasData={filteredGeocaches.length > 0 || baseGeocaches.data !== undefined}
                data={filteredGeocaches}
                error={(isProximitySearchActive ? error : baseGeocaches.error) as Error}
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
                      

                      
                      {((isProximitySearchActive ? isLoading : baseGeocaches.isLoading) && filteredGeocaches.length === 0) && (
                        <div className="flex items-center gap-1 text-xs">
                          <div className="animate-spin rounded-full h-3 w-3 border border-muted-foreground/30 border-t-muted-foreground"></div>
                          <span>searching...</span>
                        </div>
                      )}
                      {baseGeocaches.isFetching && (
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
                      className="h-8 px-3 hover:bg-muted/50 dark:bg-muted border-muted-foreground/20 transition-all duration-200"
                      title="Refresh geocaches (R)"
                      disabled={isRetrying}
                    >
                      <RefreshCw className={`h-3 w-3 mr-1 ${isRetrying ? 'animate-spin' : ''}`} />
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
                      statsLoading={baseGeocaches.isStatsLoading}
                    />
                  ))}
                </div>
              </div>
            </SmartLoadingState>
            )}
          </div>
        </div>

        {/* Map - render immediately with progressive geocache loading */}
        <div className="flex-1 relative bg-background min-h-0">
          <GeocacheMap 
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
          {(isProximitySearchActive ? isLoading : baseGeocaches.isLoading) && filteredGeocaches.length === 0 && (
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-20 bg-background/95 backdrop-blur-sm border rounded-full px-4 py-2 shadow-lg">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-muted-foreground/30 border-t-primary"></div>
                <span>Finding geocaches...</span>
              </div>
            </div>
          )}
          
          
        </div>
      </div>

      {/* Mobile View */}
      <div className="block lg:hidden fixed inset-0 flex flex-col" style={{ top: '4rem', bottom: '4rem' }}>
        {/* Adventure Mobile Filters Header */}
        <div className="bg-background/95 backdrop-blur-sm border-b flex-shrink-0 z-10">
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
            {/* List Tab - Always mounted but hidden when inactive */}
            <TabsContent value="list" className="flex-1 mt-0 m-0 p-0 data-[state=active]:flex data-[state=active]:flex-col bg-background overflow-hidden data-[state=inactive]:hidden">
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
                  isLoading={isProximitySearchActive ? isLoading && filteredGeocaches.length === 0 : baseGeocaches.isLoading && baseGeocaches.data === undefined}
                  isError={isProximitySearchActive ? !!error : baseGeocaches.isError}
                  hasData={filteredGeocaches.length > 0 || baseGeocaches.data !== undefined}
                  data={filteredGeocaches}
                  error={(isProximitySearchActive ? error : baseGeocaches.error) as Error}
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
                        {((isProximitySearchActive ? isLoading : baseGeocaches.isLoading) && filteredGeocaches.length === 0) && (
                          <div className="flex items-center gap-1 text-xs">
                            <div className="animate-spin rounded-full h-3 w-3 border border-muted-foreground/30 border-t-muted-foreground"></div>
                            <span>searching...</span>
                          </div>
                        )}
                        {baseGeocaches.isFetching && (
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
                        className="h-8 px-3 hover:bg-muted/50 dark:bg-muted border-muted-foreground/20 transition-all duration-200"
                        title="Refresh geocaches (R)"
                        disabled={isRetrying}
                      >
                        <RefreshCw className={`h-3 w-3 mr-1 ${isRetrying ? 'animate-spin' : ''}`} />
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
                        onClick={() => handleCardClick(cache)}
                        statsLoading={baseGeocaches.isStatsLoading}
                      />
                    ))}
                  </div>
                </div>
              </SmartLoadingState>
                </div>
              </div>
            </TabsContent>
            
            {/* Map Tab - Always mounted but hidden when inactive */}
            <TabsContent value="map" className="flex-1 mt-0 m-0 p-0 data-[state=active]:block data-[state=inactive]:hidden">
              <div className="h-full w-full bg-background relative">
                <GeocacheMap 
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
                {(isProximitySearchActive ? isLoading : baseGeocaches.isLoading) && filteredGeocaches.length === 0 && (
                  <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-20 bg-background/95 backdrop-blur-sm border rounded-full px-4 py-2 shadow-lg">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-muted-foreground/30 border-t-primary"></div>
                      <span>Finding geocaches...</span>
                    </div>
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
        onOpenChange={(open) => {
          setDialogOpen(open);
          // When dialog closes on mobile, switch back to list tab
          if (!open && activeTab === 'map') {
            setActiveTab('list');
          }
        }}
      />
    </div>
  );
}
