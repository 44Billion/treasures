import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useTheme } from "@/hooks/useTheme";
import { CustomZoomControl } from "./map/CustomZoomControl";
import { MAP_STYLES, type MapStyle } from "@/config/mapStyles";
import { useGeocacheNavigation } from "@/hooks/useGeocacheNavigation";
import { useInitialLocation } from "@/hooks/useInitialLocation";
import type { Geocache } from "@/types/geocache";
import type { Adventure } from "@/types/adventure";
import { getCachedCacheIcon, getCachedClaimedFtfIcon, mapStyleToIconTheme, type MapIconTheme } from "@/utils/cacheMapIcons";
import { isLightningPiggyClient } from "@/utils/nip-gc";
import { getLockdownFeatures } from "@/utils/lockdownMode";
import { MapView } from "./map/MapView";
import { MapMarker } from "./map/MapMarker";
import { MapCircle } from "./map/MapCircle";
import { ClusteredMarkers, type ClusterPoint } from "./map/ClusteredMarkers";
import { useMapHandle } from "./map/mapContext";
import type { MapBounds, MapHandle } from "./map/mapHandle";

// Map marker icons are provided by the shared helper in `@/utils/cacheMapIcons`
// so GeocacheMap and ProfileMap don't drift out of sync when new themes land.

// Special-purpose marker icons (user location pulse, adventure sparkles)
import { userLocationIcon, adventureMarkerIcon, centerPinIcon } from "./map/geocacheMapMarkerIcons";
// Invisible controller components wiring imperative map behavior
import {
  MapController,
  ThemeController,
  PopupController,
  MapSizeController,
  MapRefController,
  MapClickHandler,
} from "./map/GeocacheMapControllers";
// Floating button controls (style selector, near-me, compass, earth view)
import {
  MapStyleControl,
  NearMeButtonControl,
  CompassMapButtonControl,
  EarthViewButtonControl,
} from "./map/GeocacheMapControls";
// Satellite deep-zoom fallback
import { SatelliteZoomFallback } from "./map/GeocacheMapLayers";
// React-content popups with UI-aware auto-pan
import { openReactPopup } from "./map/popupPositioning";

interface GeocacheMapProps {
  geocaches: Geocache[];
  center?: { lat: number; lng: number };
  zoom?: number;
  userLocation?: { lat: number; lng: number } | null;
  searchLocation?: { lat: number; lng: number } | null;
  searchRadius?: number; // in km
  onMarkerClick?: (geocache: Geocache, popupContainer?: HTMLDivElement) => void;
  onSearchInView?: (bounds: MapBounds) => void; // Callback for search in view functionality
  onNearMe?: () => void; // Callback for near me functionality
  highlightedGeocache?: string; // dTag of geocache to highlight/open popup
  showStyleSelector?: boolean; // Whether to show the map style selector
  isNearMeActive?: boolean; // Whether "Near Me" mode is active
  isGettingLocation?: boolean; // Whether location is being retrieved
  mapRef?: React.RefObject<MapHandle | null>; // Reference to the map instance
  isMapCenterLocked?: boolean; // Whether map center is locked from user interaction
  isVisible?: boolean; // Whether the map is currently visible (for handling tab switches on mobile)
  onOpenRadar?: () => void; // Callback to open the radar compass overlay
  onShowEarth?: () => void; // Callback to zoom out to earth view and clear near me
  onShowList?: () => void; // Offered when the map can't be shown (e.g. no WebGL2), to browse the list instead
  onMapClick?: (location: { lat: number; lng: number }) => void; // Callback for map click (e.g. adventure center selection)
  initialMapStyle?: string; // Override the default map style (e.g. from adventure event)
  adventures?: Adventure[]; // Adventure markers to display alongside geocaches
  onAdventureMarkerClick?: (adventure: Adventure, popupContainer?: HTMLDivElement) => void;
  layoutKey?: string | boolean; // Changes to this value trigger a map resize — use when container size changes without a window resize
  /**
   * Set of cache keys (`${kind}:${pubkey}:${dTag}`) for first-to-find
   * treasures that have been claimed (a verified found log exists, or the
   * F tag is locked). Claimed FTF markers receive a small trophy badge
   * overlay so every viewer can see at a glance which prizes are still
   * available. Used by adventure detail views.
   */
  claimedFtfCacheKeys?: Set<string>;
}

// Markers render at most this many treasures
const MAX_MARKERS = 200;

const normalizeLng = (lng: number) => ((lng + 180) % 360 + 360) % 360 - 180;

