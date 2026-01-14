import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Circle, useMap } from "react-leaflet";
import { LatLngExpression, LatLngBounds } from "leaflet";
import L from "leaflet";
import { createRoot } from "react-dom/client";
import { useTheme } from "@/shared/hooks/useTheme";
import MarkerClusterGroup from "react-leaflet-cluster";
import { MapStyleSelector } from "./MapStyleSelector";
import { NearMeButton } from "./NearMeButton";
import { MAP_STYLES, type MapStyle } from "@/features/map/constants/mapStyles";
import { useGeocacheNavigation } from "@/features/geocache/hooks/useGeocacheNavigation";
import { useMapController } from "@/features/map/hooks/useMapController";
import { useInitialLocation } from "@/features/map/hooks/useInitialLocation";
import type { Geocache } from "@/shared/types";
import { getTypeLabel, getSizeLabel } from "@/features/geocache/utils/geocache-utils";
import { getCacheIconSvg, getCacheColor } from "@/features/geocache/utils/cacheIconUtils";
import { CACHE_NAMES } from "@/shared/config";
import i18n from "@/lib/i18n";

// Import Leaflet CSS and adventure theme
import "leaflet/dist/leaflet.css";
import "../map.css";

// Create HTML popup content for geocaches
const createGeocachePopupHTML = (geocache: Geocache) => {
  // Pre-escape and truncate description
  const description = geocache.description.length > 100
    ? geocache.description.substring(0, 100) + '...'
    : geocache.description;

  // Get preview image (first image if available)
  const previewImage = geocache.images && geocache.images.length > 0 ? geocache.images[0] : undefined;

  return `
    <div class="p-0 min-w-[200px] max-w-[280px] overflow-hidden">
      <div class="relative w-full h-32 overflow-hidden popup-image-placeholder">
        ${previewImage ? `
          <img
            src="${previewImage}"
            alt="${geocache.name}"
            class="absolute inset-0 w-full h-full object-cover object-center"
            loading="lazy"
          />
        ` : ''}
      </div>

      <div class="p-3">
        <h3 class="font-semibold text-sm leading-tight mb-2">${geocache.name}</h3>

        <div class="flex flex-wrap gap-1 mb-2">
          <span class="px-2 py-1 text-xs bg-secondary rounded">D${geocache.difficulty}</span>
          <span class="px-2 py-1 text-xs bg-secondary rounded">T${geocache.terrain}</span>
          <span class="px-2 py-1 text-xs bg-secondary rounded">${getSizeLabel(geocache.size)}</span>
          <span class="px-2 py-1 text-xs bg-secondary rounded">${getTypeLabel(geocache.type)}</span>
        </div>

        <p class="text-xs text-gray-600 mb-3 line-clamp-2">${description}</p>

        <div class="flex gap-2">
          <button
            class="flex-1 bg-blue-600 text-white text-xs px-3 py-2 rounded hover:bg-blue-700 transition-colors"
            onclick="window.dispatchEvent(new CustomEvent('geocache-view-details', { detail: '${geocache.dTag}' }))"
          >
            ${i18n.t('map.popup.viewDetails')}
          </button>
          <button
            class="inline-flex items-center justify-center p-2 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
            onclick="window.open('https://www.openstreetmap.org/directions?from=&to=${geocache.location.lat}%2C${geocache.location.lng}#map=15/${geocache.location.lat}/${geocache.location.lng}', '_blank')"
            title="${i18n.t('map.popup.getDirections')}"
          >
            <svg class="h-3 w-3" fill="none" stroke="white" viewBox="0 0 24 24" stroke-width="2">
              <polygon points="3 11 22 2 13 21 11 13 3 11"></polygon>
            </svg>
          </button>
        </div>
      </div>
    </div>
  `;
};

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

const userLocationIcon = L.divIcon({
  html: `
    <div style="position: relative; width: 32px; height: 32px;">
      <!-- Outer pulse ring -->
      <div style="
        position: absolute;
        width: 32px;
        height: 32px;
        background: radial-gradient(circle, rgba(59, 130, 246, 0.4) 0%, rgba(59, 130, 246, 0.1) 70%, transparent 100%);
        border-radius: 50%;
        animation: locationPulse 2.5s ease-out infinite;
      "></div>
      <!-- Middle ring -->
      <div style="
        position: absolute;
        top: 4px;
        left: 4px;
        width: 24px;
        height: 24px;
        background: rgba(59, 130, 246, 0.6);
        border: 2px solid rgba(255, 255, 255, 0.9);
        border-radius: 50%;
        animation: locationPulse 2.5s ease-out infinite 0.3s;
      "></div>
      <!-- Core beacon -->
      <div style="
        position: absolute;
        top: 8px;
        left: 8px;
        width: 16px;
        height: 16px;
        background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
        border: 3px solid white;
        border-radius: 50%;
        box-shadow:
          0 3px 8px rgba(0,0,0,0.3),
          inset 0 1px 0 rgba(255,255,255,0.4);
      "></div>
    </div>
    <style>
      @keyframes locationPulse {
        0% {
          transform: scale(1);
          opacity: 0.8;
        }
        50% {
          transform: scale(1.4);
          opacity: 0.4;
        }
        100% {
          transform: scale(2);
          opacity: 0;
        }
      }
    </style>
  `,
  className: "user-location-icon",
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});



