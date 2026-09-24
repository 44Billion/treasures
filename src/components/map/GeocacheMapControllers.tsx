/**
 * Invisible controller components for GeocacheMap.
 *
 * Each component renders nothing and exists to wire imperative map
 * behavior (centering, theming, popup orchestration, size invalidation,
 * click handling) into the React tree.
 */

import React, { useEffect, useRef } from "react";
import { useMapController } from "@/hooks/useMapController";
import type { Geocache } from "@/types/geocache";
import { useMapHandle } from "./mapContext";
import type { LatLngInput, MapHandle } from "./mapHandle";

declare global {
  interface Window {
    handleMapCardClick?: (center: { lat: number; lng: number }, zoom: number) => void;
  }
}

// Component to handle map centering
export function MapController({
  center,
  zoom,
  searchLocation,
  searchRadius,
  isMapCenterLocked = false
}: {
  center: LatLngInput;
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
    window.handleMapCardClick = handleCardClick;
    return () => {
      delete window.handleMapCardClick;
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
  const map = useMapHandle();

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
// waits for the map to finish moving, then opens the geocache's popup.
export function PopupController({
  highlightedGeocache,
  geocaches,
  openPopup
}: {
  highlightedGeocache?: string;
  geocaches: Geocache[];
  openPopup: (geocache: Geocache) => void;
}) {
  const map = useMapHandle();
  const cleanupRef = useRef<(() => void) | null>(null);

  // Store geocaches and openPopup in refs so the effect can always access
  // the latest values without re-running (and cancelling in-progress popup setup)
  // when their references change due to parent re-renders.
  const geocachesRef = useRef(geocaches);
  geocachesRef.current = geocaches;
  const openPopupRef = useRef(openPopup);
  openPopupRef.current = openPopup;

  useEffect(() => {
    // Clean up any pending operations from a previous highlight
    cleanupRef.current?.();
    cleanupRef.current = null;

    if (!highlightedGeocache) return;

    // Strip the optional `::timestamp` suffix used to force uniqueness
    const dTag = highlightedGeocache.replace(/::.*$/, '');

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const open = () => {
      if (cancelled) return;
      cancelled = true;
      map.off('moveend', onMoveEnd);
      if (timer) clearTimeout(timer);
      const geocache = geocachesRef.current.find(g => g.dTag === dTag);
      if (!geocache?.location || !isFinite(geocache.location.lat) || !isFinite(geocache.location.lng)) {
        return;
      }
      openPopupRef.current(geocache);
    };

    // Wait for the map to finish moving to the geocache before opening.
    const onMoveEnd = () => open();
    map.closePopup();
    map.on('moveend', onMoveEnd);

    // Safety: if the map is already at the target (no move needed),
    // moveend won't fire, so also start a fallback timer.
    timer = setTimeout(open, 600);

    cleanupRef.current = () => {
      cancelled = true;
      map.off('moveend', onMoveEnd);
      if (timer) clearTimeout(timer);
    };
  }, [map, highlightedGeocache]);

  useEffect(() => {
    return () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, []);

  return null;
}

// Component to re-measure the map when its container is shown or resized by layout
export function MapSizeController({ isVisible, layoutKey }: { isVisible?: boolean; layoutKey?: string | boolean }) {
  const map = useMapHandle();

  // Re-measure when visibility changes (handles tab switches on mobile)
  useEffect(() => {
    if (!isVisible) return;
    // Use a short delay to ensure the container is fully visible before measuring
    const timer = setTimeout(() => map.invalidateSize(), 50);
    return () => clearTimeout(timer);
  }, [isVisible, map]);

  // Re-measure when layout changes (e.g. sidebar collapse/expand)
  useEffect(() => {
    if (layoutKey === undefined) return;
    const timer = setTimeout(() => map.invalidateSize(), 310); // slightly after the 300ms CSS transition
    return () => clearTimeout(timer);
  }, [layoutKey, map]);

  return null;
}

// Component to expose map reference
export function MapRefController({
  mapRef,
}: {
  mapRef?: React.RefObject<MapHandle | null>;
}) {
  const map = useMapHandle();

  useEffect(() => {
    if (!mapRef) return;
    (mapRef as React.MutableRefObject<MapHandle | null>).current = map;
    return () => {
      (mapRef as React.MutableRefObject<MapHandle | null>).current = null;
    };
  }, [map, mapRef]);

  return null;
}

// Optional click-to-place handler for adventure center selection etc.
export function MapClickHandler({ onClick }: { onClick: (location: { lat: number; lng: number }) => void }) {
  const map = useMapHandle();
  const onClickRef = useRef(onClick);
  onClickRef.current = onClick;

  // Marker clicks and floating controls never reach the map, so every
  // click that arrives here landed on the map itself.
  useEffect(() => map.onClick((position) => onClickRef.current(position)), [map]);

  return null;
}