/** Geocache markers (clustered) plus the popup wiring for clicks and highlights. */
function GeocacheMarkers({
  geocaches,
  iconTheme,
  claimedFtfCacheKeys,
  highlightedGeocache,
  onMarkerClick,
}: {
  geocaches: Geocache[];
  iconTheme: MapIconTheme;
  claimedFtfCacheKeys?: Set<string>;
  highlightedGeocache?: string;
  onMarkerClick: (geocache: Geocache | null, popupContainer?: HTMLDivElement) => void;
}) {
  const map = useMapHandle();

  // Stable ref so marker click handlers don't change identity
  const onMarkerClickRef = useRef(onMarkerClick);
  onMarkerClickRef.current = onMarkerClick;

  const iconFor = useCallback((geocache: Geocache) => {
    // Choose the claimed-FTF marker when the caller has flagged this
    // treasure as won. Falls back to the standard themed marker so
    // non-adventure consumers (Map page, etc.) are unaffected.
    const cacheKey = `${geocache.kind ?? 37516}:${geocache.pubkey}:${geocache.dTag}`;
    const isClaimed = claimedFtfCacheKeys?.has(cacheKey) ?? false;
    // Art treasures get a Palette glyph on the marker so they read as
    // special at a glance — independent of cache type or FTF status.
    const isArt = geocache.modifiers?.includes('art') ?? false;
    // Lightning-enabled treasures (payout-lnurl-w label) get a small bolt
    // badge so finders can spot sat-paying caches directly on the map.
    const isLightning = geocache.lightningEnabled ?? false;
    // Lightning Piggy treasures (client tag) render a pig glyph on a pink
    // marker so piggy treasures are recognizable at a glance.
    const isPiggy = isLightningPiggyClient(geocache.client);
    return isClaimed
      ? getCachedClaimedFtfIcon(geocache.type, iconTheme, isArt, isLightning, isPiggy)
      : getCachedCacheIcon(geocache.type, iconTheme, isArt, isLightning, isPiggy);
  }, [iconTheme, claimedFtfCacheKeys]);

  const mappable = useMemo(() => {
    const seen = new Set<string>();
    return geocaches
      .filter(g => g.location && g.dTag && !seen.has(g.dTag) && seen.add(g.dTag))
      .slice(0, MAX_MARKERS);
  }, [geocaches]);

  const byDTag = useMemo(() => new Map(mappable.map(g => [g.dTag, g])), [mappable]);

  const points = useMemo<ClusterPoint[]>(() => mappable.map(geocache => ({
    id: geocache.dTag,
    lat: geocache.location!.lat,
    lng: normalizeLng(geocache.location!.lng),
    icon: iconFor(geocache),
    title: geocache.name,
    alt: `${geocache.type} treasure: ${geocache.name}`,
  })), [mappable, iconFor]);

  const openPopup = useCallback((geocache: Geocache) => {
    if (!geocache.location) return;
    const { container } = openReactPopup(map, {
      position: { lat: geocache.location.lat, lng: normalizeLng(geocache.location.lng) },
      anchor: iconFor(geocache).popupAnchor,
      maxWidth: 400,
      // Signal popup-dismissed to the parent (null geocache). The handler
      // short-circuits when no parent onMarkerClick is wired up, so this is
      // safe during map teardown on pages like the cache detail view that
      // don't consume this signal.
      onClose: () => onMarkerClickRef.current(null),
    });
    onMarkerClickRef.current(geocache, container);
  }, [map, iconFor]);

  const handlePointClick = useCallback((point: ClusterPoint) => {
    const geocache = byDTag.get(point.id);
    if (geocache) openPopup(geocache);
  }, [byDTag, openPopup]);

  return (
    <>
      <PopupController
        highlightedGeocache={highlightedGeocache}
        geocaches={geocaches}
        openPopup={openPopup}
      />
      <ClusteredMarkers
        points={points}
        onPointClick={handlePointClick}
        radius={22} // Smaller cluster radius keeps nearby caches visually distinct
        disableClusteringAtZoom={14} // Show individual markers earlier when zooming in
        maxZoom={21}
      />
    </>
  );
}

