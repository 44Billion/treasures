import React, { useEffect, useRef, useState, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Circle, useMap } from "react-leaflet";
import { LatLngExpression } from "leaflet";
import L from "leaflet";
import { useTheme } from "@/shared/hooks/useTheme";
import { MAP_STYLES, type MapStyle } from "@/features/map/constants/mapStyles";
import type { Geocache } from "@/shared/types";
import { getCacheIconSvg, getCacheColor } from "@/features/geocache/utils/cacheIconUtils";

// Import Leaflet CSS and adventure theme
import "leaflet/dist/leaflet.css";
import "../features/map/map.css";

// Create cache icons with optional adventure theme styling
const createCacheIcon = (type: string, isAdventureTheme: boolean = false) => {
  const iconSvg = getCacheIconSvg(type);
  const color = getCacheColor(type);

  if (isAdventureTheme) {
    // Adventure-style quest markers - slightly more blue with parchment texture
    const adventureColors = {
      background: '#6495ED', // Cornflower blue - slightly more blue
      border: '#4169E1',     // Royal blue - more blue border
      icon: '#FFFFFF',       // Pure white - maximum contrast against sepia
      shadow: '#4682B4',     // Steel blue shadow
    };

    return L.divIcon({
      html: `
        <div style="
          background:
            url('/parchment-50.jpg'),
            ${adventureColors.background};
          background-blend-mode: soft-light;
          background-size: 50px 50px, auto;
          border: 2px solid ${adventureColors.border};
          border-radius: 4px;
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 2px 4px rgba(65, 105, 225, 0.3);
          position: relative;
          transition: all 0.2s ease;
          cursor: pointer;
          color: ${adventureColors.icon};
        ">
          ${iconSvg.replace(/stroke="currentColor"/g, `stroke="${adventureColors.icon}"`).replace(/fill="currentColor"/g, `fill="${adventureColors.icon}"`)}
        </div>
        <div style="
          position: absolute;
          bottom: -6px;
          left: 50%;
          transform: translateX(-50%);
          width: 0;
          height: 0;
          border-left: 6px solid transparent;
          border-right: 6px solid transparent;
          border-top: 6px solid ${adventureColors.background};
          filter: drop-shadow(0 1px 2px rgba(70, 130, 180, 0.3));
        "></div>
        <style>
          .custom-cache-icon:hover > div:first-child {
            transform: scale(1.05);
            box-shadow: 0 3px 6px rgba(65, 105, 225, 0.4);
            opacity: 1;
          }
        </style>
      `,
      className: "custom-cache-icon adventure-cache-icon adventure-quest-marker",
      iconSize: [36, 42],
      iconAnchor: [18, 42],
      popupAnchor: [0, -42],
    });
  }

  // Standard theme icons
  return L.divIcon({
    html: `
      <div style="
        background: ${color};
        border: 3px solid white;
        border-radius: 50%;
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 3px 6px rgba(0,0,0,0.3);
        position: relative;
        transition: all 0.2s ease;
        cursor: pointer;
      ">
        ${iconSvg}
      </div>
      <div style="
        position: absolute;
        bottom: -8px;
        left: 50%;
        transform: translateX(-50%);
        width: 0;
        height: 0;
        border-left: 8px solid transparent;
        border-right: 8px solid transparent;
        border-top: 8px solid ${color};
        filter: drop-shadow(0 2px 2px rgba(0,0,0,0.2));
      "></div>
      <style>
        .custom-cache-icon:hover > div:first-child {
          transform: scale(1.1);
          box-shadow: 0 4px 8px rgba(0,0,0,0.4);
        }
      </style>
    `,
    className: "custom-cache-icon",
    iconSize: [40, 48],
    iconAnchor: [20, 48],
    popupAnchor: [0, -48],
  });
};

