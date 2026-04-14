import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { useAppContext } from "@/hooks/useAppContext";
import { useSearchParams } from "react-router-dom";
import { X, RefreshCw, Sparkles } from "lucide-react";
import L from "leaflet";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DesktopHeader } from "@/components/DesktopHeader";
import { useAdaptiveReliableGeocaches, type GeocacheWithDistance } from "@/hooks/useReliableProximitySearch";
import { useGeocaches } from "@/hooks/useGeocaches";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useInitialLocation } from "@/hooks/useInitialLocation";
import { GeocacheMap } from "@/components/GeocacheMap";
import { CompactGeocacheCard } from "@/components/ui/geocache-card";
import { GeocachePopupCard } from "@/components/GeocachePopupCard";
import { OmniSearch } from "@/components/OmniSearch";
import { MapViewTabs } from "@/components/ui/mobile-button-patterns";
import { type ComparisonOperator } from "@/components/FilterButton";
import { FilterButton } from "@/components/FilterButton";
import type { Geocache } from "@/types/geocache";
import { Badge } from "@/components/ui/badge";
import { SmartLoadingState } from "@/components/ui/skeleton-patterns";
import { cn } from "@/utils/utils";



export default function Map() {
  const { t } = useTranslation();
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
  const [, setShowMobileSearchOptions] = useState(false);


  const [selectedGeocache, setSelectedGeocache] = useState<Geocache | null>(null);
  const [popupContainer, setPopupContainer] = useState<HTMLDivElement | null>(null);
  const [highlightedGeocache, setHighlightedGeocache] = useState<string | null>(null);

  // Initialize activeTab based on URL parameter to avoid flicker
  const initialTab = (() => {
    const tab = searchParams.get('tab');
    if (tab === 'list' || tab === 'map') {
      return tab;
    }
    // Default to map if coordinates are provided, otherwise list
    const lat = searchParams.get('lat');
    const lng = searchParams.get('lng');
    if (lat && lng) {
      return 'map';
    }
    return 'list';
  })();
  const [activeTab, setActiveTab] = useState<string>(initialTab);

  const mapRef = useRef<L.Map | null>(null);

  const { loading: isGettingLocation, coords, getLocation } = useGeolocation();
  const { location: initialLocation, isLoading: isLoadingInitialLocation } = useInitialLocation();

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

  // Set initial map center when initial location is detected
  useEffect(() => {
    // Only set if no center has been set yet and not loading
    if (!mapCenter && !isLoadingInitialLocation && initialLocation) {
      setMapCenter(initialLocation);
    }
  }, [initialLocation, isLoadingInitialLocation, mapCenter]);

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
    setShowMobileSearchOptions(true); // Expand search options on mobile
    setHighlightedGeocache(null); setHighlightedGeocache(null); setHighlightedGeocache(null); // Clear any highlighted geocache
  };

  const handleNearMe = async () => {
    // This is an explicit user action - clear all interaction locks
    clearMapInteractionLock();

    // Toggle off if already active
    if (showNearMe) {
      setShowNearMe(false);
      setSearchLocation(null);
      setSearchInView(false);
      setShowMobileSearchOptions(false);
      return;
    }

    setShowNearMe(true);
    setSearchLocation(null); // Clear search location
    setSearchInView(false); // Clear search in view
    setShowMobileSearchOptions(true); // Expand search options on mobile

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

  const handleSearchInView = (bounds?: L.LatLngBounds) => {
    // This is an explicit user action - clear all interaction locks
    clearMapInteractionLock();

    // Get current map bounds from the map ref or from parameter
    const mapBounds = bounds || (mapRef.current ? mapRef.current.getBounds() : null);

    if (mapBounds) {
      const center = mapBounds.getCenter();

      // Calculate approximate radius from bounds
      const northEast = mapBounds.getNorthEast();
      const southWest = mapBounds.getSouthWest();
      const radiusKm = Math.max(
        calculateDistance(center.lat, center.lng, northEast.lat, northEast.lng),
        calculateDistance(center.lat, center.lng, southWest.lat, southWest.lng)
      );

      setSearchInView(true);
      setShowNearMe(false); // Clear near me
      setSearchLocation({ lat: center.lat, lng: center.lng });
      setSearchRadius(Math.ceil(radiusKm));
      setShowMobileSearchOptions(true); // Expand search options on mobile

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

  const handleMarkerClick = (geocache: Geocache, container?: HTMLDivElement) => {
    if (!geocache && !container) {
      // Popup closed
      setSelectedGeocache(null);
      setPopupContainer(null);
      return;
    }
    setSelectedGeocache(geocache);
    setPopupContainer(container || null);
    setHighlightedGeocache(null);
  };

  const handleCardClick = (geocache: Geocache) => {
    // This is an explicit user action - clear all interaction locks
    clearMapInteractionLock();

    // Move the map to the geocache via useMapController
    setMapCenter({ lat: geocache.location.lat, lng: geocache.location.lng });
    setMapZoom(17);

    // Clear any location-based searches to prevent conflicts
    setShowNearMe(false);
    setSearchLocation(null);
    setSearchInView(false);

    // Reset highlighted geocache first to ensure PopupController detects the change
    // even if clicking the same geocache again, then set the new value.
    setHighlightedGeocache(null);
    queueMicrotask(() => {
      setHighlightedGeocache(geocache.dTag);
    });

    // Use the map controller for immediate navigation
    if (typeof window !== 'undefined' && (window as any).handleMapCardClick) {
      (window as any).handleMapCardClick(
        { lat: geocache.location.lat, lng: geocache.location.lng },
        17
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
          <div className="p-4 bg-background/95 backdrop-blur-sm flex-shrink-0">
            <div className="space-y-2">
              <div className="flex gap-2">
                <OmniSearch
                  onLocationSelect={handleLocationSelect}
                  onGeocacheSelect={(cache) => handleCardClick(cache)}
                  onTextSearch={setSearchQuery}
                  geocaches={filteredGeocaches}
                  placeholder={t('map.omniSearch.placeholder')}
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

              {(showNearMe || searchLocation || searchInView) && (
                  <div className="flex items-center justify-between bg-muted/50 rounded-lg p-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{t('map.searchRadius.label')}</span>
                      <Select value={searchRadius.toString()} onValueChange={(v) => setSearchRadius(Number(v) || 25)}>
                        <SelectTrigger className="w-20 h-7 text-xs">
                          <SelectValue placeholder={t('map.searchRadius.options.25')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">{t('map.searchRadius.options.1')}</SelectItem>
                          <SelectItem value="5">{t('map.searchRadius.options.5')}</SelectItem>
                          <SelectItem value="10">{t('map.searchRadius.options.10')}</SelectItem>
                          <SelectItem value="25">{t('map.searchRadius.options.25')}</SelectItem>
                          <SelectItem value="50">{t('map.searchRadius.options.50')}</SelectItem>
                          <SelectItem value="100">{t('map.searchRadius.options.100')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => {
                        setShowNearMe(false);
                        setSearchLocation(null);
                        setSearchInView(false);
                      }}
                    >
                      <X className="h-3 w-3 mr-1" />
                      {t('map.clear')}
                    </Button>
                  </div>
                )}
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
                      <div className="bg-card rounded-lg border p-3">
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 bg-muted rounded-full shrink-0"></div>
                          <div className="flex-1 min-w-0 space-y-2">
                            <div className="h-4 w-3/4 bg-muted rounded"></div>
                            <div className="h-3 w-1/2 bg-muted rounded"></div>
                            <div className="flex gap-1">
                              <div className="h-5 w-8 bg-muted rounded"></div>
                              <div className="h-5 w-8 bg-muted rounded"></div>
                              <div className="h-5 w-12 bg-muted rounded"></div>
                            </div>
                          </div>
                          <div className="w-7 h-7 bg-muted rounded shrink-0"></div>
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
                {/* Only show count when filters are active */}
                {(searchQuery || difficulty !== undefined || terrain !== undefined || cacheType || isProximitySearchActive) && (
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-sm text-muted-foreground">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span>
                          {filteredGeocaches.length === 1
                            ? t('map.results.count', { count: filteredGeocaches.length })
                            : t('map.results.countPlural', { count: filteredGeocaches.length })
                          }
                          {isProximitySearchActive && ` • ${t('map.results.radius', { radius: searchRadius })}`}
                        </span>


                      </div>
                    </div>
                  </div>
                )}
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
        <div className="flex-1 relative min-h-0">
          <GeocacheMap
            geocaches={filteredGeocaches}
            userLocation={userLocation}
            searchLocation={searchLocation || (showNearMe ? userLocation : null)}
            searchRadius={searchRadius}
            center={mapCenter || undefined}
            zoom={mapZoom}
            onMarkerClick={handleMarkerClick}
            onSearchInView={handleSearchInView}
            onNearMe={handleNearMe}
            highlightedGeocache={highlightedGeocache || undefined}
            showStyleSelector={true}
            isNearMeActive={showNearMe}
            isGettingLocation={isGettingLocation}
            mapRef={mapRef}
            isMapCenterLocked={isMapCenterLocked}
          />




        </div>
      </div>

      {/* Mobile View */}
      <div className="block lg:hidden fixed inset-0 flex flex-col" style={{ top: '3rem', bottom: '4rem' }}>
        {/* Mobile Content Area - Full height */}
        <div className="flex-1 overflow-hidden relative">
          <MapViewTabs
            className="h-full"
            value={activeTab}
            onValueChange={setActiveTab}
          >
            {/* List View - Always mounted but hidden when inactive */}
            <div className={cn("h-full flex flex-col bg-background overflow-hidden", activeTab !== 'list' && "hidden")}>
              {/* Search Bar for List View */}
              <div className="bg-background/95 backdrop-blur-sm flex-shrink-0">
                <div className="p-3">
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <OmniSearch
                        onLocationSelect={handleLocationSelect}
                        onGeocacheSelect={(cache) => handleCardClick(cache)}
                        onTextSearch={setSearchQuery}
                        geocaches={filteredGeocaches}
                        placeholder={t('map.omniSearch.placeholder')}
                        mobilePlaceholder={t('map.omniSearch.mobilePlaceholder')}
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

                    {(showNearMe || searchLocation || searchInView) && (
                      <div className="flex items-center justify-between bg-muted/50 rounded-lg p-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{t('map.searchRadius.label')}</span>
                          <Select value={searchRadius.toString()} onValueChange={(v) => setSearchRadius(Number(v) || 25)}>
                            <SelectTrigger className="w-20 h-7 text-xs">
                              <SelectValue placeholder={t('map.searchRadius.options.25')} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="1">{t('map.searchRadius.options.1')}</SelectItem>
                              <SelectItem value="5">{t('map.searchRadius.options.5')}</SelectItem>
                              <SelectItem value="10">{t('map.searchRadius.options.10')}</SelectItem>
                              <SelectItem value="25">{t('map.searchRadius.options.25')}</SelectItem>
                              <SelectItem value="50">{t('map.searchRadius.options.50')}</SelectItem>
                              <SelectItem value="100">{t('map.searchRadius.options.100')}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => {
                            setShowNearMe(false);
                            setSearchLocation(null);
                            setSearchInView(false);
                            setShowMobileSearchOptions(false);
                          }}
                        >
                          <X className="h-3 w-3 mr-1" />
                          {t('map.clear')}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

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
                          ? t('map.pullToRefresh.refreshing')
                          : pullDistance >= pullThreshold
                            ? t('map.pullToRefresh.release')
                            : t('map.pullToRefresh.pull')
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
                <div className="space-y-3">
                  {/* Only show count when filters are active */}
                  {(searchQuery || difficulty !== undefined || terrain !== undefined || cacheType || isProximitySearchActive) && (
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <span>
                            {filteredGeocaches.length === 1
                              ? t('map.results.count', { count: filteredGeocaches.length })
                              : t('map.results.countPlural', { count: filteredGeocaches.length })
                            }
                            {isProximitySearchActive && ` • ${t('map.results.radius', { radius: searchRadius })}`}
                            {searchInView && ` • ${t('map.results.inView')}`}
                          </span>

                        </div>
                      </div>
                      {isProximitySearchActive && (
                        <Badge
                          variant={proximitySuccessful ? "secondary" : "outline"}
                          className="text-xs flex items-center gap-1"
                          title={proximityAttempted ? (proximitySuccessful ? t('map.proximity.success') : t('map.proximity.failed')) : t('map.proximity.broad')}
                        >
                          <Sparkles className="h-2 w-2" />
                          {proximitySuccessful ? t('map.badge.smart') : searchStrategy === "fallback" ? t('map.badge.fallback') : t('map.badge.broad')}
                        </Badge>
                      )}
                    </div>
                  )}
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
            </div>

            {/* Map View - Always mounted but hidden when inactive */}
            <div className={cn("h-full w-full bg-background relative", activeTab !== 'map' && "hidden")}>
                {/* Floating Search Bar - positioned over the map */}
                <div className="absolute top-3 left-3 right-3 z-[999] pointer-events-none">
                  <div className="space-y-2 pointer-events-auto">
                    <div className="flex gap-2">
                          <OmniSearch
                            onLocationSelect={handleLocationSelect}
                            onGeocacheSelect={(cache) => handleCardClick(cache)}
                            onTextSearch={setSearchQuery}
                            geocaches={filteredGeocaches}
                            placeholder={t('map.omniSearch.placeholder')}
                            mobilePlaceholder={t('map.omniSearch.mobilePlaceholder')}
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

                    {(showNearMe || searchLocation || searchInView) && (
                      <div className="flex items-center justify-between bg-background/95 backdrop-blur-sm shadow-lg border rounded-lg p-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{t('map.searchRadius.label')}</span>
                          <Select value={searchRadius.toString()} onValueChange={(v) => setSearchRadius(Number(v) || 25)}>
                            <SelectTrigger className="w-20 h-7 text-xs">
                              <SelectValue placeholder={t('map.searchRadius.options.25')} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="1">{t('map.searchRadius.options.1')}</SelectItem>
                              <SelectItem value="5">{t('map.searchRadius.options.5')}</SelectItem>
                              <SelectItem value="10">{t('map.searchRadius.options.10')}</SelectItem>
                              <SelectItem value="25">{t('map.searchRadius.options.25')}</SelectItem>
                              <SelectItem value="50">{t('map.searchRadius.options.50')}</SelectItem>
                              <SelectItem value="100">{t('map.searchRadius.options.100')}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => {
                            setShowNearMe(false);
                            setSearchLocation(null);
                            setSearchInView(false);
                            setShowMobileSearchOptions(false);
                          }}
                        >
                          <X className="h-3 w-3 mr-1" />
                          {t('map.clear')}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                <GeocacheMap
                  geocaches={filteredGeocaches}
                  userLocation={userLocation}
                  searchLocation={searchLocation || (showNearMe ? userLocation : null)}
                  searchRadius={searchRadius}
                  center={mapCenter || undefined}
                  zoom={mapZoom}
                  onMarkerClick={handleMarkerClick}
                  onSearchInView={handleSearchInView}
                  onNearMe={handleNearMe}
                  highlightedGeocache={highlightedGeocache || undefined}
                  showStyleSelector={true}
                  isNearMeActive={showNearMe}
                  isGettingLocation={isGettingLocation}
                  mapRef={mapRef}
                  isMapCenterLocked={isMapCenterLocked}
                  isVisible={activeTab === 'map'}
                />


            </div>
          </MapViewTabs>
        </div>
      </div>

      {/* React portal into Leaflet popup */}
      {selectedGeocache && popupContainer && createPortal(
        <GeocachePopupCard
          geocache={selectedGeocache}
          onClose={() => {
            setSelectedGeocache(null);
            setPopupContainer(null);
            // Close the Leaflet popup
            if (mapRef.current) {
              mapRef.current.closePopup();
            }
          }}
        />,
        popupContainer
      )}
    </div>
  );
}
