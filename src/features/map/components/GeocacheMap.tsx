import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Circle, useMap } from "react-leaflet";
import { LatLngExpression, LatLngBounds } from "leaflet";
import L from "leaflet";
import { createRoot } from "react-dom/client";
import { useTheme } from "next-themes";
import MarkerClusterGroup from "react-leaflet-cluster";
import { MapStyleSelector } from "./MapStyleSelector";
import { MAP_STYLES, type MapStyle } from "@/features/map/constants/mapStyles";
import { useGeocacheNavigation } from "@/features/geocache/hooks/useGeocacheNavigation";
import type { Geocache } from "@/shared/types";
import { getTypeLabel, getSizeLabel } from "@/features/geocache/utils/geocache-utils";

import { getCacheIconSvg, getCacheColor } from "@/features/geocache/utils/cacheIconUtils";
import { useOfflineMode, useOfflineSettings } from "@/features/offline/hooks/useOfflineStorage";
import { getCacheEntryCount, cacheMapTile } from "@/features/geocache/utils/cacheUtils";
import { CACHE_NAMES } from "@/shared/config";

// Import Leaflet CSS and adventure theme
import "leaflet/dist/leaflet.css";
import "../map.css";

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
        <span class="px-2 py-1 text-xs bg-secondary rounded">${getSizeLabel(geocache.size)}</span>
        <span class="px-2 py-1 text-xs bg-secondary rounded">${getTypeLabel(geocache.type)}</span>
      </div>
      
      <p class="text-xs text-gray-600 mb-3 line-clamp-2">${description}</p>
      
      <div class="flex gap-2">
        <button 
          class="flex-1 bg-blue-600 text-white text-xs px-3 py-2 rounded hover:bg-blue-700 transition-colors"
          onclick="window.dispatchEvent(new CustomEvent('geocache-view-details', { detail: '${geocache.dTag}' }))"
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
  highlightedGeocache?: string; // dTag of geocache to highlight/open popup
  showStyleSelector?: boolean; // Whether to show the map style selector
  isNearMeActive?: boolean; // Whether "Near Me" mode is active
  mapRef?: React.RefObject<L.Map>; // Reference to the map instance
  isMapCenterLocked?: boolean; // Whether map center is locked from user interaction
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
  const map = useMap();
  const lastCenterRef = useRef<string | null>(null);
  const lastRadiusRef = useRef<number | null>(null);
  const userIsInteracting = useRef(false);
  const userHasInteracted = useRef(false);
  const lastUpdateTime = useRef<number>(0);
  const interactionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  useEffect(() => {
    // Comprehensive user interaction tracking
    const handleInteractionStart = () => {
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
    
    // Listen to all possible user interactions
    map.on('dragstart', handleInteractionStart);
    map.on('dragend', handleInteractionEnd);
    map.on('zoomstart', handleInteractionStart);
    map.on('zoomend', handleInteractionEnd);
    map.on('movestart', handleInteractionStart);
    map.on('moveend', handleInteractionEnd);
    
    // Also listen for mouse/touch events as backup
    const mapContainer = map.getContainer();
    mapContainer.addEventListener('mousedown', handleInteractionStart);
    mapContainer.addEventListener('touchstart', handleInteractionStart);
    
    return () => {
      map.off('dragstart', handleInteractionStart);
      map.off('dragend', handleInteractionEnd);
      map.off('zoomstart', handleInteractionStart);
      map.off('zoomend', handleInteractionEnd);
      map.off('movestart', handleInteractionStart);
      map.off('moveend', handleInteractionEnd);
      
      mapContainer.removeEventListener('mousedown', handleInteractionStart);
      mapContainer.removeEventListener('touchstart', handleInteractionStart);
      
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
      const now = Date.now();
      
      // NEVER update if user is currently interacting or has interacted recently
      // NEVER update if map center is locked from parent component
      // Only update if enough time has passed since last update (prevent spam)
      if (centerKey !== lastCenterRef.current && 
          !userIsInteracting.current &&
          !userHasInteracted.current &&
          !isMapCenterLocked &&
          now - lastUpdateTime.current > 1000) { // Reduced to 1 second for more responsive location updates
        
        lastCenterRef.current = centerKey;
        lastUpdateTime.current = now;
        
        // If we have a search location with radius, use radius-based zoom
        if (searchLocation && searchRadius) {
          const targetZoom = getZoomForRadius(searchRadius);
          
          map.setView([searchLocation.lat, searchLocation.lng], targetZoom, {
            animate: true,
            duration: 0.5 // Slightly longer animation for smoother experience
          });
          lastRadiusRef.current = searchRadius;
        } else {
          // Otherwise just set the view
          map.setView(center, zoom, {
            animate: true,
            duration: 0.5
          });
        }
      }
    }
  }, [map, center, zoom, searchLocation, searchRadius, isMapCenterLocked]);
  
  // Handle radius changes independently of center changes
  useEffect(() => {
    if (searchLocation && searchRadius && 
        lastRadiusRef.current !== searchRadius && 
        !userIsInteracting.current &&
        !userHasInteracted.current &&
        !isMapCenterLocked) {
      
      lastRadiusRef.current = searchRadius;
      
      // Calculate appropriate zoom level based on radius and update map
      const targetZoom = getZoomForRadius(searchRadius);
      
      map.setView([searchLocation.lat, searchLocation.lng], targetZoom, {
        animate: true,
        duration: 0.25
      });
    }
  }, [map, searchLocation, searchRadius, isMapCenterLocked]);
  
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
  const popupTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  useEffect(() => {
    // Clear any existing timeout
    if (popupTimeoutRef.current) {
      clearTimeout(popupTimeoutRef.current);
      popupTimeoutRef.current = null;
    }
    
    // Only open popup if highlightedGeocache has actually changed
    if (highlightedGeocache && highlightedGeocache !== lastHighlightedRef.current) {
      lastHighlightedRef.current = highlightedGeocache;
      
      // Find the geocache
      const geocache = geocaches.find(g => g.dTag === highlightedGeocache);
      if (geocache) {
        // Small delay to ensure map has centered, then trigger popup on the marker
        popupTimeoutRef.current = setTimeout(() => {
          // Find all markers and open the popup for the matching one
          map.eachLayer((layer: L.Layer) => {
            if (layer instanceof L.Marker && 'getLatLng' in layer) {
              const markerLatLng = (layer as L.Marker).getLatLng();
              if (Math.abs(markerLatLng.lat - geocache.location.lat) < 0.0001 && 
                  Math.abs(markerLatLng.lng - geocache.location.lng) < 0.0001) {
                (layer as L.Marker).openPopup();
              }
            }
          });
        }, 500);
      }
    } else if (!highlightedGeocache) {
      // Clear the reference when no geocache is highlighted
      lastHighlightedRef.current = null;
    }
    
    return () => {
      if (popupTimeoutRef.current) {
        clearTimeout(popupTimeoutRef.current);
        popupTimeoutRef.current = null;
      }
    };
  }, [map, highlightedGeocache, geocaches]);
  
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

// Custom Leaflet control for map style selector
function MapStyleControl({ 
  currentStyle, 
  onStyleChange 
}: { 
  currentStyle: string; 
  onStyleChange: (style: string) => void; 
}) {
  const map = useMap();
  const rootRef = useRef<ReturnType<typeof createRoot> | null>(null);
  const controlRef = useRef<L.Control | null>(null);
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
    
    // Create a custom control
    const StyleControl = L.Control.extend({
      onAdd: function() {
        const div = L.DomUtil.create('div', 'leaflet-control leaflet-bar map-style-control');
        div.style.background = 'transparent';
        div.style.border = 'none';
        div.style.margin = '0';
        div.style.position = 'relative';
        div.style.zIndex = '1000';
        
        // Prevent map interaction when clicking on the control
        L.DomEvent.disableClickPropagation(div);
        L.DomEvent.disableScrollPropagation(div);
        
        // Create React root and render the MapStyleSelector
        rootRef.current = createRoot(div);
        rootRef.current.render(
          <MapStyleSelector
            currentStyle={currentStyleRef.current}
            onStyleChange={onStyleChangeRef.current}
          />
        );
        
        return div;
      }
    });
    
    const styleControl = new StyleControl({ position: 'topright' });
    controlRef.current = styleControl;
    map.addControl(styleControl);
    isInitializedRef.current = true;
    
    // Cleanup
    return () => {
      // Remove control first to prevent further interactions
      if (controlRef.current) {
        map.removeControl(controlRef.current);
        controlRef.current = null;
      }
      
      // Unmount React root asynchronously to avoid synchronous unmount during render
      if (rootRef.current) {
        const root = rootRef.current;
        rootRef.current = null;
        
        // Use setTimeout to defer unmounting until after current render cycle
        setTimeout(() => {
          try {
            // Double-check that the root is still valid before unmounting
            if (root && typeof root.unmount === 'function') {
              root.unmount();
            }
          } catch (error) {
            // Silently handle unmount errors - component may already be unmounted
            console.debug('MapStyleControl unmount:', error);
          }
        }, 0);
      }
      
      isInitializedRef.current = false;
    };
  }, [map]); // Only depend on map
  
  // Update the rendered component when props change (without recreating the control)
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

