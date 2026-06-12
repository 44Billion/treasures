/**
 * Floating button controls for GeocacheMap.
 *
 * These mount real React components (style selector, near-me, compass,
 * earth-view buttons) into absolutely positioned containers inside the
 * Leaflet map container, each backed by its own React root.
 */

import React, { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import { createRoot } from "react-dom/client";
import { MapStyleSelector } from "@/components/MapStyleSelector";
import { NearMeButton } from "@/components/NearMeButton";
import { CompassMapButton } from "@/components/CompassMapButton";
import { EarthViewMapButton } from "@/components/EarthViewMapButton";

// Custom map style control - positioned at lower left above zoom
export function MapStyleControl({
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
      bottom: calc(106px + env(safe-area-inset-bottom, 0px));
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

// Custom component for near me button - positioned at lower right corner
export function NearMeButtonControl({
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
      bottom: calc(16px + env(safe-area-inset-bottom, 0px));
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
export function CompassMapButtonControl({
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
      bottom: calc(112px + env(safe-area-inset-bottom, 0px));
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

// Custom component for earth view button — positioned between compass and Near Me at lower right
export function EarthViewButtonControl({
  onShowEarth
}: {
  onShowEarth: () => void;
}) {
  const map = useMap();
  const containerRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<ReturnType<typeof createRoot> | null>(null);
  const isInitializedRef = useRef(false);

  const onShowEarthRef = useRef(onShowEarth);

  useEffect(() => {
    onShowEarthRef.current = onShowEarth;
  });

  useEffect(() => {
    if (isInitializedRef.current) return;

    const mapContainer = map.getContainer();

    const container = document.createElement('div');
    container.className = 'earth-button-container';
    container.style.cssText = `
      position: absolute;
      bottom: calc(64px + env(safe-area-inset-bottom, 0px));
      right: 16px;
      z-index: 1000;
      pointer-events: auto;
    `;

    mapContainer.appendChild(container);
    (containerRef as React.MutableRefObject<HTMLDivElement | null>).current = container;

    rootRef.current = createRoot(container);
    rootRef.current.render(
      <EarthViewMapButton onClick={onShowEarthRef.current} />
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
        <EarthViewMapButton onClick={onShowEarthRef.current} />
      );
    }
  }, [onShowEarth]);

  return null;
}
