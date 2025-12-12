import { useState, useEffect, useRef } from "react";
import { useTranslation } from 'react-i18next';
import { MapPin, Sparkles } from "lucide-react";
import L from "leaflet";
import { DesktopHeader } from "@/components/DesktopHeader";
import { useGeocaches } from "@/features/geocache/hooks/useGeocaches";
import { GeocacheMap } from "@/components/GeocacheMap";
import { CompactGeocacheCard } from "@/components/ui/geocache-card";
import { GeocacheDialog } from "@/components/GeocacheDialog";
import { TreasureMapWelcomeModal } from "@/components/TreasureMapWelcomeModal";
import type { Geocache } from "@/types/geocache";
import { useIsMobile } from "@/shared/hooks/useIsMobile";
import { MapViewTabs } from "@/components/ui/mobile-button-patterns";
import { TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { SmartLoadingState } from "@/components/ui/skeleton-patterns";
import { useTheme } from "@/shared/hooks/useTheme";

// Texas Renaissance Festival coordinates
const TEXAS_REN_FEST_CENTER = {
  lat: 30.25423961135441,
  lng: -95.83969787081105
};

const TEXAS_REN_FEST_ZOOM = 17;
const TEXAS_REN_FEST_RADIUS = 2; // 2km radius to separate nearby vs elsewhere

// Helper function to calculate distance between two points in km
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;

  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function TexasRenFest() {
  const { t } = useTranslation();
  const { setTheme, theme } = useTheme();
  const isMobile = useIsMobile();

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

  // Use base geocaches (no filtering)
  const allCaches = baseGeocaches.data || [];

  // Separate caches into nearby (within radius) and elsewhere
  const nearbyCaches = allCaches.filter(cache => {
    const distance = calculateDistance(
      TEXAS_REN_FEST_CENTER.lat,
      TEXAS_REN_FEST_CENTER.lng,
      cache.location.lat,
      cache.location.lng
    );
    return distance <= TEXAS_REN_FEST_RADIUS;
  });

  const elsewhereCaches = allCaches.filter(cache => {
    const distance = calculateDistance(
      TEXAS_REN_FEST_CENTER.lat,
      TEXAS_REN_FEST_CENTER.lng,
      cache.location.lat,
      cache.location.lng
    );
    return distance > TEXAS_REN_FEST_RADIUS;
  });

  const filteredGeocaches = allCaches; // Show all on map
  const isLoading = baseGeocaches.isLoading;
  const error = baseGeocaches.error;
  const refetch = baseGeocaches.refetch;

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
      <TreasureMapWelcomeModal />
      <DesktopHeader />

      {/* Hero Banner */}
      <div className="bg-gradient-to-r from-amber-900 via-amber-800 to-amber-900 text-white border-b-4 border-amber-700 shadow-lg flex-shrink-0 sticky top-16 lg:static z-30">
        <div className="max-w-7xl mx-auto py-3 px-3 sm:py-4 sm:px-6">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
              <Sparkles className="h-6 w-6 sm:h-8 sm:w-8 text-amber-300 animate-pulse flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold mb-0 sm:mb-1 truncate">{t('texasRenFest.title')}</h1>
                <p className="text-amber-200 text-xs sm:text-sm hidden xs:block">{t('texasRenFest.subtitle')}</p>
              </div>
            </div>
            <Badge variant="secondary" className="bg-amber-700 text-white border-amber-600 hidden sm:flex items-center gap-2 flex-shrink-0">
              <MapPin className="h-4 w-4" />
              {t('texasRenFest.location')}
            </Badge>
          </div>
        </div>
      </div>

      {/* Desktop View */}
      <div className="hidden lg:flex flex-1 overflow-hidden min-h-0">
        {/* Sidebar */}
        <div className="w-96 border-r bg-background flex flex-col">
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
                {/* Nearby Caches */}
                {nearbyCaches.length > 0 && (
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-amber-600" />
                        {t('texasRenFest.festivalArea')}
                      </h3>
                      <span className="text-xs text-muted-foreground">
                        {t('texasRenFest.cacheCount', { count: nearbyCaches.length })}
                      </span>
                    </div>
                    <div className="space-y-3">
                      {nearbyCaches.map((cache) => (
                        <CompactGeocacheCard
                          key={cache.id}
                          cache={cache}
                          onClick={() => handleCardClick(cache)}
                          statsLoading={baseGeocaches.isStatsLoading}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Elsewhere Caches */}
                {elsewhereCaches.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-muted-foreground">
                        {t('texasRenFest.elsewhere')}
                      </h3>
                      <span className="text-xs text-muted-foreground">
                        {elsewhereCaches.length}
                      </span>
                    </div>
                    <div className="space-y-3">
                      {elsewhereCaches.map((cache) => (
                        <CompactGeocacheCard
                          key={cache.id}
                          cache={cache}
                          onClick={() => handleCardClick(cache)}
                          statsLoading={baseGeocaches.isStatsLoading}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* No caches message */}
                {nearbyCaches.length === 0 && elsewhereCaches.length === 0 && !isLoading && (
                  <div className="text-center py-8 text-muted-foreground">
                    <p className="text-sm">{t('texasRenFest.noCaches')}</p>
                  </div>
                )}
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
            onSearchInView={undefined} // Hide search in view button
            highlightedGeocache={highlightedGeocache || undefined}
            showStyleSelector={true}
            isNearMeActive={false}
            mapRef={mapRef}
            isMapCenterLocked={true}
          />
        </div>
      </div>

      {/* Mobile View */}
      <div className="block lg:hidden">
        {/* Mobile Content Area - Account for header (4rem) + banner (~3.75rem) + bottom nav (4rem) */}
        <div className="h-[calc(100vh-11.75rem)]">
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
                  onSearchInView={undefined} // Hide search in view button
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
                    {/* Nearby Caches */}
                    {nearbyCaches.length > 0 && (
                      <div className="mb-6">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-amber-600" />
                            {t('texasRenFest.festivalArea')}
                          </h3>
                          <span className="text-xs text-muted-foreground">
                            {t('texasRenFest.cacheCount', { count: nearbyCaches.length })}
                          </span>
                        </div>
                        <div className="space-y-3">
                          {nearbyCaches.map((cache) => (
                            <CompactGeocacheCard
                              key={cache.id}
                              cache={cache}
                              onClick={() => handleCardClick(cache)}
                              statsLoading={baseGeocaches.isStatsLoading}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Elsewhere Caches */}
                    {elsewhereCaches.length > 0 && (
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-sm font-semibold text-muted-foreground">
                            {t('texasRenFest.elsewhere')}
                          </h3>
                          <span className="text-xs text-muted-foreground">
                            {elsewhereCaches.length}
                          </span>
                        </div>
                        <div className="space-y-3">
                          {elsewhereCaches.map((cache) => (
                            <CompactGeocacheCard
                              key={cache.id}
                              cache={cache}
                              onClick={() => handleCardClick(cache)}
                              statsLoading={baseGeocaches.isStatsLoading}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* No caches message */}
                    {nearbyCaches.length === 0 && elsewhereCaches.length === 0 && !isLoading && (
                      <div className="text-center py-8 text-muted-foreground">
                        <p className="text-sm">{t('texasRenFest.noCaches')}</p>
                      </div>
                    )}
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
