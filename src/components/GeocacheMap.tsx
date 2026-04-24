import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Circle, useMap, useMapEvents } from "react-leaflet";
import { LatLngExpression } from "leaflet";
import L from "leaflet";
import { createRoot } from "react-dom/client";
import { useTheme } from "@/hooks/useTheme";
import MarkerClusterGroup from "react-leaflet-cluster";
import { MapStyleSelector } from "./MapStyleSelector";
import { NearMeButton } from "./NearMeButton";
import { CompassMapButton } from "./CompassMapButton";
import { MAP_STYLES, type MapStyle } from "@/config/mapStyles";
import { useGeocacheNavigation } from "@/hooks/useGeocacheNavigation";
import { useMapController } from "@/hooks/useMapController";
import { useInitialLocation } from "@/hooks/useInitialLocation";
import type { Geocache } from "@/types/geocache";
import type { Adventure } from "@/types/adventure";
import { getCacheIconSvg, getCacheColor } from "@/utils/cacheIconUtils";
import { getLockdownFeatures } from "@/utils/lockdownMode";

// Import Leaflet CSS, overrides, and adventure theme
import "leaflet/dist/leaflet.css";
import "@/styles/leaflet-overrides.css";
import "@/styles/map-features.css";

// Cached icon instances: 3 types x 2 themes = 6 icons total.
// Icons are created once and reused across all markers, avoiding hundreds of
// duplicate L.divIcon + inline <style> block allocations per render.
const iconCache = new Map<string, L.DivIcon>();