// Create HTML popup content for geocaches
const createGeocachePopupHTML = (geocache: Geocache) => {
  // Pre-escape and truncate description
  const description = geocache.description.length > 100
    ? geocache.description.substring(0, 100) + '...'
    : geocache.description;

  return `
    <div class="p-3 min-w-[200px] max-w-[280px]">
      <h3 class="font-semibold text-sm leading-tight mb-2">${geocache.name}</h3>

      <div class="flex flex-wrap gap-1 mb-2">
        <span class="px-2 py-1 text-xs bg-secondary rounded">D${geocache.difficulty}</span>
        <span class="px-2 py-1 text-xs bg-secondary rounded">T${geocache.terrain}</span>
        <span class="px-2 py-1 text-xs bg-secondary rounded">${geocache.size}</span>
        <span class="px-2 py-1 text-xs bg-secondary rounded">${geocache.type}</span>
      </div>

      <p class="text-xs text-gray-600 mb-3 line-clamp-2">${description}</p>

      <div class="flex gap-2">
        <button
          class="flex-1 bg-blue-600 text-white text-xs px-3 py-2 rounded hover:bg-blue-700 transition-colors"
          onclick="window.dispatchEvent(new CustomEvent('profile-geocache-view-details', { detail: '${geocache.dTag}' }))"
        >
          View Details
        </button>
        <button
          class="inline-flex items-center justify-center p-2 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
          onclick="window.open('https://www.openstreetmap.org/directions?from=&to=${geocache.location.lat}%2C${geocache.location.lng}#map=15/${geocache.location.lat}/${geocache.location.lng}', '_blank')"
          title="Get directions"
        >
          <svg class="h-3 w-3" fill="none" stroke="white" viewBox="0 0 24 24" stroke-width="2">
            <polygon points="3 11 22 2 13 21 11 13 3 11"></polygon>
          </svg>
        </button>
      </div>
    </div>
  `;
};

interface ProfileMapProps {
  geocaches: Geocache[];
  onGeocacheClick?: (geocache: Geocache) => void;
}

// Component to handle theme styling
function ThemeController({
  currentStyle,
  appTheme,
  systemTheme
}: {
  currentStyle: string;
  appTheme?: string;
  systemTheme?: string;
}) {
  const map = useMap();

  useEffect(() => {
    const container = map.getContainer();

    // Remove all theme classes
    container.classList.remove('dark-theme', 'adventure-theme', 'system-dark-theme');

    // Add current theme class
    if (currentStyle === 'dark') {
      container.classList.add('dark-theme');
    } else if (currentStyle === 'adventure') {
      container.classList.add('adventure-theme');
    } else if (currentStyle === 'original') {
      // For original style, check if we should apply system dark theme
      if (appTheme === 'system' && systemTheme === 'dark') {
        container.classList.add('system-dark-theme');
      }
      // If app theme is explicitly light, don't add any dark theme classes
    }
  }, [map, currentStyle, appTheme, systemTheme]);

  return null;
}

// Component to handle map size invalidation
function MapSizeController() {
  const map = useMap();

  useEffect(() => {
    // Add a small delay to ensure map is fully initialized
    const timer = setTimeout(() => {
      if (map && typeof map.invalidateSize === 'function') {
        map.invalidateSize();
      }
    }, 100);

    // Also invalidate size on window resize
    const handleResize = () => {
      if (map && typeof map.invalidateSize === 'function') {
        map.invalidateSize();
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleResize);
    };
  }, [map]);

  return null;
}

// Custom tile layer with optimizations
function OptimizedTileLayer({ mapStyle }: { mapStyle: MapStyle }) {
  return (
    <TileLayer
      attribution={mapStyle.attribution}
      url={mapStyle.url}
      maxZoom={18}
      minZoom={2}
      keepBuffer={1}
      updateWhenIdle={true}
      updateWhenZooming={false}
      updateInterval={200}
      crossOrigin={true}
      tileSize={256}
      zoomOffset={0}
      detectRetina={false}
      noWrap={false}
    />
  );
}

