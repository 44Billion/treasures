import { useEffect, useRef, useCallback } from 'react';
import { useMap } from 'react-leaflet';
import type { LatLngExpression } from 'leaflet';

interface UseMapControllerProps {
  center: LatLngExpression;
  zoom: number;
  searchLocation?: { lat: number; lng: number } | null;
  searchRadius?: number;
  isMapCenterLocked?: boolean;
}

export function useMapController({
  center,
  zoom,
  searchLocation,
  searchRadius,
  isMapCenterLocked = false,
}: UseMapControllerProps) {
  const map = useMap();
  const lastCenterRef = useRef<string | null>(null);
  const lastRadiusRef = useRef<number | null>(null);
  // Track whether the user is actively dragging the map
  const isDragging = useRef(false);
  // Brief cooldown after a user drag to avoid fighting with the user
  const cooldownUntil = useRef(0);
  // Track programmatic setView calls so zoomend/moveend don't set cooldowns
  const isProgrammatic = useRef(false);

  // Function to handle explicit card clicks — bypasses all guards
  const handleCardClick = useCallback((newCenter: { lat: number; lng: number }, newZoom: number) => {
    cooldownUntil.current = 0;
    isDragging.current = false;
    isProgrammatic.current = true;

    map.setView([newCenter.lat, newCenter.lng], newZoom, {
      animate: false,
      duration: 0,
    });

    const centerKey = `${newCenter.lat},${newCenter.lng},${newZoom}`;
    lastCenterRef.current = centerKey;
  }, [map]);

  useEffect(() => {
    const onDragStart = () => {
      isDragging.current = true;
    };
    const onDragEnd = () => {
      isDragging.current = false;
      cooldownUntil.current = Date.now() + 2000;
    };
    const onMoveEnd = () => {
      // Clear the programmatic flag once the move finishes
      isProgrammatic.current = false;
    };

    map.on('dragstart', onDragStart);
    map.on('dragend', onDragEnd);
    map.on('moveend', onMoveEnd);

    return () => {
      map.off('dragstart', onDragStart);
      map.off('dragend', onDragEnd);
      map.off('moveend', onMoveEnd);
    };
  }, [map]);

  // React to center/zoom prop changes
  useEffect(() => {
    if (!center || isMapCenterLocked) return;

    const centerArray = Array.isArray(center)
      ? center
      : [(center as { lat: number; lng: number }).lat, (center as { lat: number; lng: number }).lng];
    const centerKey = `${centerArray[0]},${centerArray[1]},${zoom}`;

    if (centerKey === lastCenterRef.current) return;
    if (isDragging.current || Date.now() < cooldownUntil.current) return;

    lastCenterRef.current = centerKey;
    isProgrammatic.current = true;

    if (searchLocation && searchRadius) {
      const targetZoom = getZoomForRadius(searchRadius);
      map.setView([searchLocation.lat, searchLocation.lng], targetZoom, {
        animate: true,
        duration: 0.5,
      });
      lastRadiusRef.current = searchRadius;
    } else {
      const useAnimation = zoom < 15;
      map.setView(center, zoom, {
        animate: useAnimation,
        duration: useAnimation ? 0.5 : 0,
      });
    }
  }, [map, center, zoom, searchLocation, searchRadius, isMapCenterLocked]);

  // Handle radius changes independently
  useEffect(() => {
    if (!searchLocation || !searchRadius || isMapCenterLocked) return;
    if (lastRadiusRef.current === searchRadius) return;
    if (isDragging.current || Date.now() < cooldownUntil.current) return;

    lastRadiusRef.current = searchRadius;
    isProgrammatic.current = true;

    const targetZoom = getZoomForRadius(searchRadius);
    map.setView([searchLocation.lat, searchLocation.lng], targetZoom, {
      animate: true,
      duration: 0.25,
    });
  }, [map, searchLocation, searchRadius, isMapCenterLocked]);

  return { handleCardClick };
}

function getZoomForRadius(radius: number): number {
  if (radius <= 1) return 15;
  if (radius <= 5) return 13;
  if (radius <= 10) return 12;
  if (radius <= 25) return 10;
  if (radius <= 50) return 9;
  return 8;
}