// Component to handle automatic offline tile caching
function AutoOfflineTileManager({ 
  userLocation, 
  searchLocation, 
  searchRadius,
  isNearMeActive,
  mapStyle
}: { 
  userLocation?: { lat: number; lng: number } | null;
  searchLocation?: { lat: number; lng: number } | null;
  searchRadius?: number;
  isNearMeActive?: boolean;
  mapStyle: MapStyle;
}) {
  const map = useMap();
  const { isOnline, isOfflineMode } = useOfflineMode();
  const { settings } = useOfflineSettings();
  const [, setCachedTiles] = useState(0);
  const [, setIsDownloading] = useState(false);
  const [lastCachedLocation, setLastCachedLocation] = useState<string | null>(null);

  const autoCacheMaps = (settings.autoCacheMaps as boolean) ?? false;

  // Check storage limits before caching
  const checkStorageBeforeCaching = useCallback(async (): Promise<boolean> => {
    try {
      const { isStorageNearLimit } = await import('@/shared/utils/storageConfig');
      const nearLimit = await isStorageNearLimit();
      if (nearLimit) {
        console.log('Storage near limit, skipping map caching');
        return false;
      }
      return true;
    } catch (error) {
      console.warn('Failed to check storage limit:', error);
      return true; // Default to allowing caching if check fails
    }
  }, []);

  const downloadTilesForBounds = React.useCallback(async (bounds: LatLngBounds, minZoom: number, maxZoom: number) => {
    if (!isOnline || isOfflineMode) return 0;
    
    // Check storage limits before starting download
    const canCache = await checkStorageBeforeCaching();
    if (!canCache) return 0;
    
    setIsDownloading(true);
    let downloadedCount = 0;

    try {
      for (let z = minZoom; z <= maxZoom; z++) {
        const northEast = bounds.getNorthEast();
        const southWest = bounds.getSouthWest();
        
        const minTileX = Math.floor((southWest.lng + 180) / 360 * Math.pow(2, z));
        const maxTileX = Math.floor((northEast.lng + 180) / 360 * Math.pow(2, z));
        const minTileY = Math.floor((1 - Math.log(Math.tan(northEast.lat * Math.PI / 180) + 1 / Math.cos(northEast.lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, z));
        const maxTileY = Math.floor((1 - Math.log(Math.tan(southWest.lat * Math.PI / 180) + 1 / Math.cos(southWest.lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, z));

        // Limit the number of tiles to prevent overwhelming the server
        const totalTiles = (maxTileX - minTileX + 1) * (maxTileY - minTileY + 1);
        if (totalTiles > 100) {
          console.log(`Skipping zoom level ${z} - too many tiles (${totalTiles})`);
          continue;
        }

        for (let x = minTileX; x <= maxTileX; x++) {
          for (let y = minTileY; y <= maxTileY; y++) {
            try {
              // Use the current map style's URL template
              let tileUrl = mapStyle.url
                .replace('{z}', z.toString())
                .replace('{x}', x.toString())
                .replace('{y}', y.toString())
                .replace('{r}', ''); // Remove retina suffix if present
              
              // Handle subdomain replacement for styles that use it
              if (tileUrl.includes('{s}')) {
                tileUrl = tileUrl.replace('{s}', 'a'); // Use 'a' subdomain
              }
              
              const success = await cacheMapTile(tileUrl);
              if (success) {
                downloadedCount++;
              }
              
              // Add small delay to avoid overwhelming the server
              await new Promise(resolve => setTimeout(resolve, 50));
            } catch (error) {
              console.warn(`Failed to download tile ${z}/${x}/${y}:`, error);
            }
          }
        }
      }

      setCachedTiles(prev => prev + downloadedCount);
      
      // Silent caching - no user notification needed
      
      return downloadedCount;
    } catch (error) {
      console.error('Failed to download tiles:', error);
      // Silent failure - no user notification needed for background caching
      return 0;
    } finally {
      setIsDownloading(false);
    }
  }, [isOnline, isOfflineMode, mapStyle.url, checkStorageBeforeCaching]);

  // Auto-cache initial map view - don't block initial display
  useEffect(() => {
    if (!isOnline || isOfflineMode || !autoCacheMaps) return;

    const cacheInitialView = async () => {
      // Minimal wait time - don't block map display
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const bounds = map.getBounds();
      const currentZoom = map.getZoom();
      
      // Cache current view and one zoom level up/down
      await downloadTilesForBounds(
        bounds, 
        Math.max(currentZoom - 1, 8), 
        Math.min(currentZoom + 1, 16)
      );
    };

    cacheInitialView();
  }, [map, isOnline, isOfflineMode, autoCacheMaps, downloadTilesForBounds]);

  // Auto-cache when Near Me is activated or search location changes
  useEffect(() => {
    if (!isOnline || isOfflineMode || !autoCacheMaps) return;

    const cacheLocationArea = async () => {
      const location = searchLocation || (isNearMeActive ? userLocation : null);
      if (!location) return;

      // Create a location key to avoid re-caching the same area
      const locationKey = `${location.lat.toFixed(4)},${location.lng.toFixed(4)},${searchRadius || 10}`;
      if (locationKey === lastCachedLocation) return;

      // Minimal wait for the map to settle after location change
      await new Promise(resolve => setTimeout(resolve, 200));

      let bounds: LatLngBounds;
      
      if (searchRadius) {
        // Create bounds based on search radius
        const radiusInDegrees = searchRadius / 111; // Rough conversion: 1 degree ≈ 111 km
        bounds = L.latLngBounds(
          [location.lat - radiusInDegrees, location.lng - radiusInDegrees],
          [location.lat + radiusInDegrees, location.lng + radiusInDegrees]
        );
      } else {
        // Use current map bounds
        bounds = map.getBounds();
      }

      const downloadedCount = await downloadTilesForBounds(
        bounds,
        10, // Start from zoom level 10
        15 // Go up to zoom level 15
      );

      if (downloadedCount > 0) {
        setLastCachedLocation(locationKey);
      }
    };

    cacheLocationArea();
  }, [map, userLocation, searchLocation, searchRadius, isNearMeActive, isOnline, isOfflineMode, autoCacheMaps, lastCachedLocation, downloadTilesForBounds]);

  // Count cached tiles on mount
  useEffect(() => {
    const countCachedTiles = async () => {
      const count = await getCacheEntryCount(CACHE_NAMES.OSM_TILES);
      setCachedTiles(count);
    };

    countCachedTiles();
  }, []);

  // No offline banners - removed both competing banners
  return null;
}

// Custom tile layer that works offline with optimizations
function OfflineTileLayer({ mapStyle }: { mapStyle: MapStyle }) {

  return (
    <TileLayer
      attribution={mapStyle.attribution}
      url={mapStyle.url}
      maxZoom={18} // Reduced max zoom for better performance
      minZoom={3} // Set minimum zoom to prevent over-zooming out
      // Optimize for fastest possible loading
      keepBuffer={1} // Small buffer for smoother panning
      updateWhenIdle={true} // Update when idle for better performance during interaction
      updateWhenZooming={false} // Don't update during zoom for smoother experience
      updateInterval={200} // Throttle updates for better performance
      // Add error handling for offline mode
      errorTileUrl="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
      // Additional performance optimizations
      crossOrigin={true} // Enable CORS for better caching
      // Reduce tile loading overhead
      tileSize={256} // Standard tile size
      zoomOffset={0} // No zoom offset
      detectRetina={false} // Disable retina detection for consistency
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
  highlightedGeocache,
  showStyleSelector = true,
  isNearMeActive = false,
  mapRef,
  isMapCenterLocked = false
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

  // Calculate center if not provided - use stable defaults to prevent jumping
  const mapCenter: LatLngExpression = useMemo(() => {
    if (center) return [center.lat, center.lng];
    if (searchLocation) return [searchLocation.lat, searchLocation.lng];
    if (userLocation) return [userLocation.lat, userLocation.lng];
    return [40.7128, -74.0060]; // Default to NYC - stable fallback
  }, [center, searchLocation, userLocation]);



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
    bounceAtZoomLimits: false, // Disable for faster performance
    maxBoundsViscosity: 0.3, // Further reduce viscosity for better performance
    preferCanvas: true, // Use canvas for better performance
    fadeAnimation: false, // Disable fade for faster tile display
    zoomAnimation: true, // Keep zoom animation but make it faster
    zoomAnimationThreshold: 2, // Reduced threshold for smoother zoom
    markerZoomAnimation: false, // Disable marker zoom animation for speed
    // Additional performance optimizations
    trackResize: false, // Disable automatic resize tracking
    boxZoom: false, // Disable box zoom for better performance
    doubleClickZoom: true, // Keep double click zoom
    keyboard: false, // Disable keyboard navigation for performance
    inertia: true, // Enable inertia for smoother panning
    inertiaDeceleration: 3000, // Faster deceleration
    inertiaMaxSpeed: 1500, // Limit max speed for better control
    worldCopyJump: false, // Disable world copy jump for performance
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
  }, [geocaches, onMarkerClick]);

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
        zoomControl={true}
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
      <OfflineTileLayer mapStyle={mapStyle} />
      
      <MapSizeController />
      
      <MapRefController mapRef={mapRef} onMapReady={() => setIsMapReady(true)} />
      
      <AutoOfflineTileManager 
        userLocation={userLocation}
        searchLocation={searchLocation}
        searchRadius={searchRadius}
        isNearMeActive={isNearMeActive}
        mapStyle={mapStyle}
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
        removeOutsideVisibleBounds={true}
        animate={false} // Disable animations for better performance
        animateAddingMarkers={false}
        // Performance optimizations
        disableClusteringAtZoom={16} // Disable clustering at high zoom levels
        maxZoom={18} // Match tile layer max zoom
        iconCreateFunction={(cluster: { getChildCount: () => any; }) => {
          const count = cluster.getChildCount();
          const size = count < 10 ? 'small' : count < 100 ? 'medium' : 'large';
          
          return L.divIcon({
            html: `<div class="cluster-marker cluster-${size}"><span>${count}</span></div>`,
            className: 'custom-cluster-icon',
            iconSize: L.point(36, 36, true), // Slightly smaller for better performance
          });
        }}
      >
        {geocaches.filter(g => g.location).slice(0, 200).map((geocache) => { // Limit to 200 markers for performance
          return (
            <Marker
              key={geocache.dTag}
              position={[geocache.location.lat, geocache.location.lng]}
              icon={createCacheIcon(geocache.type, currentMapStyle === 'adventure')}
              eventHandlers={{
                add: (e) => {
                  // Bind HTML popup when marker is added - lazy load content
                  const marker = e.target;
                  marker.bindPopup(() => createGeocachePopupHTML(geocache), {
                    maxWidth: 300,
                    className: 'geocache-popup',
                    closeButton: true,
                    autoClose: true,
                    autoPan: true,
                    keepInView: true
                  });
                }
                // Removed click handler - clicking marker should only show popup, not open modal
              }}
            />
          );
        })}
      </MarkerClusterGroup>
    </MapContainer>

  </div>
  );
}