/** Adventure markers — rendered outside the cluster group with distinct icons. */
function AdventureMarkers({
  adventures,
  onAdventureMarkerClick,
}: {
  adventures: Adventure[];
  onAdventureMarkerClick?: (adventure: Adventure, popupContainer?: HTMLDivElement) => void;
}) {
  const map = useMapHandle();
  const handlerRef = useRef(onAdventureMarkerClick);
  handlerRef.current = onAdventureMarkerClick;

  const handleClick = useCallback((adventure: Adventure) => {
    map.closePopup();
    if (!handlerRef.current || !adventure.location) return;
    const { container } = openReactPopup(map, {
      position: adventure.location,
      anchor: adventureMarkerIcon.popupAnchor,
      maxWidth: 340,
      onClose: () => handlerRef.current?.(null as unknown as Adventure, undefined),
    });
    handlerRef.current(adventure, container);
  }, [map]);

  return (
    <>
      {adventures
        .filter(a => a.location?.lat && a.location?.lng)
        .map((adventure) => (
          <MapMarker
            key={`adventure-${adventure.dTag}`}
            position={adventure.location!}
            icon={adventureMarkerIcon}
            title={adventure.title || 'Adventure'}
            alt={`Adventure: ${adventure.title || adventure.dTag}`}
            onClick={() => handleClick(adventure)}
          />
        ))}
    </>
  );
}

