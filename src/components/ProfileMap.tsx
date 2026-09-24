import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useTheme } from "@/hooks/useTheme";
import { CustomZoomControl } from "@/components/map/CustomZoomControl";
import { MapView } from "@/components/map/MapView";
import { ClusteredMarkers, type ClusterPoint } from "@/components/map/ClusteredMarkers";
import { ThemeController } from "@/components/map/GeocacheMapControllers";
import { useMapHandle } from "@/components/map/mapContext";
import { openReactPopup } from "@/components/map/popupPositioning";
import { MAP_STYLES, type MapStyle } from "@/config/mapStyles";
import type { Geocache } from "@/types/geocache";
import { getCachedCacheIcon, mapStyleToIconTheme, type MapIconTheme } from "@/utils/cacheMapIcons";
import { isLightningPiggyClient } from "@/utils/nip-gc";
import { getLockdownFeatures } from "@/utils/lockdownMode";

// Map marker icons come from the shared helper in `@/utils/cacheMapIcons`
// so ProfileMap and GeocacheMap stay in sync.

interface ProfileMapProps {
  geocaches: Geocache[];
  onGeocacheClick?: (geocache: Geocache) => void;
  onMarkerClick?: (geocache: Geocache, popupContainer?: HTMLDivElement) => void;
}

type LocatedGeocache = Geocache & { location: { lat: number; lng: number } };

function ProfileMarkers({
  geocaches,
  iconTheme,
  onGeocacheClick,
  onMarkerClick,
}: {
  geocaches: LocatedGeocache[];
  iconTheme: MapIconTheme;
  onGeocacheClick?: (geocache: Geocache) => void;
  onMarkerClick?: (geocache: Geocache, popupContainer?: HTMLDivElement) => void;
}) {
  const map = useMapHandle();
  const onMarkerClickRef = useRef(onMarkerClick);
  onMarkerClickRef.current = onMarkerClick;
  const onGeocacheClickRef = useRef(onGeocacheClick);
  onGeocacheClickRef.current = onGeocacheClick;

  const byDTag = useMemo(() => new Map(geocaches.map(g => [g.dTag, g])), [geocaches]);

  const points = useMemo<ClusterPoint[]>(() => geocaches.map(geocache => ({
    id: geocache.dTag,
    lat: geocache.location.lat,
    lng: geocache.location.lng,
    icon: getCachedCacheIcon(geocache.type, iconTheme, false, geocache.lightningEnabled ?? false, isLightningPiggyClient(geocache.client)),
    title: geocache.name,
  })), [geocaches, iconTheme]);

  // Handle marker click - create React popup container
  const handlePointClick = useCallback((point: ClusterPoint) => {
    const geocache = byDTag.get(point.id);
    if (!geocache) return;

    // Close all existing popups
    map.closePopup();

    if (onMarkerClickRef.current) {
      // React popup approach - same as main map
      const { container } = openReactPopup(map, {
        position: geocache.location,
        anchor: point.icon.popupAnchor,
        maxWidth: 400,
        onClose: () => onMarkerClickRef.current?.(null as unknown as Geocache, null as unknown as HTMLDivElement),
      });
      onMarkerClickRef.current(geocache, container);
    } else {
      onGeocacheClickRef.current?.(geocache);
    }
  }, [map, byDTag]);

  return (
    <ClusteredMarkers
      points={points}
      onPointClick={handlePointClick}
      radius={22}
      disableClusteringAtZoom={14}
      maxZoom={18}
    />
  );
}

