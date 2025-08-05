import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
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
  const userIsInteracting = useRef(false);
  const userHasInteracted = useRef(false);
  const interactionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isMovingRef = useRef(false);
  const isProgrammaticMove = useRef(false);
  const isManualCardClick = useRef(false);

  // Function to handle explicit card clicks - clears all interaction locks
  const handleCardClick = (newCenter: { lat: number; lng: number }, newZoom: number) => {
    // Clear all interaction locks for explicit user actions
    userIsInteracting.current = false;
    userHasInteracted.current = false;
    
    if (interactionTimeoutRef.current) {
      clearTimeout(interactionTimeoutRef.current);
      interactionTimeoutRef.current = null;
    }

    // Mark as programmatic move and manual card click to prevent useEffect from triggering
    isProgrammaticMove.current = true;
    isManualCardClick.current = true;
    
    map.setView([newCenter.lat, newCenter.lng], newZoom, {
      animate: false, // No animation for immediate response
      duration: 0
    });

    // Reset programmatic move flag after a short delay
    setTimeout(() => {
      isProgrammaticMove.current = false;
      isManualCardClick.current = false;
    }, 100);

    // Update last center reference to prevent useEffect from triggering
    const centerKey = `${newCenter.lat},${newCenter.lng},${newZoom}`;
    lastCenterRef.current = centerKey;
  };

  useEffect(() => {
    // Comprehensive user interaction tracking
    const handleInteractionStart = (_event?: L.LeafletEvent) => {
      // Don't mark as user interaction if this is a programmatic move
      if (isProgrammaticMove.current) {
        return;
      }
      
      userIsInteracting.current = true;
      userHasInteracted.current = true;
      
      // Clear any existing timeout
      if (interactionTimeoutRef.current) {
        clearTimeout(interactionTimeoutRef.current);
      }
    };
    
    const handleInteractionEnd = () => {
      userIsInteracting.current = false;
      
      // Set a reasonable timeout before allowing automatic updates
      interactionTimeoutRef.current = setTimeout(() => {
        userHasInteracted.current = false;
      }, 8000); // 8 seconds - balanced protection that's not too long
    };
    
    // Track map movement state
    const handleMoveStart = (event?: L.LeafletEvent) => {
      isMovingRef.current = true;
      // If this is not a programmatic move, mark it as user interaction
      if (!isProgrammaticMove.current) {
        handleInteractionStart(event);
      }
    };
    
    const handleMoveEnd = () => {
      isMovingRef.current = false;
      // Reset programmatic move flag after move completes
      if (isProgrammaticMove.current) {
        isProgrammaticMove.current = false;
      }
    };
    
    // Listen to all possible user interactions
    map.on('dragstart', handleInteractionStart);
    map.on('dragend', handleInteractionEnd);
    map.on('zoomstart', handleInteractionStart);
    map.on('zoomend', handleInteractionEnd);
    map.on('movestart', handleMoveStart);
    map.on('moveend', handleMoveEnd);
    
    // Also track movement for popup timing
    map.on('movestart', handleMoveStart);
    map.on('moveend', handleMoveEnd);
    map.on('zoomstart', handleMoveStart);
    map.on('zoomend', handleMoveEnd);
    
    // Also listen for mouse/touch events as backup
    const mapContainer = map.getContainer();
    const handleDomInteractionStart = (_e: Event) => {
      handleInteractionStart();
    };
    mapContainer.addEventListener('mousedown', handleDomInteractionStart);
    mapContainer.addEventListener('touchstart', handleDomInteractionStart);
    
    return () => {
      map.off('dragstart', handleInteractionStart);
      map.off('dragend', handleInteractionEnd);
      map.off('zoomstart', handleInteractionStart);
      map.off('zoomend', handleInteractionEnd);
      map.off('movestart', handleMoveStart);
      map.off('moveend', handleMoveEnd);
      
      map.off('movestart', handleMoveStart);
      map.off('moveend', handleMoveEnd);
      map.off('zoomstart', handleMoveStart);
      map.off('zoomend', handleMoveEnd);
      
      mapContainer.removeEventListener('mousedown', handleDomInteractionStart);
      mapContainer.removeEventListener('touchstart', handleDomInteractionStart);
      
      if (interactionTimeoutRef.current) {
        clearTimeout(interactionTimeoutRef.current);
      }
    };
  }, [map]);

  useEffect(() => {
    if (center) {
      // Create a key to track if the center has actually changed
      const centerArray = Array.isArray(center) ? center : [(center as { lat: number; lng: number }).lat, (center as { lat: number; lng: number }).lng];
      const centerKey = `${centerArray[0]},${centerArray[1]},${zoom}`;
      
      // Only update if center has actually changed, user isn't currently interacting, 
      // and this is not a manual card click (which is handled separately)
      if (centerKey !== lastCenterRef.current && 
          !userIsInteracting.current &&
          !isMapCenterLocked &&
          !isManualCardClick.current) {
        
        lastCenterRef.current = centerKey;
        
        // Mark this as a programmatic move to prevent triggering user interaction tracking
        isProgrammaticMove.current = true;
        
        // Reset user interaction state for explicit card clicks (high zoom levels)
        if (zoom >= 15) {
          userHasInteracted.current = false;
          if (interactionTimeoutRef.current) {
            clearTimeout(interactionTimeoutRef.current);
          }
        }
        
        // If we have a search location with radius, use radius-based zoom
        if (searchLocation && searchRadius) {
          const targetZoom = getZoomForRadius(searchRadius);
          
          map.setView([searchLocation.lat, searchLocation.lng], targetZoom, {
            animate: true,
            duration: 0.5
          });
          lastRadiusRef.current = searchRadius;
        } else {
          // For card clicks (when zoom is 16 or higher), use no animation for immediate response
          const useAnimation = zoom < 15;
          
          map.setView(center, zoom, {
            animate: useAnimation,
            duration: useAnimation ? 0.5 : 0
          });
        }
        
        // Reset programmatic move flag after a short delay
        setTimeout(() => {
          isProgrammaticMove.current = false;
        }, 100);
      }
    }
  }, [map, center, zoom, searchLocation, searchRadius, isMapCenterLocked]);

  // Handle radius changes independently of center changes
  useEffect(() => {
    if (searchLocation && searchRadius && 
        lastRadiusRef.current !== searchRadius && 
        !userIsInteracting.current &&
        !isMapCenterLocked) {
      
      lastRadiusRef.current = searchRadius;
      
      // Mark this as a programmatic move to prevent triggering user interaction tracking
      isProgrammaticMove.current = true;
      
      // Calculate appropriate zoom level based on radius and update map
      const targetZoom = getZoomForRadius(searchRadius);
      
      map.setView([searchLocation.lat, searchLocation.lng], targetZoom, {
        animate: true,
        duration: 0.25
      });
      
      // Reset programmatic move flag after a short delay
      setTimeout(() => {
        isProgrammaticMove.current = false;
      }, 100);
    }
  }, [map, searchLocation, searchRadius, isMapCenterLocked]);

  return {
    handleCardClick,
  };
}

// Helper function to calculate appropriate zoom level based on search radius
function getZoomForRadius(radius: number): number {
  if (radius <= 1) {
    return 15; // Very close for 1km
  } else if (radius <= 5) {
    return 13; // Close for 5km
  } else if (radius <= 10) {
    return 12; // Medium for 10km
  } else if (radius <= 25) {
    return 10; // Wider for 25km
  } else if (radius <= 50) {
    return 9;  // Wide for 50km
  } else {
    return 8;  // Very wide for 100km+
  }
}