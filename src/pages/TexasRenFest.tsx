import { useState, useEffect, useRef } from "react";
import { useAppContext } from "@/shared/hooks/useAppContext";
import { MapPin, Sparkles } from "lucide-react";
import L from "leaflet";
import { Input } from "@/components/ui/input";
import { DesktopHeader } from "@/components/DesktopHeader";
import { useGeocaches } from "@/features/geocache/hooks/useGeocaches";
import { GeocacheMap } from "@/components/GeocacheMap";
import { CompactGeocacheCard } from "@/components/ui/geocache-card";
import { GeocacheDialog } from "@/components/GeocacheDialog";
import { FilterButton } from "@/components/FilterButton";
import type { Geocache } from "@/types/geocache";
import { useIsMobile } from "@/shared/hooks/useIsMobile";
import { MapViewTabs } from "@/components/ui/mobile-button-patterns";
import { TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { SmartLoadingState } from "@/components/ui/skeleton-patterns";
import { type ComparisonOperator } from "@/components/ui/comparison-filter";
import { useTheme } from "@/shared/hooks/useTheme";

// Texas Renaissance Festival coordinates
const TEXAS_REN_FEST_CENTER = {
  lat: 30.2672,
  lng: -95.7165
};

const TEXAS_REN_FEST_ZOOM = 16;

export default function TexasRenFest() {
  const { config } = useAppContext();
  const { setTheme, theme } = useTheme();
  const isMobile = useIsMobile();

  const [searchQuery, setSearchQuery] = useState("");
  const [difficulty, setDifficulty] = useState<number | undefined>(undefined);
  const [difficultyOperator, setDifficultyOperator] = useState<ComparisonOperator>("all");
  const [terrain, setTerrain] = useState<number | undefined>(undefined);
  const [terrainOperator, setTerrainOperator] = useState<ComparisonOperator>("all");
  const [cacheType, setCacheType] = useState<string | undefined>(undefined);

  const [selectedGeocache, setSelectedGeocache] = useState<Geocache | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [highlightedGeocache, setHighlightedGeocache] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("map");

  const mapRef = useRef<L.Map | null>(null);

  // Use the same geocaches hook as Map page
  const baseGeocaches = useGeocaches();

  // Force adventure theme on mount
  useEffect(() => {
    if (theme !== 'adventure') {
      setTheme('adventure');
    }
  }, [theme, setTheme]);

  // Use base geocaches with client-side filtering (no radius restriction)
  const filteredGeocaches = applyClientSideFilters(baseGeocaches.data || []);
  const isLoading = baseGeocaches.isLoading;
  const error = baseGeocaches.error;
  const refetch = baseGeocaches.refetch;

  // Client-side filtering function
  function applyClientSideFilters(caches: any[]) {
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

  const handleMarkerClick = (geocache: Geocache) => {
    setSelectedGeocache(geocache);
    setDialogOpen(true);
    setHighlightedGeocache(null);
  };

  const handleCardClick = (geocache: Geocache) => {
    if (isMobile && activeTab === 'list') {
      setSelectedGeocache(geocache);
      setDialogOpen(true);
      setActiveTab('map');
      return;
    }

    setHighlightedGeocache(geocache.dTag);

    if (typeof window !== 'undefined' && (window as any).handleMapCardClick) {
      (window as any).handleMapCardClick(
        { lat: geocache.location.lat, lng: geocache.location.lng },
        18
      );
    }
  };

  return (
    <div className="h-screen flex flex-col adventure">
      <DesktopHeader />

      {/* Hero Banner */}
      <div className="bg-gradient-to-r from-amber-900 via-amber-800 to-amber-900 text-white py-4 px-6 border-b-4 border-amber-700 shadow-lg flex-shrink-0">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Sparkles className="h-8 w-8 text-amber-300 animate-pulse" />
              <div>
                <h1 className="text-3xl font-bold mb-1">Texas Renaissance Festival</h1>
                <p className="text-amber-200 text-sm">Discover hidden treasures at the festival grounds</p>
              </div>
            </div>
            <Badge variant="secondary" className="bg-amber-700 text-white border-amber-600 hidden sm:flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Todd Mission, TX
            </Badge>
          </div>
        </div>
      </div>

      {/* Desktop View */}
      <div className="hidden lg:flex flex-1 overflow-hidden min-h-0">
        {/* Sidebar */}
        <div className="w-96 border-r bg-background flex flex-col">
          {/* Filters */}
          <div className="p-4 border-b bg-background/95 backdrop-blur-sm flex-shrink-0">
            <div className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Search festival caches..."
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


            </div>
          </div>

          {/* Results */}
          <div className="flex-1 overflow-y-auto min-h-0">
            <SmartLoadingState
              isLoading={isLoading && filteredGeocaches.length === 0}
              isError={!!error}
              hasData={filteredGeocaches.length > 0}
              data={filteredGeocaches}
              error={error as Error}
              onRetry={refetch}
              skeletonCount={3}
              skeletonVariant="compact"
              compact={true}
              showRelayFallback={true}
              className="h-full"
            >
              <div className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="text-sm text-muted-foreground">
                    {filteredGeocaches.length} festival cache{filteredGeocaches.length !== 1 ? 's' : ''}
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

        {/* Map */}
        <div className="flex-1 relative bg-background min-h-0">
          <GeocacheMap
            geocaches={filteredGeocaches}
            userLocation={null}
            searchLocation={null}
            searchRadius={25}
            center={TEXAS_REN_FEST_CENTER}
            zoom={TEXAS_REN_FEST_ZOOM}
            onMarkerClick={handleMarkerClick}
            onSearchInView={() => {}} // Disabled for festival page
            highlightedGeocache={highlightedGeocache || undefined}
            showStyleSelector={true}
            isNearMeActive={false}
            mapRef={mapRef}
            isMapCenterLocked={true}
          />
        </div>
      </div>

      {/* Mobile View */}
      <div className="block lg:hidden fixed inset-0 flex flex-col" style={{ top: '8rem', bottom: '4rem' }}>
        {/* Mobile Filters */}
        <div className="bg-background/95 backdrop-blur-sm border-b flex-shrink-0 z-10">
          <div className="p-3">
            <div className="space-y-3">
              <div className="flex gap-2">
                <Input
                  placeholder="Search festival caches..."
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
            {/* Map Tab */}
            <TabsContent value="map" className="flex-1 mt-0 m-0 p-0 data-[state=active]:block data-[state=inactive]:hidden">
              <div className="h-full w-full bg-background relative">
                <GeocacheMap
                  geocaches={filteredGeocaches}
                  userLocation={null}
                  searchLocation={null}
                  searchRadius={25}
                  center={TEXAS_REN_FEST_CENTER}
                  zoom={TEXAS_REN_FEST_ZOOM}
                  onMarkerClick={handleMarkerClick}
                  onSearchInView={() => {}} // Disabled
                  highlightedGeocache={highlightedGeocache || undefined}
                  showStyleSelector={true}
                  isNearMeActive={false}
                  mapRef={mapRef}
                  isMapCenterLocked={true}
                />
              </div>
            </TabsContent>

            {/* List Tab */}
            <TabsContent value="list" className="flex-1 mt-0 m-0 p-0 data-[state=active]:flex data-[state=active]:flex-col bg-background overflow-hidden data-[state=inactive]:hidden">
              <div className="flex-1 overflow-y-auto p-4 pb-6 min-h-0">
                <SmartLoadingState
                  isLoading={isLoading && filteredGeocaches.length === 0}
                  isError={!!error}
                  hasData={filteredGeocaches.length > 0}
                  data={filteredGeocaches}
                  error={error as Error}
                  onRetry={refetch}
                  skeletonCount={3}
                  skeletonVariant="compact"
                  compact={true}
                  showRelayFallback={true}
                  className="h-full"
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-muted-foreground">
                        {filteredGeocaches.length} festival cache{filteredGeocaches.length !== 1 ? 's' : ''}
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
          if (!open && activeTab === 'list') {
            setActiveTab('map');
          }
        }}
      />
    </div>
  );
}