export function ProfileMap({ geocaches, onGeocacheClick, onMarkerClick }: ProfileMapProps) {
  const { theme, systemTheme } = useTheme();
  const [isMapReady, setIsMapReady] = useState(false);

  // Filter geocaches that have valid locations
  const validGeocaches = useMemo(() => {
    return geocaches.filter(
      (g): g is typeof g & { location: { lat: number; lng: number } } =>
        !!g.location && !!g.location.lat && !!g.location.lng,
    );
  }, [geocaches]);

  // Determine if we should use dark mode for the map
  const getDefaultMapStyle = () => {
    // First check app theme setting
    if (theme === "dark") {
      return "dark";
    } else if (theme === "light") {
      return "original";
    } else if (theme === "adventure") {
      return "adventure";
    } else if (theme === "mojave") {
      return "mojave";
    } else if (theme === "system") {
      // Use system preference if theme is set to system
      return systemTheme === "dark" ? "dark" : "original";
    }

    // Fallback to system preference if theme is undefined (during mounting)
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return "dark";
    }
    return "original";
  };

  const [currentMapStyle, setCurrentMapStyle] = useState(getDefaultMapStyle());
  const mapStyle: MapStyle = (MAP_STYLES[currentMapStyle] || MAP_STYLES.original) as MapStyle;

  // Listen for app theme changes and system theme changes
  useEffect(() => {
    const newDefaultStyle = () => {
      if (theme === "dark") {
        return "dark";
      } else if (theme === "light") {
        return "original";
      } else if (theme === "adventure") {
        return "adventure";
      } else if (theme === "mojave") {
        return "mojave";
      } else if (theme === "system") {
        return systemTheme === "dark" ? "dark" : "original";
      }

      // Fallback to system preference
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return "dark";
      }
      return "original";
    };

    const newStyle = newDefaultStyle();
    if (currentMapStyle !== newStyle) {
      setCurrentMapStyle(newStyle);
    }
  }, [theme, systemTheme, currentMapStyle]);

  // Also listen for system theme changes as backup
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleThemeChange = (e: MediaQueryListEvent) => {
      // Only respond to system changes if app theme is set to system or undefined
      if (theme === "system" || !theme) {
        const newDefaultStyle = e.matches ? "dark" : "original";
        if (currentMapStyle !== newDefaultStyle) {
          setCurrentMapStyle(newDefaultStyle);
        }
      }
    };

    mediaQuery.addEventListener('change', handleThemeChange);
    return () => mediaQuery.removeEventListener('change', handleThemeChange);
  }, [theme, currentMapStyle]);

  // Calculate appropriate center and zoom
  const mapConfig = useMemo(() => {
    if (validGeocaches.length === 0) {
      return {
        center: [40.7128, -74.0060] as [number, number], // Default to NYC
        zoom: 10
      };
    }

    if (validGeocaches.length === 1) {
      return {
        center: [validGeocaches[0]!.location.lat, validGeocaches[0]!.location.lng] as [number, number],
        zoom: 12
      };
    }

    // Calculate bounds for multiple geocaches
    const lats = validGeocaches.map(g => g.location.lat);
    const lngs = validGeocaches.map(g => g.location.lng);

    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    const centerLat = (minLat + maxLat) / 2;
    const centerLng = (minLng + maxLng) / 2;

    // Always start at world level zoom for profile map
    const zoom = 2; // World view

    return {
      center: [centerLat, centerLng] as [number, number],
      zoom
    };
  }, [validGeocaches]);

  // Detect iOS Lockdown Mode and adjust features accordingly
  const lockdownFeatures = useMemo(() => getLockdownFeatures(), []);

  if (validGeocaches.length === 0) {
    return (
      <div className="w-full h-96 bg-muted/20 rounded-lg border flex items-center justify-center">
        <div className="text-center">
          <div className="text-muted-foreground mb-2">
            <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
          </div>
          <p className="text-sm text-muted-foreground">No geocaches to display on map</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative w-full h-96 rounded-lg overflow-hidden border"
      style={{
        backgroundColor: '#f8fafc',
      }}
    >
      {/* Clean Adventure-style Map — skip blend-mode overlays in Lockdown Mode */}
      {currentMapStyle === 'adventure' && lockdownFeatures.mixBlendMode && (
        <>
          {/* Strong parchment overlay */}
          <div
            className="absolute inset-0 pointer-events-none adventure-parchment-overlay"
            style={{
              backgroundColor: '#d2b48c',
              mixBlendMode: 'color',
              opacity: 0.5,
              zIndex: 1
            }}
          />

          {/* Subtle border overlay */}
          <div
            className="absolute inset-0 pointer-events-none adventure-border-overlay"
            style={{
              backgroundColor: 'slategray',
              mixBlendMode: 'color-burn',
              opacity: 0.6,
              zIndex: 2
            }}
          />
        </>
      )}

      {/* Map Loading Indicator */}
      {!isMapReady && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-20 bg-background/95 backdrop-blur-sm border rounded-full px-4 py-2 shadow-lg">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-muted-foreground/30 border-t-primary"></div>
            <span>Loading map...</span>
          </div>
        </div>
      )}

      <MapView
        center={mapConfig.center}
        zoom={mapConfig.zoom}
        minZoom={2}
        maxZoom={18}
        mapStyle={mapStyle}
        keyboard={false}
        className="z-0"
        onLoad={() => setIsMapReady(true)}
        onUnavailable={() => setIsMapReady(true)}
      >
        <CustomZoomControl />
        <ThemeController
          currentStyle={currentMapStyle}
          appTheme={theme}
          systemTheme={systemTheme}
        />

        {/* Geocache markers with clustering */}
        <ProfileMarkers
          geocaches={validGeocaches}
          iconTheme={mapStyleToIconTheme(currentMapStyle)}
          onGeocacheClick={onGeocacheClick}
          onMarkerClick={onMarkerClick}
        />
      </MapView>
    </div>
  );
}