function getCachedCacheIcon(type: string, isAdventureTheme: boolean): L.DivIcon {
  const key = `${type}-${isAdventureTheme}`;
  const cached = iconCache.get(key);
  if (cached) return cached;

  const iconSvg = getCacheIconSvg(type);
  const color = getCacheColor(type);

  let icon: L.DivIcon;

  if (isAdventureTheme) {
    const adventureColors = {
      background: '#6495ED',
      border: '#4169E1',
      icon: '#FFFFFF',
    };

    icon = L.divIcon({
      html: `
        <div style="
          background: ${adventureColors.background};
          border: 2px solid ${adventureColors.border};
          border-radius: 4px;
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 2px 4px rgba(65, 105, 225, 0.3);
          position: relative;
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
        "></div>
      `,
      className: "custom-cache-icon adventure-cache-icon adventure-quest-marker",
      iconSize: [36, 42],
      iconAnchor: [18, 42],
      popupAnchor: [0, -42],
    });
  } else {
    icon = L.divIcon({
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
          box-shadow: 0 2px 4px rgba(0,0,0,0.25);
          position: relative;
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
        "></div>
      `,
      className: "custom-cache-icon",
      iconSize: [40, 48],
      iconAnchor: [20, 48],
      popupAnchor: [0, -48],
    });
  }

  iconCache.set(key, icon);
  return icon;
}

const userLocationIcon = L.divIcon({
  html: `
    <div style="position: relative; width: 32px; height: 44px;">
      <svg width="32" height="44" viewBox="0 0 32 44" fill="none" xmlns="http://www.w3.org/2000/svg">
        <filter id="pin-shadow">
          <feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity="0.3"/>
        </filter>
        <path d="M16 0C9.373 0 4 5.373 4 12c0 9 12 28 12 28s12-19 12-28c0-6.627-5.373-12-12-12z"
              fill="#3b82f6" filter="url(#pin-shadow)"/>
        <circle cx="16" cy="12" r="5" fill="white"/>
      </svg>
    </div>
  `,
  className: "user-location-icon",
  iconSize: [32, 44],
  iconAnchor: [16, 44],
});

// Adventure marker icon — amber/gold sparkles
const adventureMarkerIcon = L.divIcon({
  html: `
    <div style="
      background: linear-gradient(135deg, #d97706, #b45309);
      border: 3px solid white;
      border-radius: 50%;
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 4px rgba(0,0,0,0.25);
      position: relative;
      cursor: pointer;
    ">
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>
        <path d="M20 3v4"/>
        <path d="M22 5h-4"/>
        <path d="M4 17v2"/>
        <path d="M5 18H3"/>
      </svg>
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
      border-top: 8px solid #d97706;
    "></div>
  `,
  className: "adventure-marker-icon",
  iconSize: [40, 48],
  iconAnchor: [20, 48],
  popupAnchor: [0, -48],
});

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
  onMapClick?: (location: { lat: number; lng: number }) => void; // Callback for map click (e.g. adventure center selection)
  initialMapStyle?: string; // Override the default map style (e.g. from adventure event)
  adventures?: Adventure[]; // Adventure markers to display alongside geocaches
  onAdventureMarkerClick?: (adventure: Adventure, popupContainer?: HTMLDivElement) => void;
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

/**
 * Calculate autopan padding that accounts for floating UI elements
 * (search bar at top, zoom/style controls at left, near-me button at right).
 * Returns {top, left, bottom, right} pixel padding for the map viewport.
 */
function getPopupAutoPanPadding(map: L.Map): { top: number; left: number; bottom: number; right: number } {
  const container = map.getContainer();
  const containerRect = container.getBoundingClientRect();

  // Default safe padding
  let top = 20;
  let left = 20;
  let bottom = 20;
  let right = 20;

  // Detect floating search bar at top of map (mobile map view).
  // The bar sits inside the parent .relative wrapper at `top-3` (`top: 0.75rem`).
  const floatingSearch = container.closest('.relative')?.querySelector('[class*="absolute"][class*="top-3"]') as HTMLElement;
  if (floatingSearch) {
    const searchRect = floatingSearch.getBoundingClientRect();
    // How far the search bar's bottom edge extends below the map container's top
    const searchBottom = searchRect.bottom - containerRect.top;
    if (searchBottom > 0) {
      top = Math.max(top, searchBottom + 12); // 12px breathing room
    }
  }

  // On desktop, the sidebar search isn't overlaid but the header might be.
  // Desktop header is separate (DesktopHeader) and outside the map container,
  // so no extra top padding needed for it.

  // Detect zoom control at bottom-left
  const zoomControl = container.querySelector('.custom-zoom-control') as HTMLElement;
  if (zoomControl) {
    const zoomRect = zoomControl.getBoundingClientRect();
    const zoomRight = zoomRect.right - containerRect.left;
    if (zoomRight > 0) {
      left = Math.max(left, zoomRight + 10);
    }
    // Bottom padding = distance from container bottom to top of zoom control + breathing room
    const zoomDistFromBottom = containerRect.bottom - zoomRect.top;
    if (zoomDistFromBottom > 0) {
      bottom = Math.max(bottom, zoomDistFromBottom + 10);
    }
  }

  // Detect map style control above zoom (also bottom-left)
  const styleControl = container.querySelector('.map-style-control-container') as HTMLElement;
  if (styleControl) {
    const styleRect = styleControl.getBoundingClientRect();
    const styleRight = styleRect.right - containerRect.left;
    if (styleRight > 0) {
      left = Math.max(left, styleRight + 10);
    }
    // The style control is above the zoom; its top edge is further up
    const styleDistFromBottom = containerRect.bottom - styleRect.top;
    if (styleDistFromBottom > bottom) {
      bottom = Math.max(bottom, styleDistFromBottom + 10);
    }
  }

  // Detect near-me button at bottom-right
  const nearMe = container.querySelector('.near-me-button-container') as HTMLElement;
  if (nearMe) {
    const nearMeRect = nearMe.getBoundingClientRect();
    const nearMeDistFromRight = containerRect.right - nearMeRect.left;
    if (nearMeDistFromRight > 0) {
      right = Math.max(right, nearMeDistFromRight + 10);
    }
    // Also protect bottom-right area
    const nearMeDistFromBottom = containerRect.bottom - nearMeRect.top;
    if (nearMeDistFromBottom > 0) {
      bottom = Math.max(bottom, nearMeDistFromBottom + 10);
    }
  }

  return { top, left, bottom, right };
}

/**
 * Pan the map so a popup is fully visible, respecting UI overlay padding.
 * The popup tip extends ~12px below the popup element, and the marker icon
 * sits below that. We include extra bottom clearance for the tip + marker.
 */
function panMapForPopup(map: L.Map, popup: L.Popup) {
  const popupEl = popup.getElement();
  if (!popupEl) return;

  const containerRect = map.getContainer().getBoundingClientRect();
  const popupRect = popupEl.getBoundingClientRect();
  const padding = getPopupAutoPanPadding(map);

  // The popup tip (~12px) + marker icon (~48px) extend below the popup element.
  // We need the marker anchor point to stay above the bottom controls.
  const tipAndMarkerHeight = 60;

  let dx = 0;
  let dy = 0;

  // Check bottom overflow first (tip + marker must not overlap bottom controls)
  const bottomOverflow = (popupRect.bottom + tipAndMarkerHeight) - (containerRect.bottom - padding.bottom);
  if (bottomOverflow > 0) {
    dy = bottomOverflow; // positive = pan down (moves popup up on screen)
  }

  // Check top overflow (popup content must not hide behind search bar).
  // If we just panned down for bottom overflow, check if top is still visible.
  const topOverflow = (containerRect.top + padding.top) - (popupRect.top - dy);
  if (topOverflow > 0) {
    // Top is clipped. If popup fits in the safe area, prioritize top visibility.
    // If it doesn't fit, show as much from the top as possible.
    dy = dy - topOverflow; // negative adjustment = pan up (moves popup down on screen)
  }

  // Check left overflow
  if (popupRect.left < containerRect.left + padding.left) {
    dx = popupRect.left - (containerRect.left + padding.left);
  }
  // Check right overflow
  if (popupRect.right > containerRect.right - padding.right) {
    dx = popupRect.right - (containerRect.right - padding.right);
  }

  if (dx !== 0 || dy !== 0) {
    map.panBy([dx, dy], { animate: true, duration: 0.3 });
  }
}

/**
 * Open a Leaflet popup on a marker after React renders content into a container.
 * Uses a MutationObserver with a single fallback. Returns a cleanup function.
 */
function openPopupWhenReady(
  marker: L.Marker,
  container: HTMLDivElement,
  map: L.Map,
  abortSignal: { aborted: boolean },
): () => void {
  let observer: MutationObserver | null = null;
  let fallbackTimer: ReturnType<typeof setTimeout> | null = null;
  let panTimer: ReturnType<typeof setTimeout> | null = null;
  let opened = false;

  const doOpen = () => {
    if (opened || abortSignal.aborted) return;
    opened = true;

    // Disconnect observer and clear fallback
    if (observer) { observer.disconnect(); observer = null; }
    if (fallbackTimer) { clearTimeout(fallbackTimer); fallbackTimer = null; }

    if (!marker.isPopupOpen()) {
      marker.openPopup();
    }

    // After popup is open and painted, pan to ensure it's fully visible
    // Use two rAF to wait for layout + paint
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (abortSignal.aborted) return;
        panTimer = setTimeout(() => {
          const popup = marker.getPopup();
          if (popup && map.hasLayer(popup)) {
            panMapForPopup(map, popup);
          }
        }, 60);
      });
    });
  };

  // Watch for React to render content into the container
  observer = new MutationObserver(() => {
    if (container.childNodes.length > 0) {
      doOpen();
    }
  });
  observer.observe(container, { childList: true, subtree: true });

  // If content is already there (unlikely but safe)
  if (container.childNodes.length > 0) {
    doOpen();
  }

  // Safety fallback: if React doesn't render within 800ms, open anyway
  fallbackTimer = setTimeout(() => {
    doOpen();
  }, 800);

  return () => {
    abortSignal.aborted = true;
    if (observer) { observer.disconnect(); observer = null; }
    if (fallbackTimer) { clearTimeout(fallbackTimer); fallbackTimer = null; }
    if (panTimer) { clearTimeout(panTimer); panTimer = null; }
  };
}

// Component to handle popup opening for highlighted geocache.
// Map movement is handled externally (useMapController). This component
// waits for the map to finish moving, then finds the marker and opens the popup.
function PopupController({
  highlightedGeocache,
  geocaches,
  onMarkerClick
}: {
  highlightedGeocache?: string;
  geocaches: Geocache[];
  onMarkerClick: (geocache: Geocache, container: HTMLDivElement) => void;
}) {
  const map = useMap();
  const lastHighlightedRef = useRef<string | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  // Store geocaches and onMarkerClick in refs so the effect can always access
  // the latest values without re-running (and cancelling in-progress popup setup)
  // when their references change due to parent re-renders.
  const geocachesRef = useRef(geocaches);
  geocachesRef.current = geocaches;
  const onMarkerClickRef = useRef(onMarkerClick);
  onMarkerClickRef.current = onMarkerClick;

  useEffect(() => {
    // Clean up any pending operations from a previous highlight
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }

    if (highlightedGeocache) {
      lastHighlightedRef.current = highlightedGeocache;

      // Strip the optional `::timestamp` suffix used to force uniqueness
      const dTag = highlightedGeocache.replace(/::.*$/, '');

      const geocache = geocachesRef.current.find(g => g.dTag === dTag);
      if (!geocache?.location || !isFinite(geocache.location.lat) || !isFinite(geocache.location.lng)) {
        return;
      }

      map.closePopup();

      // Track all pending timers so cleanup can cancel them all
      const pendingTimers: ReturnType<typeof setTimeout>[] = [];
      let cancelled = false;
      let popupCleanup: (() => void) | null = null;

      const addTimer = (fn: () => void, delay: number) => {
        if (cancelled) return;
        const timer = setTimeout(() => {
          // Remove from tracking array
          const idx = pendingTimers.indexOf(timer);
          if (idx >= 0) pendingTimers.splice(idx, 1);
          if (!cancelled) fn();
        }, delay);
        pendingTimers.push(timer);
      };

      const maxAttempts = 25;

      const findAndOpenMarker = (attempt: number) => {
        if (attempt > maxAttempts || cancelled) {
          return;
        }

        let markerFound = false;

        map.eachLayer((layer: L.Layer) => {
          if (markerFound || cancelled) return;
          if (!(layer instanceof L.Marker) || !('getLatLng' in layer)) return;

          const marker = layer as L.Marker;
          const markerLatLng = marker.getLatLng();

          if (Math.abs(markerLatLng.lat - geocache.location.lat) < 0.0001 &&
              Math.abs(markerLatLng.lng - geocache.location.lng) < 0.0001) {

            // Only open popup on markers that are actually rendered on the map
            // (not still inside a cluster). Rendered markers have an _icon element.
            if (!(marker as unknown as Record<string, unknown>)._icon) return;

            markerFound = true;

            map.closePopup();

            const container = document.createElement('div');
            container.className = 'react-popup-root';

            if (marker.getPopup()) {
              marker.unbindPopup();
            }

            const padding = getPopupAutoPanPadding(map);
            marker.bindPopup(container, {
              maxWidth: 400,
              minWidth: 200,
              className: 'geocache-popup react-popup',
              closeButton: true,
              autoPan: true,
              autoPanPaddingTopLeft: L.point(padding.left, padding.top),
              autoPanPaddingBottomRight: L.point(padding.right, padding.bottom),
              keepInView: false,
              closeOnClick: false,
              closeOnEscapeKey: true,
            });

            // Pass the geocache + container to the callback so React can portal into it.
            // Use ref to always get the latest callback.
            onMarkerClickRef.current(geocache, container);

            // Wait for React to render then open popup with UI-aware panning
            const abortSignal = { aborted: false };
            popupCleanup = openPopupWhenReady(marker, container, map, abortSignal);
          }
        });

        // If marker wasn't found (e.g. cluster still processing), retry
        if (!markerFound && !cancelled) {
          const delay = Math.min(80 * Math.pow(1.2, attempt), 1000);
          addTimer(() => findAndOpenMarker(attempt + 1), delay);
        }
      };

      // Wait for the map to finish moving before searching for the marker.
      let moveEndFired = false;
      const onMoveEnd = () => {
        if (moveEndFired || cancelled) return;
        moveEndFired = true;
        map.off('moveend', onMoveEnd);
        // Allow cluster group time to process at the new zoom level
        addTimer(() => findAndOpenMarker(1), 150);
      };
      map.on('moveend', onMoveEnd);

      // Safety: if the map is already at the target (no move needed),
      // moveend won't fire, so also start a fallback timer.
      // If moveend already fired, this is a no-op.
      addTimer(() => {
        if (!moveEndFired && !cancelled) {
          moveEndFired = true;
          map.off('moveend', onMoveEnd);
          findAndOpenMarker(1);
        }
      }, 600);

      cleanupRef.current = () => {
        cancelled = true;
        map.off('moveend', onMoveEnd);
        for (const t of pendingTimers) clearTimeout(t);
        pendingTimers.length = 0;
        if (popupCleanup) { popupCleanup(); popupCleanup = null; }
      };
    } else if (!highlightedGeocache) {
      lastHighlightedRef.current = null;
    }
  }, [map, highlightedGeocache]);

  useEffect(() => {
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
    };
  }, []);

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
    return undefined;
  }, [isVisible, map]);

  return null;
}



// Component to handle world wrapping and ensure markers stay visible
function WorldWrapController({ geocaches }: { geocaches: Geocache[] }) {
  const map = useMap();

  useEffect(() => {
    const handleMoveEnd = () => {
      const center = map.getCenter();

      // Check if we've wrapped around the world
      if (center.lng > 180 || center.lng < -180) {
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

// Component to expose map reference and handle loading state
function MapRefController({
  mapRef,
  onMapReady
}: {
  mapRef?: React.RefObject<L.Map | null>;
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
    (containerRef as React.MutableRefObject<HTMLDivElement | null>).current = container;

    // Create React root and render the MapStyleSelector
    rootRef.current = createRoot(container);
    rootRef.current.render(
      <MapStyleSelector
        currentStyle={currentStyleRef.current}
        onStyleChange={onStyleChangeRef.current}
      />
    );

    (isInitializedRef as React.MutableRefObject<boolean>).current = true;

    const currentContainer = containerRef.current;

    // Cleanup
    return () => {
      if (currentContainer && currentContainer.parentNode) {
        currentContainer.parentNode.removeChild(currentContainer);
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

      (isInitializedRef as React.MutableRefObject<boolean>).current = false;
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

    // Get background color with opacity from CSS variable
    const bgColor = getComputedStyle(document.documentElement).getPropertyValue('--background').trim();
    const backgroundColor = bgColor ? `hsl(${bgColor} / 0.9)` : 'rgba(255, 255, 255, 0.9)';

    // Get accent color for hover
    const accentColor = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
    const accentBgColor = accentColor ? `hsl(${accentColor})` : 'rgba(240, 240, 240, 1)';

    // Get foreground color
    const fgColor = getComputedStyle(document.documentElement).getPropertyValue('--foreground').trim();
    const foregroundColor = fgColor ? `hsl(${fgColor})` : '#374151';

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
      background: ${backgroundColor};
      border: 1px solid hsl(var(--border));
      border-bottom: none;
      color: ${foregroundColor};
      font-size: 18px;
      font-weight: 500;
      line-height: 1;
      cursor: pointer;
      border-top-left-radius: 0.375rem;
      border-top-right-radius: 0.375rem;
      transition: all 0.2s ease;
      backdrop-filter: blur(8px);
    `;
    zoomInBtn.onmouseover = () => {
      zoomInBtn.style.background = accentBgColor;
    };
    zoomInBtn.onmouseout = () => {
      zoomInBtn.style.background = backgroundColor;
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
      background: ${backgroundColor};
      border: 1px solid hsl(var(--border));
      color: ${foregroundColor};
      font-size: 18px;
      font-weight: 500;
      line-height: 1;
      cursor: pointer;
      border-bottom-left-radius: 0.375rem;
      border-bottom-right-radius: 0.375rem;
      transition: all 0.2s ease;
      backdrop-filter: blur(8px);
    `;
    zoomOutBtn.onmouseover = () => {
      zoomOutBtn.style.background = accentBgColor;
    };
    zoomOutBtn.onmouseout = () => {
      zoomOutBtn.style.background = backgroundColor;
    };
    zoomOutBtn.onclick = () => {
      map.zoomOut();
    };

    container.appendChild(zoomInBtn);
    container.appendChild(zoomOutBtn);

    // Add container to map container
    mapContainer.appendChild(container);
    (containerRef as React.MutableRefObject<HTMLDivElement | null>).current = container;
    (isInitializedRef as React.MutableRefObject<boolean>).current = true;

    const currentContainer = containerRef.current;

    // Cleanup
    return () => {
      if (currentContainer && currentContainer.parentNode) {
        currentContainer.parentNode.removeChild(currentContainer);
      }
      (isInitializedRef as React.MutableRefObject<boolean>).current = false;
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
    (containerRef as React.MutableRefObject<HTMLDivElement | null>).current = container;

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

    (isInitializedRef as React.MutableRefObject<boolean>).current = true;

    const currentContainer = containerRef.current;

    // Cleanup
    return () => {
      if (currentContainer && currentContainer.parentNode) {
        currentContainer.parentNode.removeChild(currentContainer);
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

      (isInitializedRef as React.MutableRefObject<boolean>).current = false;
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

// Custom component for compass/radar button — positioned above Near Me button at lower right
function CompassMapButtonControl({
  onOpenRadar,
  isAdventureTheme
}: {
  onOpenRadar: () => void;
  isAdventureTheme: boolean;
}) {
  const map = useMap();
  const containerRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<ReturnType<typeof createRoot> | null>(null);
  const isInitializedRef = useRef(false);

  const onOpenRadarRef = useRef(onOpenRadar);
  const isAdventureThemeRef = useRef(isAdventureTheme);

  useEffect(() => {
    onOpenRadarRef.current = onOpenRadar;
    isAdventureThemeRef.current = isAdventureTheme;
  });

  useEffect(() => {
    if (isInitializedRef.current) return;

    const mapContainer = map.getContainer();

    const container = document.createElement('div');
    container.className = 'compass-button-container hidden lg:block';
    container.style.cssText = `
      position: absolute;
      bottom: 64px;
      right: 16px;
      z-index: 1000;
      pointer-events: auto;
    `;

    mapContainer.appendChild(container);
    (containerRef as React.MutableRefObject<HTMLDivElement | null>).current = container;

    rootRef.current = createRoot(container);
    rootRef.current.render(
      <CompassMapButton
        onClick={onOpenRadarRef.current}
        isAdventureTheme={isAdventureThemeRef.current}
      />
    );

    (isInitializedRef as React.MutableRefObject<boolean>).current = true;

    const currentContainer = containerRef.current;

    return () => {
      if (currentContainer && currentContainer.parentNode) {
        currentContainer.parentNode.removeChild(currentContainer);
      }
      if (rootRef.current) {
        const root = rootRef.current;
        rootRef.current = null;
        setTimeout(() => {
          try { root?.unmount(); } catch { /* ignore */ }
        }, 0);
      }
      (isInitializedRef as React.MutableRefObject<boolean>).current = false;
    };
  }, [map]);

  useEffect(() => {
    if (rootRef.current && isInitializedRef.current) {
      rootRef.current.render(
        <CompassMapButton
          onClick={onOpenRadarRef.current}
          isAdventureTheme={isAdventureThemeRef.current}
        />
      );
    }
  }, [onOpenRadar, isAdventureTheme]);

  return null;
}

// Custom tile layer with optimizations
function OptimizedTileLayer({ mapStyle, crossOriginTiles = true }: { mapStyle: MapStyle; crossOriginTiles?: boolean }) {

  return (
    <TileLayer
      attribution={mapStyle.attribution}
      url={mapStyle.url}
      maxZoom={18} // Reduced max zoom for better performance
      minZoom={2} // Allow zooming out further to see world wrapping
      // Optimize for fastest possible loading
      keepBuffer={1} // Smaller buffer for faster initial load
      updateWhenIdle={false} // Update immediately for faster rendering
      updateWhenZooming={false} // Don't update during zoom for smoother experience
      updateInterval={100} // Faster updates for quicker tile rendering
      // CORS: disabled in iOS Lockdown Mode (cross-origin restrictions)
      crossOrigin={crossOriginTiles ? "anonymous" : undefined}
      // Reduce tile loading overhead
      tileSize={256} // Standard tile size
      zoomOffset={0} // No zoom offset
      detectRetina={false} // Disable retina detection for consistency
      // World wrapping support
      noWrap={false} // Enable world wrapping
      bounds={[[-90, -180], [90, 180]]} // Standard world bounds
    />
  );
}

// Map styles are now imported from MapStyleSelector component

// Optional click-to-place handler for adventure center selection etc.
function MapClickHandler({ onClick }: { onClick: (location: { lat: number; lng: number }) => void }) {
  useMapEvents({
    click: (e) => {
      const target = e.originalEvent.target as HTMLElement;
      // Don't fire on controls, buttons, popups, or search UI
      if (target.closest('button') || target.closest('.leaflet-control') || target.closest('.leaflet-popup') || target.closest('[class*="omnisearch"]')) {
        return;
      }
      onClick({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
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
  onMapClick,
  initialMapStyle,
  adventures,
  onAdventureMarkerClick,
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



  const handleMarkerClick = useCallback((geocache: Geocache, popupContainer?: HTMLDivElement) => {
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
    keyboard: false, // Disable keyboard navigation for performance
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

  // Stable cluster event handlers
  const clusterEventHandlers = useMemo(() => ({
    clusteringbegin: () => {},
    clusteringend: () => {},
    unspiderfied: () => {},
  }), []);

  // Memoize marker elements so the cluster group does not reprocess markers
  // on every parent re-render (which would destroy open popups).
  const markerElements = useMemo(() =>
    (() => {
      const seen = new Set<string>();
      return geocaches.filter(g => g.location && g.dTag && !seen.has(g.dTag) && seen.add(g.dTag));
    })().slice(0, 200).map((geocache) => {
      const normalizedLng = ((geocache.location.lng + 180) % 360 + 360) % 360 - 180;
      const normalizedPosition = [geocache.location.lat, normalizedLng];

      return (
        <Marker
          key={geocache.dTag}
          position={normalizedPosition as LatLngExpression}
          icon={getCachedCacheIcon(geocache.type, currentMapStyle === 'adventure')}
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
                closeButton: true,
                autoPan: true,
                autoPanPaddingTopLeft: L.point(padding.left, padding.top),
                autoPanPaddingBottomRight: L.point(padding.right, padding.bottom),
                keepInView: false,
                closeOnClick: false,
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
              handleMarkerClickRef.current(null as unknown as Geocache, null as unknown as HTMLDivElement);
            }
          }}
        />
      );
    }),
    [geocaches, currentMapStyle]
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

      <MapSizeController isVisible={isVisible} />
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
                    closeButton: true,
                    autoPan: true,
                    autoPanPaddingTopLeft: L.point(padding.left, padding.top),
                    autoPanPaddingBottomRight: L.point(padding.right, padding.bottom),
                    keepInView: false,
                    closeOnClick: false,
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
        chunkedLoadingDelay={0} // No delay for instant marker rendering
        // Prevent popup issues during clustering operations
        iconCreateFunction={clusterIconFn}
        eventHandlers={clusterEventHandlers}
      >
        {markerElements}
      </MarkerClusterGroup>
    </MapContainer>

  </div>
  );
}