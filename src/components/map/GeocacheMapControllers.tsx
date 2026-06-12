/**
 * Invisible controller components for GeocacheMap.
 *
 * Each component renders nothing and exists to wire imperative Leaflet
 * behavior (centering, theming, popup orchestration, size invalidation,
 * world wrapping, click handling) into the react-leaflet tree.
 */

 

import React, { useEffect, useRef } from "react";
import { useMap, useMapEvents } from "react-leaflet";
import { LatLngExpression } from "leaflet";
import L from "leaflet";
import { useMapController } from "@/hooks/useMapController";
import type { Geocache } from "@/types/geocache";
import { getPopupAutoPanPadding, openPopupWhenReady } from "./popupPositioning";

// Component to handle map centering
export function MapController({
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
export function ThemeController({
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
    container.classList.remove('dark-theme', 'adventure-theme', 'mojave-theme', 'system-dark-theme');

    // Add current theme class
    if (currentStyle === 'dark') {
      container.classList.add('dark-theme');
    } else if (currentStyle === 'adventure') {
      container.classList.add('adventure-theme');
    } else if (currentStyle === 'mojave') {
      container.classList.add('mojave-theme');
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
// Component to handle popup opening for highlighted geocache.
// Map movement is handled externally (useMapController). This component
// waits for the map to finish moving, then finds the marker and opens the popup.
export function PopupController({
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
              closeButton: false,
              autoPan: true,
              autoPanPaddingTopLeft: L.point(padding.left, padding.top),
              autoPanPaddingBottomRight: L.point(padding.right, padding.bottom),
              keepInView: false,
              closeOnClick: true,
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
export function MapSizeController({ isVisible, layoutKey }: { isVisible?: boolean; layoutKey?: string | boolean }) {
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

  // Invalidate map size when layout changes (e.g. sidebar collapse/expand)
  useEffect(() => {
    if (layoutKey === undefined) return;
    const timer = setTimeout(() => {
      if (map && typeof map.invalidateSize === 'function') {
        map.invalidateSize();
      }
    }, 310); // slightly after the 300ms CSS transition
    return () => clearTimeout(timer);
  }, [layoutKey, map]);

  return null;
}



// Component to handle world wrapping and ensure markers stay visible
export function WorldWrapController({ geocaches }: { geocaches: Geocache[] }) {
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
export function MapRefController({
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

// Optional click-to-place handler for adventure center selection etc.
export function MapClickHandler({ onClick }: { onClick: (location: { lat: number; lng: number }) => void }) {
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
