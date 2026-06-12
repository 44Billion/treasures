import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { MapContainer, Marker, Circle } from "react-leaflet";
import { LatLngExpression } from "leaflet";
import L from "leaflet";
import { useTheme } from "@/hooks/useTheme";
import MarkerClusterGroup from "react-leaflet-cluster";
import { CustomZoomControl } from "./map/CustomZoomControl";
import { MAP_STYLES, type MapStyle } from "@/config/mapStyles";
import { useGeocacheNavigation } from "@/hooks/useGeocacheNavigation";
import { useInitialLocation } from "@/hooks/useInitialLocation";
import type { Geocache } from "@/types/geocache";
import type { Adventure } from "@/types/adventure";
import { getCachedCacheIcon, getCachedClaimedFtfIcon, mapStyleToIconTheme } from "@/utils/cacheMapIcons";
import { getLockdownFeatures } from "@/utils/lockdownMode";

// Import Leaflet CSS, overrides, and adventure theme
import "leaflet/dist/leaflet.css";
import "@/styles/leaflet-overrides.css";
import "@/styles/map-features.css";

// Map marker icons are provided by the shared helper in `@/utils/cacheMapIcons`
// so GeocacheMap and ProfileMap don't drift out of sync when new themes land.

// Special-purpose marker icons (user location pulse, adventure sparkles)
import { userLocationIcon, adventureMarkerIcon } from "./map/geocacheMapMarkerIcons";
// Invisible controller components wiring imperative Leaflet behavior
import {
  MapController,
  ThemeController,
  PopupController,
  MapSizeController,
  WorldWrapController,
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
// Tile layers + satellite deep-zoom fallback
import { OptimizedTileLayer, SatelliteZoomFallback } from "./map/GeocacheMapLayers";
// Popup auto-pan helpers (aware of floating UI overlays)
import { getPopupAutoPanPadding, openPopupWhenReady } from "./map/popupPositioning";

interface GeocacheMapProps {
  geocaches: Geocache[];
  center?: { lat: number; lng: number };
  zoom?: number;
  userLocation?: { lat: number; lng: number } | null;
  searchLocation?: { lat: number; lng: number } | null;
  searchRadius?: number; // in km
  onMarkerClick?: (geocache: Geocache, popupContainer?: HTMLDivElement) => void;
  onSearchInView?: (bounds: L.LatLngBounds) => void; // Callback for search in view functionality
  onNearMe?: () => void; // Callback for near me functionality
  highlightedGeocache?: string; // dTag of geocache to highlight/open popup
  showStyleSelector?: boolean; // Whether to show the map style selector
  isNearMeActive?: boolean; // Whether "Near Me" mode is active
  isGettingLocation?: boolean; // Whether location is being retrieved
  mapRef?: React.RefObject<L.Map | null>; // Reference to the map instance
  isMapCenterLocked?: boolean; // Whether map center is locked from user interaction
  isVisible?: boolean; // Whether the map is currently visible (for handling tab switches on mobile)
  onOpenRadar?: () => void; // Callback to open the radar compass overlay
  onShowEarth?: () => void; // Callback to zoom out to earth view and clear near me
  onMapClick?: (location: { lat: number; lng: number }) => void; // Callback for map click (e.g. adventure center selection)
  initialMapStyle?: string; // Override the default map style (e.g. from adventure event)
  adventures?: Adventure[]; // Adventure markers to display alongside geocaches
  onAdventureMarkerClick?: (adventure: Adventure, popupContainer?: HTMLDivElement) => void;
  layoutKey?: string | boolean; // Changes to this value trigger map.invalidateSize() — use when container size changes without a window resize
  /**
   * Set of cache keys (`${kind}:${pubkey}:${dTag}`) for first-to-find
   * treasures that have been claimed (a verified found log exists, or the
   * F tag is locked). Claimed FTF markers receive a small trophy badge
   * overlay so every viewer can see at a glance which prizes are still
   * available. Used by adventure detail views.
   */
  claimedFtfCacheKeys?: Set<string>;
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
  onMapClick,
  initialMapStyle,
  adventures,
  onAdventureMarkerClick,
  layoutKey,
  claimedFtfCacheKeys,
}: GeocacheMapProps) {
  const { navigateToGeocache } = useGeocacheNavigation();
  const { theme, systemTheme } = useTheme();
  const [isMapReady, setIsMapReady] = useState(false);
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
  const mapCenter: LatLngExpression = useMemo(() => {
    if (center) return [center.lat, center.lng];
    if (searchLocation) return [searchLocation.lat, searchLocation.lng];
    if (userLocation) return [userLocation.lat, userLocation.lng];
    return [initialLocation.lat, initialLocation.lng]; // Use detected location or NYC fallback
  }, [center, searchLocation, userLocation, initialLocation]);



  const handleMarkerClick = useCallback((geocache: Geocache | null, popupContainer?: HTMLDivElement) => {
    // The marker's `popupclose` event reuses this handler to signal "popup
    // dismissed" by passing a null geocache. That's a UI-state signal for
    // the parent (e.g. to clear an open sidebar card) — never a navigation.
    // Forward the null only when the parent provided an explicit handler;
    // otherwise drop it so we don't try to navigate to a null treasure
    // during map teardown (which fires popupclose synchronously on unmount).
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

  // Optimized map options for fastest loading
  const mapOptions = {
    scrollWheelZoom: true,
    tap: false,
    tapTolerance: 15, // Increased tolerance for better touch performance
    bounceAtZoomLevels: false, // Disable for faster performance
    maxBoundsViscosity: 0.3, // Further reduce viscosity for better performance
    preferCanvas: lockdownFeatures.preferCanvas, // Disabled in iOS Lockdown Mode (Canvas restricted)
    fadeAnimation: false, // Disable fade for faster tile display
    zoomAnimation: lockdownFeatures.complexAnimations, // Disable in Lockdown Mode
    zoomAnimationThreshold: 2, // Reduced threshold for smoother zoom
    markerZoomAnimation: false, // Disable marker zoom animation for speed
    // Additional performance optimizations
    trackResize: false, // Disable automatic resize tracking
    boxZoom: false, // Disable box zoom for better performance
    keyboard: true, // Keyboard navigation for accessibility (WCAG); negligible perf impact
    inertia: true, // Enable inertia for smoother panning
    inertiaDeceleration: 3000, // Faster deceleration
    inertiaMaxSpeed: 1500, // Limit max speed for better control
    worldCopyJump: true, // Enable world copy jump to prevent marker disappearance when wrapping
    continuousWorld: true, // Enable continuous world for seamless wrapping
  };



  // Stable ref for handleMarkerClick so marker event handlers don't change identity
  const handleMarkerClickRef = useRef(handleMarkerClick);
  handleMarkerClickRef.current = handleMarkerClick;

  // Stable ref for adventure marker click handler
  const handleAdventureMarkerClickRef = useRef(onAdventureMarkerClick);
  handleAdventureMarkerClickRef.current = onAdventureMarkerClick;

  // Shared abort signal for popup open — cancelled on each new marker click
  // so rapid clicks don't stack up competing MutationObservers, timers, and pans.
  const popupCleanupRef = useRef<(() => void) | null>(null);

  // Memoize cluster icon function — only depends on nothing (pure function of cluster)
  const clusterIconFn = useCallback((cluster: { getChildCount: () => number }) => {
    const count = cluster.getChildCount();
    const size = count < 10 ? 'small' : count < 100 ? 'medium' : 'large';
    const px = size === 'large' ? 50 : size === 'medium' ? 42 : 36;
    return L.divIcon({
      html: `<div class="cluster-marker cluster-${size}"><span>${count}</span></div>`,
      className: 'custom-cluster-icon',
      iconSize: L.point(px, px, true),
    });
  }, []);



  // Memoize marker elements so the cluster group does not reprocess markers
  // on every parent re-render (which would destroy open popups).
  const markerElements = useMemo(() =>
    (() => {
      const seen = new Set<string>();
      return geocaches.filter(g => g.location && g.dTag && !seen.has(g.dTag) && seen.add(g.dTag));
    })().slice(0, 200).map((geocache) => {
      const normalizedLng = ((geocache.location.lng + 180) % 360 + 360) % 360 - 180;
      const normalizedPosition = [geocache.location.lat, normalizedLng];

      // Choose the claimed-FTF marker when the caller has flagged this
      // treasure as won. Falls back to the standard themed marker so
      // non-adventure consumers (Map page, etc.) are unaffected.
      const iconTheme = mapStyleToIconTheme(currentMapStyle);
      const cacheKey = `${geocache.kind ?? 37516}:${geocache.pubkey}:${geocache.dTag}`;
      const isClaimed = claimedFtfCacheKeys?.has(cacheKey) ?? false;
      // Art treasures get a Palette glyph on the marker so they read as
      // special at a glance — independent of cache type or FTF status.
      const isArt = geocache.modifiers?.includes('art') ?? false;
      const markerIcon = isClaimed
        ? getCachedClaimedFtfIcon(geocache.type, iconTheme, isArt)
        : getCachedCacheIcon(geocache.type, iconTheme, isArt);

      return (
        <Marker
          key={geocache.dTag}
          position={normalizedPosition as LatLngExpression}
          icon={markerIcon}
          keyboard={true}
          title={geocache.name}
          alt={`${geocache.type} treasure: ${geocache.name}`}
          eventHandlers={{
            click: (e) => {
              const marker = e.target as L.Marker;
              const markerMap = (marker as unknown as Record<string, unknown>)._map as L.Map;

              // Abort any previous popup setup (observers, timers, pans)
              if (popupCleanupRef.current) {
                popupCleanupRef.current();
                popupCleanupRef.current = null;
              }

              if (markerMap) {
                markerMap.closePopup();
              }

              const container = document.createElement('div');
              container.className = 'react-popup-root';

              if (marker.getPopup()) {
                marker.unbindPopup();
              }

              const padding = markerMap ? getPopupAutoPanPadding(markerMap) : { top: 20, left: 20, bottom: 20, right: 20 };
              marker.bindPopup(container, {
                maxWidth: 400,
                minWidth: 200,
                className: 'geocache-popup react-popup',
                closeButton: false,
                autoPan: true,
                autoPanPaddingTopLeft: L.point(padding.left, padding.top),
                autoPanPaddingBottomRight: L.point(padding.right, padding.bottom),
                keepInView: false,
                closeOnClick: true,
                closeOnEscapeKey: true,
              });

              handleMarkerClickRef.current(geocache, container);

              if (markerMap) {
                popupCleanupRef.current = openPopupWhenReady(marker, container, markerMap, { aborted: false });
              }
            },
            popupclose: () => {
              if (popupCleanupRef.current) {
                popupCleanupRef.current();
                popupCleanupRef.current = null;
              }
              // Signal popup-dismissed to the parent (null geocache). The
              // handler short-circuits when no parent onMarkerClick is wired
              // up, so this is safe during map teardown on pages like the
              // cache detail view that don't consume this signal.
              handleMarkerClickRef.current(null, undefined);
            }
          }}
        />
      );
    }),
    [geocaches, currentMapStyle, claimedFtfCacheKeys]
  );

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

      {/* Geocache Loading Indicator - subtle overlay when geocaches are loading */}
      {isMapInitialized && !isMapReady && geocaches.length === 0 && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-20 bg-background/95 backdrop-blur-sm border rounded-full px-4 py-2 shadow-lg animate-in fade-in duration-300">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-muted-foreground/30 border-t-primary"></div>
            <span>Loading geocaches...</span>
          </div>
        </div>
      )}

      <MapContainer
        center={mapCenter}
        zoom={zoom}
        style={{ height: "100%", width: "100%" }}
        className="z-0"
        zoomControl={false}
        maxZoom={21}
        doubleClickZoom={true}
        touchZoom={true}
        attributionControl={false}
        // Optimize for fastest loading
        whenReady={() => {
          // Mark map as initialized immediately
          setIsMapInitialized(true);
        }}
        {...mapOptions}
      >
      <OptimizedTileLayer mapStyle={mapStyle} crossOriginTiles={lockdownFeatures.crossOriginTiles} />
      <SatelliteZoomFallback currentStyle={currentMapStyle} onStyleChange={setCurrentMapStyle} />

      <MapSizeController isVisible={isVisible} layoutKey={layoutKey} />
      <WorldWrapController geocaches={geocaches} />


      <MapRefController mapRef={mapRef} onMapReady={() => setIsMapReady(true)} />

      {onMapClick && <MapClickHandler onClick={onMapClick} />}

      <PopupController
        highlightedGeocache={highlightedGeocache}
        geocaches={geocaches}
        onMarkerClick={handleMarkerClick}
      />

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



      {/* Map Style Control - properly integrated with Leaflet */}
      {showStyleSelector && (
        <MapStyleControl
          currentStyle={currentMapStyle}
          onStyleChange={handleStyleChange}
        />
      )}

      {/* Search in View Control - removed, functionality now in main UI */}

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
        <Circle
          center={[searchLocation.lat, searchLocation.lng]}
          radius={searchRadius * 1000} // Convert km to meters
          pathOptions={currentMapStyle === 'adventure' ? {
            color: '#a0825a',
            fillColor: 'transparent',
            fillOpacity: 0,
            weight: 1.5,
            dashArray: '6, 6',
            opacity: 0.45,
            className: 'search-radius-circle adventure-circle'
          } : {
            color: '#228c4e',
            fillColor: 'transparent',
            fillOpacity: 0,
            weight: 1.5,
            dashArray: '6, 6',
            opacity: 0.4,
            className: 'search-radius-circle'
          }}
        />
      )}

      {/* Center pin for map click selection (adventure creation etc.) */}
      {onMapClick && searchLocation && (
        <Marker
          position={[searchLocation.lat, searchLocation.lng]}
          icon={L.divIcon({
            className: 'adventure-center-pin',
            html: '<div style="width:12px;height:12px;background:#228c4e;border:2px solid white;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,0.3);"></div>',
            iconSize: [12, 12],
            iconAnchor: [6, 6],
          })}
          interactive={false}
        />
      )}

      {/* User location marker */}
      {userLocation && (
        <Marker
          position={[userLocation.lat, userLocation.lng]}
          icon={userLocationIcon}
        ></Marker>
      )}

      {/* Geocache markers with clustering */}
      {/* Adventure markers — rendered outside the cluster group with distinct icons */}
      {adventures && adventures.length > 0 && adventures
        .filter(a => a.location?.lat && a.location?.lng)
        .map((adventure) => (
          <Marker
            key={`adventure-${adventure.dTag}`}
            position={[adventure.location!.lat, adventure.location!.lng]}
            icon={adventureMarkerIcon}
            keyboard={true}
            title={adventure.title || 'Adventure'}
            alt={`Adventure: ${adventure.title || adventure.dTag}`}
            eventHandlers={{
              click: (e) => {
                const marker = e.target as L.Marker;
                const markerMap = (marker as unknown as Record<string, unknown>)._map as L.Map;

                L.DomEvent.stopPropagation(e as unknown as Event);
                L.DomEvent.preventDefault(e as unknown as Event);

                if (markerMap) markerMap.closePopup();

                if (handleAdventureMarkerClickRef.current) {
                  const container = document.createElement('div');
                  container.className = 'react-popup-root';

                  if (marker.getPopup()) marker.unbindPopup();

                  const padding = markerMap ? getPopupAutoPanPadding(markerMap) : { top: 20, left: 20, bottom: 20, right: 20 };
                  marker.bindPopup(container, {
                    maxWidth: 340,
                    minWidth: 200,
                    className: 'geocache-popup react-popup',
                    closeButton: false,
                    autoPan: true,
                    autoPanPaddingTopLeft: L.point(padding.left, padding.top),
                    autoPanPaddingBottomRight: L.point(padding.right, padding.bottom),
                    keepInView: false,
                    closeOnClick: true,
                    closeOnEscapeKey: true,
                  });

                  handleAdventureMarkerClickRef.current(adventure, container);

                  if (markerMap) {
                    openPopupWhenReady(marker, container, markerMap, { aborted: false });
                  }
                }
              },
              popupclose: () => {
                handleAdventureMarkerClickRef.current?.(null as unknown as Adventure, undefined);
              },
            }}
          />
        ))
      }

      <MarkerClusterGroup
        chunkedLoading={true}
        chunkInterval={20} // Faster chunk processing for quicker initial load
        chunkDelay={5} // Minimal delay between chunks for instant rendering
        maxClusterRadius={22} // Smaller cluster radius keeps nearby caches visually distinct
        spiderfyOnMaxZoom={false} // Disable spiderfy for better performance
        showCoverageOnHover={false}
        zoomToBoundsOnClick={true}
        removeOutsideVisibleBounds={false} // Keep markers when they wrap around
        animate={false} // Disable animations for better performance
        animateAddingMarkers={false}
        // Performance optimizations
        disableClusteringAtZoom={14} // Show individual markers earlier when zooming in
        maxZoom={21} // Match tile layer max zoom
        // Enhanced clustering options for better popup handling
        spiderfyDistanceMultiplier={1.5} // Better spiderfy behavior
        clusterPane="markerPane" // Ensure proper layering
        // Handle world wrapping properly
        chunkedLoadingDelay={0} // No delay for instant marker rendering
        // Prevent popup issues during clustering operations
        iconCreateFunction={clusterIconFn}
      >
        {markerElements}
      </MarkerClusterGroup>
    </MapContainer>

  </div>
  );
}