interface GeocacheMapProps {
  geocaches: Geocache[];
  center?: { lat: number; lng: number };
  zoom?: number;
  userLocation?: { lat: number; lng: number } | null;
  searchLocation?: { lat: number; lng: number } | null;
  searchRadius?: number; // in km
  onMarkerClick?: (geocache: Geocache) => void;
  onSearchInView?: (bounds: L.LatLngBounds) => void; // Callback for search in view functionality
  onNearMe?: () => void; // Callback for near me functionality
  highlightedGeocache?: string; // dTag of geocache to highlight/open popup
  showStyleSelector?: boolean; // Whether to show the map style selector
  isNearMeActive?: boolean; // Whether "Near Me" mode is active
  isGettingLocation?: boolean; // Whether location is being retrieved
  mapRef?: React.RefObject<L.Map>; // Reference to the map instance
  isMapCenterLocked?: boolean; // Whether map center is locked from user interaction
  isVisible?: boolean; // Whether the map is currently visible (for handling tab switches on mobile)
}



// Component to handle map centering
function MapController({
  center,
  zoom,
  searchLocation,
  searchRadius,
  isMapCenterLocked = false
}: {
  center: LatLngExpression;
  zoom: number;
  searchLocation?: { lat: number; lng: number } | null;
  searchRadius?: number;
  isMapCenterLocked?: boolean;
}) {
  const { handleCardClick } = useMapController({
    center,
    zoom,
    searchLocation,
    searchRadius,
    isMapCenterLocked,
  });

  // Expose handleCardClick to parent component via window object for card click handling
  useEffect(() => {
    (window as any).handleMapCardClick = handleCardClick;
    return () => {
      delete (window as any).handleMapCardClick;
    };
  }, [handleCardClick]);

  return null;
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

// Component to handle popup opening for highlighted geocache
function PopupController({
  highlightedGeocache,
  geocaches
}: {
  highlightedGeocache?: string;
  geocaches: Geocache[];
}) {
  const map = useMap();
  const lastHighlightedRef = useRef<string | null>(null);
  const popupAttemptsRef = useRef<number>(0);
  const maxAttempts = 15;
  const isOpeningRef = useRef<boolean>(false);

  useEffect(() => {
    if (highlightedGeocache && highlightedGeocache !== lastHighlightedRef.current) {
      lastHighlightedRef.current = highlightedGeocache;
      popupAttemptsRef.current = 0;
      isOpeningRef.current = true;

      // Find the geocache
      const geocache = geocaches.find(g => g.dTag === highlightedGeocache);
      if (geocache) {
        const attemptOpenPopup = (attempt: number) => {
          if (attempt > maxAttempts || !isOpeningRef.current) {
            if (attempt > maxAttempts) {
              console.warn(`Could not find marker for geocache ${geocache.dTag} after ${maxAttempts} attempts`);
            }
            isOpeningRef.current = false;
            return;
          }

          let markerFound = false;

          // Search through all layers to find the marker, including cluster groups
          map.eachLayer((layer: L.Layer) => {
            if (layer instanceof L.Marker && 'getLatLng' in layer && !markerFound) {
              const markerLatLng = (layer as L.Marker).getLatLng();
              if (Math.abs(markerLatLng.lat - geocache.location.lat) < 0.0001 &&
                  Math.abs(markerLatLng.lng - geocache.location.lng) < 0.0001) {

                const marker = layer as L.Marker;

                // Close ALL open popups first to ensure only one is open at a time
                map.eachLayer((l: L.Layer) => {
                  if (l instanceof L.Marker && l.getPopup && l.getPopup() && l.isPopupOpen()) {
                    l.closePopup();
                  }
                });
                map.closePopup();

                // Check if marker has a popup bound
                if (marker.getPopup()) {
                  // Force open the popup with a small delay to ensure it's ready
                  setTimeout(() => {
                    try {
                      marker.openPopup();
                      markerFound = true;
                      isOpeningRef.current = false;
                    } catch (error) {
                      console.warn('Failed to open popup:', error);
                      // Try again if it fails
                      setTimeout(() => {
                        popupAttemptsRef.current = attempt + 1;
                        attemptOpenPopup(attempt + 1);
                      }, 200);
                    }
                  }, 50);
                } else {
                  // If no popup is bound yet, bind one and open it
                  const popupContent = createGeocachePopupHTML(geocache);
                  marker.bindPopup(popupContent, {
                    maxWidth: 300,
                    className: 'geocache-popup',
                    closeButton: true,
                    autoClose: false,
                    autoPan: true,
                    keepInView: true,
                    closeOnClick: false
                  });

                  setTimeout(() => {
                    try {
                      marker.openPopup();
                      markerFound = true;
                      isOpeningRef.current = false;
                    } catch (error) {
                      console.warn('Failed to open popup after binding:', error);
                      setTimeout(() => {
                        popupAttemptsRef.current = attempt + 1;
                        attemptOpenPopup(attempt + 1);
                      }, 200);
                    }
                  }, 100);
                }
              }
            }
          });

          // If marker wasn't found, try again with exponential backoff
          if (!markerFound && isOpeningRef.current) {
            const delay = Math.min(50 * Math.pow(1.3, attempt), 800); // Exponential backoff, max 800ms
            setTimeout(() => {
              popupAttemptsRef.current = attempt + 1;
              attemptOpenPopup(attempt + 1);
            }, delay);
          }
        };

        // Start attempting to open popup after a very short delay for map to settle
        setTimeout(() => {
          attemptOpenPopup(1);
        }, 100); // Reduced initial wait time
      }
    } else if (!highlightedGeocache) {
      lastHighlightedRef.current = null;
      popupAttemptsRef.current = 0;
      isOpeningRef.current = false;
    }
  }, [map, highlightedGeocache, geocaches]);

  return null;
}

// Component to handle map size invalidation
function MapSizeController({ isVisible }: { isVisible?: boolean }) {
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

  // Invalidate map size when visibility changes (handles tab switches on mobile)
  useEffect(() => {
    if (isVisible && map && typeof map.invalidateSize === 'function') {
      // Use a short delay to ensure the container is fully visible before invalidating
      const timer = setTimeout(() => {
        map.invalidateSize();
      }, 50);

      return () => clearTimeout(timer);
    }
  }, [isVisible, map]);

  return null;
}



// Component to handle world wrapping and ensure markers stay visible
function WorldWrapController({ geocaches }: { geocaches: Geocache[] }) {
  const map = useMap();
  const markersRef = useRef<L.Marker[]>([]);
  const worldWrappersRef = useRef<L.Marker[]>([]);

  useEffect(() => {
    const handleMoveEnd = () => {
      const bounds = map.getBounds();
      const center = map.getCenter();

      // Check if we've wrapped around the world
      if (center.lng > 180 || center.lng < -180) {
        // Normalize center longitude
        const normalizedLng = ((center.lng + 180) % 360 + 360) % 360 - 180;

        // If we've wrapped, we need to handle marker visibility
        // This is a simplified approach - in practice, you might want to duplicate
        // markers at world boundaries for seamless experience
        map.eachLayer((layer: L.Layer) => {
          if (layer instanceof L.Marker && layer.getLatLng()) {
            const latlng = layer.getLatLng();

            // Check if marker is outside the visible world bounds
            if (latlng.lng > 180 || latlng.lng < -180) {
              // Normalize marker longitude
              const normalizedLng = ((latlng.lng + 180) % 360 + 360) % 360 - 180;
              const normalizedLatLng = L.latLng(latlng.lat, normalizedLng);

              // Update marker position to normalized coordinates
              layer.setLatLng(normalizedLatLng);
            }
          }
        });
      }
    };

    map.on('moveend', handleMoveEnd);

    return () => {
      map.off('moveend', handleMoveEnd);
    };
  }, [map, geocaches]);

  return null;
}

// Component to ensure popups remain functional during zoom operations
function ZoomPopupManager({ geocaches }: { geocaches: Geocache[] }) {
  const map = useMap();
  const isZoomingRef = useRef(false);
  const zoomTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleZoomStart = () => {
      isZoomingRef.current = true;

      // Clear any existing timeout
      if (zoomTimeoutRef.current) {
        clearTimeout(zoomTimeoutRef.current);
        zoomTimeoutRef.current = null;
      }
    };

    const handleZoomEnd = () => {
      // Mark zoom as complete after a short delay to ensure all clustering is done
      zoomTimeoutRef.current = setTimeout(() => {
        isZoomingRef.current = false;

        // Ensure all markers have proper popup bindings after zoom
        map.eachLayer((layer: L.Layer) => {
          if (layer instanceof L.Marker && layer.getLatLng()) {
            const latlng = layer.getLatLng();

            // Find the corresponding geocache
            const geocache = geocaches.find(g =>
              g.location &&
              Math.abs(g.location.lat - latlng.lat) < 0.0001 &&
              Math.abs(g.location.lng - latlng.lng) < 0.0001
            );

            if (geocache && !layer.getPopup()) {
              // Rebind popup if it was lost during zoom
              const popupContent = () => createGeocachePopupHTML(geocache);
              layer.bindPopup(popupContent, {
                maxWidth: 300,
                className: 'geocache-popup',
                closeButton: true,
                autoClose: false,
                autoPan: true,
                keepInView: true,
                closeOnClick: false,
                closeOnEscapeKey: true,
                minWidth: 200,
                maxHeight: 400
              });
            }
          }
        });
      }, 300); // Wait for clustering to complete
    };

    const handleMoveEnd = () => {
      // Also handle move end for comprehensive coverage
      if (!isZoomingRef.current) {
        // Only rebind if not currently zooming
        setTimeout(() => {
          if (!isZoomingRef.current) {
            map.eachLayer((layer: L.Layer) => {
              if (layer instanceof L.Marker && layer.getLatLng()) {
                const latlng = layer.getLatLng();

                const geocache = geocaches.find(g =>
                  g.location &&
                  Math.abs(g.location.lat - latlng.lat) < 0.0001 &&
                  Math.abs(g.location.lng - latlng.lng) < 0.0001
                );

                if (geocache && !layer.getPopup()) {
                  const popupContent = () => createGeocachePopupHTML(geocache);
                  layer.bindPopup(popupContent, {
                    maxWidth: 300,
                    className: 'geocache-popup',
                    closeButton: true,
                    autoClose: false,
                    autoPan: true,
                    keepInView: true,
                    closeOnClick: false,
                    closeOnEscapeKey: true,
                    minWidth: 200,
                    maxHeight: 400
                  });
                }
              }
            });
          }
        }, 200);
      }
    };

    // Listen to zoom and move events
    map.on('zoomstart', handleZoomStart);
    map.on('zoomend', handleZoomEnd);
    map.on('moveend', handleMoveEnd);

    return () => {
      map.off('zoomstart', handleZoomStart);
      map.off('zoomend', handleZoomEnd);
      map.off('moveend', handleMoveEnd);

      if (zoomTimeoutRef.current) {
        clearTimeout(zoomTimeoutRef.current);
        zoomTimeoutRef.current = null;
      }
    };
  }, [map, geocaches]);

  return null;
}