export function ProfileMap({ geocaches, onGeocacheClick }: ProfileMapProps) {
  const { theme, systemTheme } = useTheme();
  const [isMapReady, setIsMapReady] = useState(false);

  // Filter geocaches that have valid locations
  const validGeocaches = useMemo(() => {
    return geocaches.filter(g => g.location && g.location.lat && g.location.lng);
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
        center: [40.7128, -74.0060] as LatLngExpression, // Default to NYC
        zoom: 10
      };
    }

    if (validGeocaches.length === 1) {
      return {
        center: [validGeocaches[0].location.lat, validGeocaches[0].location.lng] as LatLngExpression,
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

    // Calculate appropriate zoom based on spread
    const latDiff = maxLat - minLat;
    const lngDiff = maxLng - minLng;
    const maxDiff = Math.max(latDiff, lngDiff);

    let zoom = 10;
    if (maxDiff < 0.1) zoom = 14;
    else if (maxDiff < 0.5) zoom = 12;
    else if (maxDiff < 2) zoom = 10;
    else if (maxDiff < 5) zoom = 8;
    else if (maxDiff < 10) zoom = 6;
    else if (maxDiff < 30) zoom = 4;
    else if (maxDiff < 60) zoom = 3;
    else zoom = 2; // World view for very spread out geocaches

    return {
      center: [centerLat, centerLng] as LatLngExpression,
      zoom
    };
  }, [validGeocaches]);

  // Optimized map options
  const mapOptions = {
    scrollWheelZoom: true,
    tap: false,
    tapTolerance: 15,
    bounceAtZoomLimits: false,
    maxBoundsViscosity: 0.3,
    preferCanvas: true,
    fadeAnimation: false,
    zoomAnimation: true,
    zoomAnimationThreshold: 2,
    markerZoomAnimation: false,
    trackResize: false,
    boxZoom: false,
    keyboard: false,
    inertia: true,
    inertiaDeceleration: 3000,
    inertiaMaxSpeed: 1500,
    worldCopyJump: false,
  };

  // Set up event listeners for popup buttons
  useEffect(() => {
    const handleViewDetails = (event: CustomEvent) => {
      const dTag = event.detail;
      const geocache = validGeocaches.find(g => g.dTag === dTag);
      if (geocache && onGeocacheClick) {
        onGeocacheClick(geocache);
      }
    };

    window.addEventListener('profile-geocache-view-details', handleViewDetails as EventListener);

    return () => {
      window.removeEventListener('profile-geocache-view-details', handleViewDetails as EventListener);
    };
  }, [validGeocaches, onGeocacheClick]);

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
      {/* Clean Adventure-style Map */}
      {currentMapStyle === 'adventure' && (
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

      <MapContainer
        center={mapConfig.center}
        zoom={mapConfig.zoom}
        style={{ height: "100%", width: "100%" }}
        className="z-0"
        zoomControl={true}
        doubleClickZoom={true}
        touchZoom={true}
        attributionControl={false}
        minZoom={2}
        maxZoom={18}
        worldCopyJump={true}
        whenReady={() => {
          setIsMapReady(true);
        }}
        {...mapOptions}
      >
        <OptimizedTileLayer mapStyle={mapStyle} />
        <MapSizeController />
        <ThemeController
          currentStyle={currentMapStyle}
          appTheme={theme}
          systemTheme={systemTheme}
        />

        {/* Geocache markers */}
        {validGeocaches.map((geocache) => (
          <Marker
            key={geocache.dTag}
            position={[geocache.location.lat, geocache.location.lng]}
            icon={createCacheIcon(geocache.type, currentMapStyle === 'adventure')}
            eventHandlers={{
              add: (e) => {
                // Bind HTML popup when marker is added
                const marker = e.target;
                marker.bindPopup(() => createGeocachePopupHTML(geocache), {
                  maxWidth: 300,
                  className: 'geocache-popup',
                  closeButton: true,
                  autoClose: true,
                  autoPan: true,
                  keepInView: true
                });
              },
              click: (e) => {
                // Ensure popup opens on marker click
                const marker = e.target;
                if (!marker.isPopupOpen()) {
                  marker.openPopup();
                }
              }
            }}
          />
        ))}
      </MapContainer>
    </div>
  );
}