export function GeocacheMap({
  geocaches,
  center,
  zoom = 10,
  userLocation,
  searchLocation,
  searchRadius,
  onMarkerClick,
  onSearchInView: _,
  onNearMe,
  highlightedGeocache,
  showStyleSelector = true,
  isNearMeActive = false,
  isGettingLocation = false,
  mapRef,
  isMapCenterLocked = false,
  isVisible = true,
  onOpenRadar,
  onShowEarth,
  onShowList,
  onMapClick,
  initialMapStyle,
  adventures,
  onAdventureMarkerClick,
  layoutKey,
  claimedFtfCacheKeys,
}: GeocacheMapProps) {
  const { navigateToGeocache } = useGeocacheNavigation();
  const { theme, systemTheme } = useTheme();
  const [isMapInitialized, setIsMapInitialized] = useState(false);

  // Determine if we should use dark mode for the map
  const getDefaultMapStyle = () => {
    // Use initialMapStyle if provided (e.g. from adventure event)
    if (initialMapStyle && MAP_STYLES[initialMapStyle]) {
      return initialMapStyle;
    }

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
  const [hasManuallySelectedStyle, setHasManuallySelectedStyle] = useState(false);
  const mapStyle: MapStyle = (MAP_STYLES[currentMapStyle] || MAP_STYLES.original) as MapStyle;

  // Handle manual style changes
  const handleStyleChange = (style: string) => {
    setCurrentMapStyle(style);
    setHasManuallySelectedStyle(true);
  };

  // Apply initialMapStyle when it becomes available (e.g. after async adventure data loads)
  useEffect(() => {
    if (initialMapStyle && MAP_STYLES[initialMapStyle] && !hasManuallySelectedStyle) {
      setCurrentMapStyle(initialMapStyle);
    }
  }, [initialMapStyle, hasManuallySelectedStyle]);

  // Listen for app theme changes and system theme changes
  useEffect(() => {
    // Don't auto-update if user manually selected a style
    if (hasManuallySelectedStyle) return;

    // Don't auto-update from theme changes when an explicit initialMapStyle is provided
    // (the initialMapStyle effect above handles that case)
    if (initialMapStyle && MAP_STYLES[initialMapStyle]) return;

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
  }, [theme, systemTheme, currentMapStyle, hasManuallySelectedStyle, initialMapStyle]);

  // Also listen for system theme changes as backup
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleThemeChange = (e: MediaQueryListEvent) => {
      // Only respond to system changes if app theme is set to system or undefined AND user hasn't manually selected a style
      if ((theme === "system" || !theme) && !hasManuallySelectedStyle) {
        const newDefaultStyle = e.matches ? "dark" : "original";
        if (currentMapStyle !== newDefaultStyle) {
          setCurrentMapStyle(newDefaultStyle);
        }
      }
    };

    mediaQuery.addEventListener('change', handleThemeChange);
    return () => mediaQuery.removeEventListener('change', handleThemeChange);
  }, [theme, currentMapStyle, hasManuallySelectedStyle]);

  // Get initial location (IP-based or NYC fallback)
  const { location: initialLocation } = useInitialLocation();

  // Calculate center if not provided - use stable defaults to prevent jumping
  const mapCenter = useMemo<[number, number]>(() => {
    if (center) return [center.lat, center.lng];
    if (searchLocation) return [searchLocation.lat, searchLocation.lng];
    if (userLocation) return [userLocation.lat, userLocation.lng];
    return [initialLocation.lat, initialLocation.lng]; // Use detected location or NYC fallback
  }, [center, searchLocation, userLocation, initialLocation]);

  const handleMarkerClick = useCallback((geocache: Geocache | null, popupContainer?: HTMLDivElement) => {
    // A popup closing reuses this handler to signal "popup dismissed" by
    // passing a null geocache. That's a UI-state signal for the parent
    // (e.g. to clear an open sidebar card) — never a navigation.
    // Forward the null only when the parent provided an explicit handler;
    // otherwise drop it so we don't try to navigate to a null treasure
    // during map teardown (which closes the popup on unmount).
    if (!geocache) {
      onMarkerClick?.(geocache as unknown as Geocache, popupContainer);
      return;
    }
    if (onMarkerClick) {
      onMarkerClick(geocache, popupContainer);
    } else {
      // Use optimized navigation that pre-populates cache
      navigateToGeocache(geocache, { fromMap: true });
    }
  }, [onMarkerClick, navigateToGeocache]);

  // Detect iOS Lockdown Mode and adjust features accordingly
  const lockdownFeatures = useMemo(() => getLockdownFeatures(), []);

  const iconTheme = mapStyleToIconTheme(currentMapStyle);

  return (
    <div
      className="relative h-full w-full overflow-hidden"
      style={{
        backgroundColor: '#f8fafc',
        minHeight: '100%'
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

      {/* Map Loading Skeleton - show only during initial map creation */}
      {!isMapInitialized && (
        <div className="absolute inset-0 z-10 bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
            <p className="text-sm text-muted-foreground">Loading map...</p>
          </div>
        </div>
      )}

      <MapView
        center={mapCenter}
        zoom={zoom}
        minZoom={2} // Allow zooming out far enough to see the whole world
        maxZoom={21}
        mapStyle={mapStyle}
        className="z-0"
        onLoad={() => setIsMapInitialized(true)}
        onUnavailable={() => setIsMapInitialized(true)}
        onShowList={onShowList}
      >
        <SatelliteZoomFallback currentStyle={currentMapStyle} onStyleChange={setCurrentMapStyle} />

        <MapSizeController isVisible={isVisible} layoutKey={layoutKey} />

        <MapRefController mapRef={mapRef} />

        {onMapClick && <MapClickHandler onClick={onMapClick} />}

        <MapController
          center={mapCenter}
          zoom={zoom}
          searchLocation={searchLocation}
          searchRadius={searchRadius}
          isMapCenterLocked={isMapCenterLocked}
        />

        <ThemeController
          currentStyle={currentMapStyle}
          appTheme={theme}
          systemTheme={systemTheme}
        />

        {/* Map Style Control */}
        {showStyleSelector && (
          <MapStyleControl
            currentStyle={currentMapStyle}
            onStyleChange={handleStyleChange}
          />
        )}

        {/* Custom Zoom Control - positioned at lower left */}
        <CustomZoomControl />

        {/* Near Me Button Control - positioned at lower right */}
        {onNearMe && (
          <NearMeButtonControl
            onNearMe={onNearMe}
            isNearMeActive={isNearMeActive}
            isGettingLocation={isGettingLocation}
            isAdventureTheme={currentMapStyle === 'adventure'}
          />
        )}

        {/* Radar Compass Button — above Near Me button */}
        {onOpenRadar && (
          <CompassMapButtonControl
            onOpenRadar={onOpenRadar}
            isAdventureTheme={currentMapStyle === 'adventure'}
          />
        )}

        {/* Earth View Button — between compass and Near Me buttons */}
        {onShowEarth && (
          <EarthViewButtonControl
            onShowEarth={onShowEarth}
          />
        )}

        {/* Search radius circle — subtle boundary indicator */}
        {searchLocation && searchRadius && (
          <MapCircle
            center={searchLocation}
            radiusMeters={searchRadius * 1000}
            color={currentMapStyle === 'adventure' ? '#a0825a' : '#228c4e'}
            opacity={0.16}
          />
        )}

        {/* Center pin for map click selection (adventure creation etc.) */}
        {onMapClick && searchLocation && (
          <MapMarker position={searchLocation} icon={centerPinIcon} interactive={false} />
        )}

        {/* User location marker */}
        {userLocation && (
          <MapMarker position={userLocation} icon={userLocationIcon} interactive={false} />
        )}

        {adventures && adventures.length > 0 && (
          <AdventureMarkers adventures={adventures} onAdventureMarkerClick={onAdventureMarkerClick} />
        )}

        {/* Geocache markers with clustering */}
        <GeocacheMarkers
          geocaches={geocaches}
          iconTheme={iconTheme}
          claimedFtfCacheKeys={claimedFtfCacheKeys}
          highlightedGeocache={highlightedGeocache}
          onMarkerClick={handleMarkerClick}
        />
      </MapView>
    </div>
  );
}