// Component to expose map reference and handle loading state
function MapRefController({
  mapRef,
  onMapReady
}: {
  mapRef?: React.RefObject<L.Map>;
  onMapReady?: () => void;
}) {
  const map = useMap();

  useEffect(() => {
    // Expose map reference immediately
    if (mapRef && 'current' in mapRef) {
      (mapRef as React.MutableRefObject<L.Map | null>).current = map;
    }

    // Mark map as ready almost immediately - just a tiny delay for DOM
    const timer = setTimeout(() => {
      onMapReady?.();
    }, 50); // Minimal delay

    return () => clearTimeout(timer);
  }, [map, mapRef, onMapReady]);

  return null;
}

// Custom map style control - positioned at lower left above zoom
function MapStyleControl({
  currentStyle,
  onStyleChange
}: {
  currentStyle: string;
  onStyleChange: (style: string) => void;
}) {
  const map = useMap();
  const containerRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<ReturnType<typeof createRoot> | null>(null);
  const isInitializedRef = useRef(false);

  // Use refs to store the latest props to avoid dependency issues
  const currentStyleRef = useRef(currentStyle);
  const onStyleChangeRef = useRef(onStyleChange);

  // Update refs when props change
  useEffect(() => {
    currentStyleRef.current = currentStyle;
    onStyleChangeRef.current = onStyleChange;
  });

  useEffect(() => {
    // Only initialize once
    if (isInitializedRef.current) return;

    const mapContainer = map.getContainer();

    // Create container div for the map style control
    const container = document.createElement('div');
    container.className = 'map-style-control-container';
    container.style.cssText = `
      position: absolute;
      bottom: 106px;
      left: 10px;
      z-index: 1000;
      pointer-events: auto;
    `;

    // Add container to map container
    mapContainer.appendChild(container);
    containerRef.current = container;

    // Create React root and render the MapStyleSelector
    rootRef.current = createRoot(container);
    rootRef.current.render(
      <MapStyleSelector
        currentStyle={currentStyleRef.current}
        onStyleChange={onStyleChangeRef.current}
      />
    );

    isInitializedRef.current = true;

    // Cleanup
    return () => {
      if (containerRef.current && containerRef.current.parentNode) {
        containerRef.current.parentNode.removeChild(containerRef.current);
      }

      if (rootRef.current) {
        const root = rootRef.current;
        rootRef.current = null;

        setTimeout(() => {
          try {
            if (root && typeof root.unmount === 'function') {
              root.unmount();
            }
          } catch (error) {
            console.debug('MapStyleControl unmount:', error);
          }
        }, 0);
      }

      isInitializedRef.current = false;
    };
  }, [map]);

  // Update the rendered component when props change
  useEffect(() => {
    if (rootRef.current && isInitializedRef.current) {
      rootRef.current.render(
        <MapStyleSelector
          currentStyle={currentStyleRef.current}
          onStyleChange={onStyleChangeRef.current}
        />
      );
    }
  }, [currentStyle, onStyleChange]);

  return null;
}

// Custom component for zoom control - positioned at lower left corner
function CustomZoomControl() {
  const map = useMap();
  const containerRef = useRef<HTMLDivElement>(null);
  const isInitializedRef = useRef(false);

  useEffect(() => {
    if (isInitializedRef.current) return;

    const mapContainer = map.getContainer();

    // Create container div for the zoom control
    const container = document.createElement('div');
    container.className = 'custom-zoom-control';
    container.style.cssText = `
      position: absolute;
      bottom: 16px;
      left: 10px;
      z-index: 1000;
      pointer-events: auto;
    `;

    // Create zoom in button
    const zoomInBtn = document.createElement('button');
    zoomInBtn.innerHTML = '+';
    zoomInBtn.className = 'zoom-btn zoom-in-btn';
    zoomInBtn.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      background: rgba(255, 255, 255, 0.9);
      border: 1px solid hsl(var(--border));
      border-bottom: none;
      color: hsl(var(--foreground));
      font-size: 18px;
      font-weight: 500;
      line-height: 1;
      cursor: pointer;
      border-top-left-radius: 0.375rem;
      border-top-right-radius: 0.375rem;
      transition: background 0.2s;
      backdrop-filter: blur(8px);
    `;
    zoomInBtn.onmouseover = () => {
      zoomInBtn.style.background = 'hsl(var(--accent))';
    };
    zoomInBtn.onmouseout = () => {
      zoomInBtn.style.background = 'rgba(255, 255, 255, 0.9)';
    };
    zoomInBtn.onclick = () => {
      map.zoomIn();
    };

    // Create zoom out button
    const zoomOutBtn = document.createElement('button');
    zoomOutBtn.innerHTML = '−';
    zoomOutBtn.className = 'zoom-btn zoom-out-btn';
    zoomOutBtn.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      background: rgba(255, 255, 255, 0.9);
      border: 1px solid hsl(var(--border));
      color: hsl(var(--foreground));
      font-size: 18px;
      font-weight: 500;
      line-height: 1;
      cursor: pointer;
      border-bottom-left-radius: 0.375rem;
      border-bottom-right-radius: 0.375rem;
      transition: background 0.2s;
      backdrop-filter: blur(8px);
    `;
    zoomOutBtn.onmouseover = () => {
      zoomOutBtn.style.background = 'hsl(var(--accent))';
    };
    zoomOutBtn.onmouseout = () => {
      zoomOutBtn.style.background = 'rgba(255, 255, 255, 0.9)';
    };
    zoomOutBtn.onclick = () => {
      map.zoomOut();
    };

    container.appendChild(zoomInBtn);
    container.appendChild(zoomOutBtn);

    // Add container to map container
    mapContainer.appendChild(container);
    containerRef.current = container;
    isInitializedRef.current = true;

    // Cleanup
    return () => {
      if (containerRef.current && containerRef.current.parentNode) {
        containerRef.current.parentNode.removeChild(containerRef.current);
      }
      isInitializedRef.current = false;
    };
  }, [map]);

  return null;
}

// Custom component for near me button - positioned at lower right corner
function NearMeButtonControl({
  onNearMe,
  isNearMeActive,
  isGettingLocation,
  isAdventureTheme
}: {
  onNearMe: () => void;
  isNearMeActive: boolean;
  isGettingLocation: boolean;
  isAdventureTheme: boolean;
}) {
  const map = useMap();
  const containerRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<ReturnType<typeof createRoot> | null>(null);
  const isInitializedRef = useRef(false);

  // Use refs to store the latest props to avoid dependency issues
  const onNearMeRef = useRef(onNearMe);
  const isNearMeActiveRef = useRef(isNearMeActive);
  const isGettingLocationRef = useRef(isGettingLocation);
  const isAdventureThemeRef = useRef(isAdventureTheme);

  // Update refs when props change
  useEffect(() => {
    onNearMeRef.current = onNearMe;
    isNearMeActiveRef.current = isNearMeActive;
    isGettingLocationRef.current = isGettingLocation;
    isAdventureThemeRef.current = isAdventureTheme;
  });

  useEffect(() => {
    // Only initialize once
    if (isInitializedRef.current) return;

    const mapContainer = map.getContainer();

    // Create container div for the near me button
    const container = document.createElement('div');
    container.className = 'near-me-button-container';
    container.style.cssText = `
      position: absolute;
      bottom: 16px;
      right: 16px;
      z-index: 1000;
      pointer-events: auto;
    `;

    // Add container to map container
    mapContainer.appendChild(container);
    containerRef.current = container;

    // Create React root and render the NearMeButton
    rootRef.current = createRoot(container);
    rootRef.current.render(
      <NearMeButton
        onNearMe={onNearMeRef.current}
        isActive={isNearMeActiveRef.current}
        isLocating={isGettingLocationRef.current}
        isAdventureTheme={isAdventureThemeRef.current}
      />
    );

    isInitializedRef.current = true;

    // Cleanup
    return () => {
      if (containerRef.current && containerRef.current.parentNode) {
        containerRef.current.parentNode.removeChild(containerRef.current);
      }

      if (rootRef.current) {
        const root = rootRef.current;
        rootRef.current = null;

        setTimeout(() => {
          try {
            if (root && typeof root.unmount === 'function') {
              root.unmount();
            }
          } catch (error) {
            console.debug('NearMeButtonControl unmount:', error);
          }
        }, 0);
      }

      isInitializedRef.current = false;
    };
  }, [map]); // Only depend on map

  // Update the rendered component when props change
  useEffect(() => {
    if (rootRef.current && isInitializedRef.current) {
      rootRef.current.render(
        <NearMeButton
          onNearMe={onNearMeRef.current}
          isActive={isNearMeActiveRef.current}
          isLocating={isGettingLocationRef.current}
          isAdventureTheme={isAdventureThemeRef.current}
        />
      );
    }
  }, [onNearMe, isNearMeActive, isGettingLocation, isAdventureTheme]);

  return null;
}



// Custom tile layer with optimizations
function OptimizedTileLayer({ mapStyle }: { mapStyle: MapStyle }) {

  return (
    <TileLayer
      attribution={mapStyle.attribution}
      url={mapStyle.url}
      maxZoom={18} // Reduced max zoom for better performance
      minZoom={2} // Allow zooming out further to see world wrapping
      // Optimize for fastest possible loading
      keepBuffer={2} // Larger buffer for world wrapping
      updateWhenIdle={true} // Update when idle for better performance during interaction
      updateWhenZooming={false} // Don't update during zoom for smoother experience
      updateInterval={200} // Throttle updates for better performance
      // Additional performance optimizations
      crossOrigin={true} // Enable CORS for better caching
      // Reduce tile loading overhead
      tileSize={256} // Standard tile size
      zoomOffset={0} // No zoom offset
      detectRetina={false} // Disable retina detection for consistency
      // World wrapping support
      noWrap={false} // Enable world wrapping
      bounds={[[-90, -180], [90, 180]]} // Standard world bounds
      // Continuous world support
      continuousWorld={true} // Enable continuous world for seamless wrapping
    />
  );
}

// Map styles are now imported from MapStyleSelector component

export function GeocacheMap({
  geocaches,
  center,
  zoom = 10,
  userLocation,
  searchLocation,
  searchRadius,
  onMarkerClick,
  onSearchInView,
  onNearMe,
  highlightedGeocache,
  showStyleSelector = true,
  isNearMeActive = false,
  isGettingLocation = false,
  mapRef,
  isMapCenterLocked = false,
  isVisible = true
}: GeocacheMapProps) {
  const { navigateToGeocache } = useGeocacheNavigation();
  const { theme, systemTheme } = useTheme();
  const [isMapReady, setIsMapReady] = useState(false);
  const [isMapInitialized, setIsMapInitialized] = useState(false);

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
  const [hasManuallySelectedStyle, setHasManuallySelectedStyle] = useState(false);
  const mapStyle: MapStyle = (MAP_STYLES[currentMapStyle] || MAP_STYLES.original) as MapStyle;

  // Handle manual style changes
  const handleStyleChange = (style: string) => {
    setCurrentMapStyle(style);
    setHasManuallySelectedStyle(true);
  };

  // Listen for app theme changes and system theme changes
  useEffect(() => {
    // Only auto-update if user hasn't manually selected a style
    if (hasManuallySelectedStyle) {
      return;
    }

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
  }, [theme, systemTheme, currentMapStyle, hasManuallySelectedStyle]);

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



  const handleMarkerClick = useCallback((geocache: Geocache) => {
    if (onMarkerClick) {
      onMarkerClick(geocache);
    } else {
      // Use optimized navigation that pre-populates cache
      navigateToGeocache(geocache, { fromMap: true });
    }
  }, [onMarkerClick, navigateToGeocache]);

  // Optimized map options for fastest loading
  const mapOptions = {
    scrollWheelZoom: true,
    tap: false,
    tapTolerance: 15, // Increased tolerance for better touch performance
    bounceAtZoomLevels: false, // Disable for faster performance
    maxBoundsViscosity: 0.3, // Further reduce viscosity for better performance
    preferCanvas: true, // Use canvas for better performance
    fadeAnimation: false, // Disable fade for faster tile display
    zoomAnimation: true, // Keep zoom animation but make it faster
    zoomAnimationThreshold: 2, // Reduced threshold for smoother zoom
    markerZoomAnimation: false, // Disable marker zoom animation for speed
    // Additional performance optimizations
    trackResize: false, // Disable automatic resize tracking
    boxZoom: false, // Disable box zoom for better performance
    keyboard: false, // Disable keyboard navigation for performance
    inertia: true, // Enable inertia for smoother panning
    inertiaDeceleration: 3000, // Faster deceleration
    inertiaMaxSpeed: 1500, // Limit max speed for better control
    worldCopyJump: true, // Enable world copy jump to prevent marker disappearance when wrapping
    continuousWorld: true, // Enable continuous world for seamless wrapping
  };

  // Set up event listeners for popup buttons
  useEffect(() => {
    const handleViewDetails = (event: CustomEvent) => {
      const dTag = event.detail;
      const geocache = geocaches.find(g => g.dTag === dTag);
      if (geocache) {
        handleMarkerClick(geocache);
      }
    };



    window.addEventListener('geocache-view-details', handleViewDetails as EventListener);

    return () => {
      window.removeEventListener('geocache-view-details', handleViewDetails as EventListener);
    };
  }, [geocaches, onMarkerClick, handleMarkerClick]);

  return (
    <div
      className="relative h-full w-full overflow-hidden"
      style={{
        backgroundColor: '#f8fafc',
        minHeight: '100%'
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
      <OptimizedTileLayer mapStyle={mapStyle} />

      <MapSizeController isVisible={isVisible} />
      <WorldWrapController geocaches={geocaches} />
      <ZoomPopupManager geocaches={geocaches} />

      <MapRefController mapRef={mapRef} onMapReady={() => setIsMapReady(true)} />



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

      <PopupController
        highlightedGeocache={highlightedGeocache}
        geocaches={geocaches}
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

      {/* Search radius circle */}
      {searchLocation && searchRadius && (
        <Circle
          center={[searchLocation.lat, searchLocation.lng]}
          radius={searchRadius * 1000} // Convert km to meters
          pathOptions={currentMapStyle === 'adventure' ? {
            color: '#a0825a', // Clean bronze for adventure theme
            fillColor: '#b4966e', // Light bronze fill
            fillOpacity: 0.1,
            weight: 3,
            dashArray: '10, 5', // Simple dash pattern
            opacity: 0.7,
            className: 'search-radius-circle adventure-circle'
          } : {
            color: '#059669', // Emerald-600
            fillColor: '#10b981', // Emerald-500
            fillOpacity: 0.12,
            weight: 4,
            dashArray: '15, 8',
            opacity: 0.8,
            className: 'search-radius-circle'
          }}
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
      <MarkerClusterGroup
        chunkedLoading={true}
        chunkInterval={50} // Faster chunk processing
        chunkDelay={10} // Reduced delay between chunks
        maxClusterRadius={40} // Smaller cluster radius for better performance
        spiderfyOnMaxZoom={false} // Disable spiderfy for better performance
        showCoverageOnHover={false}
        zoomToBoundsOnClick={true}
        removeOutsideVisibleBounds={false} // Keep markers when they wrap around
        animate={false} // Disable animations for better performance
        animateAddingMarkers={false}
        // Performance optimizations
        disableClusteringAtZoom={16} // Disable clustering at high zoom levels
        maxZoom={18} // Match tile layer max zoom
        // Enhanced clustering options for better popup handling
        spiderfyDistanceMultiplier={1.5} // Better spiderfy behavior
        clusterPane="markerPane" // Ensure proper layering
        // Handle world wrapping properly
        chunkedLoadingDelay={50} // Add delay for chunked loading
        // Prevent popup issues during clustering operations
        iconCreateFunction={(cluster: { getChildCount: () => any; }) => {
          const count = cluster.getChildCount();
          const size = count < 10 ? 'small' : count < 100 ? 'medium' : 'large';

          return L.divIcon({
            html: `<div class="cluster-marker cluster-${size}"><span>${count}</span></div>`,
            className: 'custom-cluster-icon',
            iconSize: L.point(36, 36, true), // Slightly smaller for better performance
          });
        }}
        eventHandlers={{
          clusteringbegin: () => {
            // Ensure all markers have popups before clustering
            // This helps prevent popup loss during zoom operations
          },
          clusteringend: () => {
            // Re-bind popups if needed after clustering is complete
            // This ensures popups are available after zoom operations
          },
          unspiderfied: () => {
            // Ensure individual markers have popups when unspiderfied
          }
        }}
      >
        {geocaches.filter(g => g.location).slice(0, 200).map((geocache) => { // Limit to 200 markers for performance
          // Normalize longitude to handle world wrapping
          const normalizedLng = ((geocache.location.lng + 180) % 360 + 360) % 360 - 180;
          const normalizedPosition = [geocache.location.lat, normalizedLng];

          return (
            <Marker
              key={geocache.dTag}
              position={normalizedPosition as LatLngExpression}
              icon={createCacheIcon(geocache.type, currentMapStyle === 'adventure')}
              eventHandlers={{
                add: (e) => {
                  // Bind HTML popup when marker is added - ensure it's always available
                  const marker = e.target;

                  // Remove any existing popup first to prevent duplicates
                  if (marker.getPopup()) {
                    marker.unbindPopup();
                  }

                  // Create popup content function to ensure fresh content each time
                  const popupContent = () => createGeocachePopupHTML(geocache);

                  // Bind popup with robust options
                  marker.bindPopup(popupContent, {
                    maxWidth: 300,
                    className: 'geocache-popup',
                    closeButton: true,
                    autoClose: false, // Don't auto-close when clicking other markers
                    autoPan: true,
                    keepInView: true,
                    closeOnClick: false, // Don't close when clicking on the map
                    closeOnEscapeKey: true,
                    minWidth: 200,
                    maxHeight: 400
                  });
                },
                click: (e) => {
                  // Robust popup opening logic
                  const marker = e.target;
                  const map = marker._map;

                  // Prevent event propagation to avoid map clicks
                  L.DomEvent.stopPropagation(e);
                  L.DomEvent.preventDefault(e);

                  // Close ALL open popups first to ensure only one is open at a time
                  if (map) {
                    map.eachLayer((layer: L.Layer) => {
                      if (layer instanceof L.Marker && layer.getPopup && layer.getPopup() && layer.isPopupOpen()) {
                        layer.closePopup();
                      }
                    });
                    // Also close any popups directly on the map
                    map.closePopup();
                  }

                  // Always rebind popup to ensure it's fresh and functional
                  // This prevents issues where the popup was lost during clustering
                  if (marker.getPopup()) {
                    marker.unbindPopup();
                  }

                  const popupContent = () => createGeocachePopupHTML(geocache);
                  marker.bindPopup(popupContent, {
                    maxWidth: 300,
                    className: 'geocache-popup',
                    closeButton: true,
                    autoClose: false,
                    autoPan: true,
                    keepInView: true,
                    closeOnClick: false,
                    closeOnEscapeKey: true,
                    minWidth: 200,
                    maxHeight: 400
                  });

                  // Open popup with multiple fallback attempts
                  const attemptOpenPopup = (attempt: number = 1) => {
                    try {
                      marker.openPopup();
                    } catch (error) {
                      console.warn(`Failed to open popup (attempt ${attempt}):`, error);

                      if (attempt <= 3) {
                        // Try again with a slightly longer delay
                        setTimeout(() => {
                          // Rebind and try again
                          if (marker.getPopup()) {
                            marker.unbindPopup();
                          }
                          marker.bindPopup(popupContent, {
                            maxWidth: 300,
                            className: 'geocache-popup',
                            closeButton: true,
                            autoClose: false,
                            autoPan: true,
                            keepInView: true,
                            closeOnClick: false,
                            closeOnEscapeKey: true,
                            minWidth: 200,
                            maxHeight: 400
                          });
                          attemptOpenPopup(attempt + 1);
                        }, 50 * attempt);
                      }
                    }
                  };

                  // Start opening popup immediately
                  setTimeout(() => attemptOpenPopup(1), 10);
                },
                popupopen: (e) => {
                  // Ensure popup content is properly rendered when opened
                  const popup = e.target.getPopup();
                  if (popup && popup.getElement()) {
                    // Force a re-render to ensure content is visible
                    const element = popup.getElement();
                    if (element) {
                      element.style.visibility = 'visible';
                      element.style.opacity = '1';
                    }
                  }
                }
              }}
            />
          );
        })}
      </MarkerClusterGroup>
    </MapContainer>

  </div>
  );
}