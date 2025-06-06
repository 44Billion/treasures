import { useEffect, useRef, useState, useCallback } from "react";
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap, useMapEvents } from "react-leaflet";
import { LatLngExpression, LatLngBounds } from "leaflet";
import L from "leaflet";
import { createRoot } from "react-dom/client";
import { useTheme } from "next-themes";
import { MapPin, Navigation, Trophy, MessageSquare, Bookmark, BookmarkCheck, Sparkles, Download, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { SaveButton } from "@/components/SaveButton";
import { MapStyleSelector, MAP_STYLES } from "@/components/MapStyleSelector";
import { useSavedCaches } from "@/hooks/useSavedCaches";
import { useToast } from "@/hooks/useToast";
import { useNavigate } from "react-router-dom";
import type { Geocache } from "@/types/geocache";
import { getTypeLabel, getSizeLabel } from "@/lib/geocache-utils";

import { findClosestGeocache } from "@/lib/geo";
import { geocacheToNaddr } from "@/lib/naddr-utils";
import { getCacheIconSvg, getCacheColor } from "@/lib/cacheIcons";
import { useOfflineMode, useOfflineSettings } from "@/hooks/useOfflineStorage";
import { getCacheEntryCount, cacheMapTile } from "@/lib/cacheUtils";
import { CACHE_NAMES } from "@/lib/cacheConstants";

// Import Leaflet CSS and adventure theme
import "leaflet/dist/leaflet.css";
import "@/styles/map.css";

// Create cache icons with optional pirate theme styling
const createCacheIcon = (type: string, isPirateTheme: boolean = false) => {
  const iconSvg = getCacheIconSvg(type);
  const color = getCacheColor(type);
  
  if (isPirateTheme) {
    // Fantasy pirate treasure chest style icons with magical glow
    const pirateColors = {
      traditional: '#92400e', // Rich brown for treasure chests
      multi: '#dc2626',      // Ruby red for magical compass
      mystery: '#7c2d12',    // Dark mystical brown
    };
    
    const glowColors = {
      traditional: '#fbbf24', // Golden glow
      multi: '#ef4444',      // Ruby glow  
      mystery: '#a855f7',    // Purple mystical glow
    };
    
    const pirateColor = pirateColors[type as keyof typeof pirateColors] || pirateColors.traditional;
    const glowColor = glowColors[type as keyof typeof glowColors] || glowColors.traditional;
    
    return L.divIcon({
      html: `
        <div style="
          background: linear-gradient(135deg, ${pirateColor} 0%, ${color} 50%, ${glowColor} 100%);
          border: 4px solid #fbbf24;
          border-radius: 12px;
          width: 48px;
          height: 48px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 
            0 0 12px ${glowColor}80,
            0 0 24px ${glowColor}40,
            0 6px 16px rgba(139, 69, 19, 0.5),
            inset 0 2px 0 rgba(255, 255, 255, 0.4),
            inset 0 -2px 0 rgba(146, 64, 14, 0.3);
          position: relative;
          transition: all 0.4s ease;
          cursor: pointer;
          transform: rotate(-3deg);
          animation: treasureGlow 3s ease-in-out infinite;
        ">
          ${iconSvg}
        </div>
        <div style="
          position: absolute;
          bottom: -12px;
          left: 50%;
          transform: translateX(-50%) rotate(3deg);
          width: 0;
          height: 0;
          border-left: 12px solid transparent;
          border-right: 12px solid transparent;
          border-top: 12px solid ${pirateColor};
          filter: drop-shadow(0 4px 8px ${glowColor}60);
        "></div>
        <style>
          @keyframes treasureGlow {
            0%, 100% { 
              box-shadow: 
                0 0 12px ${glowColor}80,
                0 0 24px ${glowColor}40,
                0 6px 16px rgba(139, 69, 19, 0.5),
                inset 0 2px 0 rgba(255, 255, 255, 0.4),
                inset 0 -2px 0 rgba(146, 64, 14, 0.3);
            }
            50% { 
              box-shadow: 
                0 0 20px ${glowColor}90,
                0 0 40px ${glowColor}60,
                0 8px 20px rgba(139, 69, 19, 0.6),
                inset 0 3px 0 rgba(255, 255, 255, 0.5),
                inset 0 -3px 0 rgba(146, 64, 14, 0.4);
            }
          }
          .custom-cache-icon:hover > div:first-child {
            transform: scale(1.2) rotate(0deg);
            box-shadow: 
              0 0 24px ${glowColor}95,
              0 0 48px ${glowColor}70,
              0 10px 24px rgba(139, 69, 19, 0.7),
              inset 0 4px 0 rgba(255, 255, 255, 0.6),
              inset 0 -4px 0 rgba(146, 64, 14, 0.5);
          }
        </style>
      `,
      className: "custom-cache-icon fantasy-pirate-cache-icon",
      iconSize: [48, 60],
      iconAnchor: [24, 60],
      popupAnchor: [0, -60],
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
      
      // Set a longer timeout before allowing automatic updates
      interactionTimeoutRef.current = setTimeout(() => {
        userHasInteracted.current = false;
      }, 15000); // 15 seconds - much longer protection
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
      const centerKey = `${center[0]},${center[1]},${zoom}`;
      const now = Date.now();
      
      // NEVER update if user is currently interacting or has interacted recently
      // NEVER update if map center is locked from parent component
      // Only update if enough time has passed since last update (prevent spam)
      if (centerKey !== lastCenterRef.current && 
          !userIsInteracting.current &&
          !userHasInteracted.current &&
          !isMapCenterLocked &&
          now - lastUpdateTime.current > 2000) { // 2 second minimum between updates
        
        lastCenterRef.current = centerKey;
        lastUpdateTime.current = now;
        
        // If we have a search location with radius, use radius-based zoom
        if (searchLocation && searchRadius) {
          const targetZoom = getZoomForRadius(searchRadius);
          
          map.setView([searchLocation.lat, searchLocation.lng], targetZoom, {
            animate: true,
            duration: 0.25
          });
          lastRadiusRef.current = searchRadius;
        } else {
          // Otherwise just set the view
          map.setView(center, zoom, {
            animate: true,
            duration: 0.25
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
    container.classList.remove('dark-theme', 'pirate-theme', 'system-dark-theme');
    
    // Add current theme class
    if (currentStyle === 'dark') {
      container.classList.add('dark-theme');
    } else if (currentStyle === 'pirate') {
      container.classList.add('pirate-theme');
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
  geocaches,
  onMarkerClick
}: { 
  highlightedGeocache?: string;
  geocaches: Geocache[];
  onMarkerClick?: (geocache: Geocache) => void;
}) {
  const map = useMap();
  
  useEffect(() => {
    if (highlightedGeocache) {
      // Find the geocache
      const geocache = geocaches.find(g => g.dTag === highlightedGeocache);
      if (geocache) {
        // Small delay to ensure map has centered, then trigger popup on the marker
        setTimeout(() => {
          // Find all markers and open the popup for the matching one
          map.eachLayer((layer: any) => {
            if (layer instanceof L.Marker && layer.getLatLng) {
              const markerLatLng = layer.getLatLng();
              if (Math.abs(markerLatLng.lat - geocache.location.lat) < 0.0001 && 
                  Math.abs(markerLatLng.lng - geocache.location.lng) < 0.0001) {
                layer.openPopup();
              }
            }
          });
        }, 500);
      }
    }
  }, [map, highlightedGeocache, geocaches]);
  
  return null;
}

// Component to handle map size invalidation
function MapSizeController() {
  const map = useMap();
  
  useEffect(() => {
    // Invalidate size immediately when component mounts
    map.invalidateSize();
    
    // Also invalidate size on window resize
    const handleResize = () => {
      map.invalidateSize();
    };
    
    window.addEventListener('resize', handleResize);
    
    return () => {
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
    if (mapRef) {
      mapRef.current = map;
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
  const rootRef = useRef<any>(null);
  const controlRef = useRef<L.Control | null>(null);
  
  // Create the render function with useCallback to stabilize dependencies
  const renderSelector = useCallback(() => {
    if (rootRef.current) {
      rootRef.current.render(
        <MapStyleSelector
          currentStyle={currentStyle}
          onStyleChange={onStyleChange}
        />
      );
    }
  }, [currentStyle, onStyleChange]);
  
  useEffect(() => {
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
        
        return div;
      }
    });
    
    const styleControl = new StyleControl({ position: 'topright' });
    controlRef.current = styleControl;
    map.addControl(styleControl);
    
    // Initial render
    renderSelector();
    
    // Cleanup
    return () => {
      if (rootRef.current) {
        rootRef.current.unmount();
        rootRef.current = null;
      }
      if (controlRef.current) {
        map.removeControl(controlRef.current);
        controlRef.current = null;
      }
    };
  }, [map, renderSelector]);
  
  // Update the rendered component when props change
  useEffect(() => {
    renderSelector();
  }, [renderSelector]);
  
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
  mapStyle: any;
}) {
  const map = useMap();
  const { isOnline, isOfflineMode } = useOfflineMode();
  const { settings } = useOfflineSettings();
  const [cachedTiles, setCachedTiles] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);
  const [lastCachedLocation, setLastCachedLocation] = useState<string | null>(null);
  const { toast } = useToast();

  const autoCacheMaps = (settings.autoCacheMaps as boolean) ?? true;

  // Check storage limits before caching
  const checkStorageBeforeCaching = async (): Promise<boolean> => {
    try {
      const { isStorageNearLimit } = await import('@/lib/storageConfig');
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
  };

  const downloadTilesForBounds = async (bounds: LatLngBounds, minZoom: number, maxZoom: number, silent: boolean = false) => {
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
  };

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
        Math.min(currentZoom + 1, 16),
        true // Silent for initial load
      );
    };

    cacheInitialView();
  }, [map, isOnline, isOfflineMode, autoCacheMaps]);

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
        15, // Go up to zoom level 15
        true // Silent caching
      );

      if (downloadedCount > 0) {
        setLastCachedLocation(locationKey);
      }
    };

    cacheLocationArea();
  }, [map, userLocation, searchLocation, searchRadius, isNearMeActive, isOnline, isOfflineMode, autoCacheMaps, lastCachedLocation]);

  // Count cached tiles on mount
  useEffect(() => {
    const countCachedTiles = async () => {
      const count = await getCacheEntryCount(CACHE_NAMES.OSM_TILES);
      setCachedTiles(count);
    };

    countCachedTiles();
  }, []);

  // Only show offline status when actually offline (not just using cached tiles)
  if (isOfflineMode || (!isOnline && !navigator.onLine)) {
    return (
      <div className="absolute top-2 left-1/2 transform -translate-x-1/2 z-[1000]">
        <div className="bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md px-2 py-1 shadow-sm">
          <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
            <WifiOff className="h-3 w-3" />
            <span>Offline</span>
            <Badge variant="secondary" className="text-xs">
              {cachedTiles} tiles
            </Badge>
          </div>
        </div>
      </div>
    );
  }

  // Don't show caching status when online - removed per user request
  return null;
}

// Custom tile layer that works offline with optimizations
function OfflineTileLayer({ mapStyle }: { mapStyle: any }) {
  const { isOnline, isOfflineMode } = useOfflineMode();

  return (
    <TileLayer
      attribution={mapStyle.attribution}
      url={mapStyle.url}
      maxZoom={19}
      // Optimize for fastest possible loading
      keepBuffer={0} // Minimal buffer for faster initial load
      updateWhenIdle={false} // Update immediately
      updateWhenZooming={true} // Keep updating during zoom
      // Add error handling for offline mode
      errorTileUrl="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
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
  const navigate = useNavigate();
  const { theme, systemTheme } = useTheme();
  const { isOnline, isOfflineMode } = useOfflineMode();
  const [isMapReady, setIsMapReady] = useState(false);
  
  // Determine if we should use dark mode for the map
  const getDefaultMapStyle = () => {
    // First check app theme setting
    if (theme === "dark") {
      return "dark";
    } else if (theme === "light") {
      return "original";
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
  const mapStyle = MAP_STYLES[currentMapStyle] || MAP_STYLES.original;
  const { isCacheSaved, toggleSaveCache, isNostrEnabled } = useSavedCaches();
  const { toast } = useToast();

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
  const mapCenter: LatLngExpression = center 
    ? [center.lat, center.lng]
    : searchLocation
      ? [searchLocation.lat, searchLocation.lng]
      : userLocation
        ? [userLocation.lat, userLocation.lng] // Use user location directly, don't snap to geocaches
        : [40.7128, -74.0060]; // Default to NYC - stable fallback



  const handleMarkerClick = (geocache: Geocache) => {
    if (onMarkerClick) {
      onMarkerClick(geocache);
    } else {
      // Fallback to navigation if no callback provided
      navigate(`/${geocacheToNaddr(geocache.pubkey, geocache.dTag, geocache.relays)}`);
    }
  };

  // Optimized map options for fastest loading
  const mapOptions = {
    scrollWheelZoom: true,
    tap: false,
    tapTolerance: 10,
    bounceAtZoomLimits: false, // Disable for faster performance
    maxBoundsViscosity: 0.5, // Reduce viscosity for better performance
    preferCanvas: true, // Use canvas for better performance
    fadeAnimation: false, // Disable fade for faster tile display
    zoomAnimation: true, // Keep zoom animation but make it faster
    zoomAnimationThreshold: 4,
    markerZoomAnimation: false, // Disable marker zoom animation for speed
  };

  // Set up event listener for popup view details button
  useEffect(() => {
    const handleViewDetails = (event: CustomEvent) => {
      const dTag = event.detail;
      const geocache = geocaches.find(g => g.dTag === dTag);
      if (geocache && onMarkerClick) {
        onMarkerClick(geocache);
      }
    };

    window.addEventListener('geocache-view-details', handleViewDetails as EventListener);
    return () => {
      window.removeEventListener('geocache-view-details', handleViewDetails as EventListener);
    };
  }, [geocaches, onMarkerClick]);

  return (
    <div 
      className="relative h-full w-full overflow-hidden min-h-[400px] md:min-h-0" 
      style={{ 
        backgroundColor: '#f8fafc'
      }}
    >
      {/* Map Loading Skeleton - minimal loading time */}
      {!isMapReady && (
        <div className="absolute inset-0 z-10 bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
            <p className="text-sm text-muted-foreground">Loading map...</p>
          </div>
        </div>
      )}
      
      <MapContainer
        center={mapCenter}
        zoom={zoom}
        style={{ height: "100%", width: "100%", minHeight: "400px" }}
        className="z-0"
        zoomControl={true}
        doubleClickZoom={true}
        touchZoom={true}
        attributionControl={false}
        // Optimize for fastest loading
        whenCreated={(map) => {
          // Force immediate tile loading
          map.invalidateSize();
          // Set loading priority
          map.getContainer().style.background = '#f8fafc';
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
        onMarkerClick={onMarkerClick}
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
          pathOptions={currentMapStyle === 'pirate' ? {
            color: '#fbbf24', // Golden for fantasy pirate theme
            fillColor: '#f59e0b', // Rich amber fill
            fillOpacity: 0.2,
            weight: 4,
            dashArray: '15, 10',
            opacity: 0.8,
            className: 'search-radius-circle'
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
        >
          <Popup>
            <div className="text-center">
              <p className="font-semibold">Your Location</p>
            </div>
          </Popup>
        </Marker>
      )}
      
      {/* Geocache markers */}
      {geocaches.filter(g => g.location).map((geocache) => (
        <Marker
          key={geocache.dTag}
          position={[geocache.location.lat, geocache.location.lng]}
          icon={createCacheIcon(geocache.type, currentMapStyle === 'pirate')}
        >
          <Popup>
            <div className="p-3 min-w-[200px]">
              <h3 className="font-semibold text-sm leading-tight mb-3">{geocache.name}</h3>
              
              <div className="flex flex-wrap gap-1 mb-3">
                <Badge variant="outline" className="text-xs py-0 px-1.5">
                  D{geocache.difficulty}
                </Badge>
                <Badge variant="outline" className="text-xs py-0 px-1.5">
                  T{geocache.terrain}
                </Badge>
                <Badge variant="secondary" className="text-xs py-0 px-1.5">
                  {getSizeLabel(geocache.size)}
                </Badge>
                <Badge variant="secondary" className="text-xs py-0 px-1.5">
                  {getTypeLabel(geocache.type)}
                </Badge>
              </div>
              
              <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
                {geocache.description}
              </p>
              
              <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
                <span className="flex items-center gap-1">
                  <Trophy className="h-3 w-3" />
                  {geocache.foundCount || 0}
                </span>
                <span className="flex items-center gap-1">
                  <MessageSquare className="h-3 w-3" />
                  {geocache.logCount || 0}
                </span>
              </div>
              
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="flex-1 text-xs"
                  onClick={() => handleMarkerClick(geocache)}
                >
                  View Details
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="px-2"
                  onClick={async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    if (!isNostrEnabled) {
                      toast({
                        title: 'Login required',
                        description: 'Please log in with your Nostr account to save caches.',
                        variant: 'destructive',
                      });
                      return;
                    }
                    
                    const isSaved = isCacheSaved(geocache.id, geocache.dTag, geocache.pubkey);
                    
                    try {
                      await toggleSaveCache(geocache);
                      
                      toast({
                        title: isSaved ? 'Cache removed from saved list' : 'Cache saved for later',
                        description: isSaved 
                          ? `"${geocache.name}" has been removed from your saved caches.`
                          : `"${geocache.name}" has been saved to your Nostr profile.`,
                      });
                    } catch (error) {
                      const errorMessage = error instanceof Error ? error.message : 'Failed to save cache. Please try again.';
                      toast({
                        title: 'Error saving cache',
                        description: errorMessage,
                        variant: 'destructive',
                      });
                    }
                  }}
                  title={isCacheSaved(geocache.id, geocache.dTag, geocache.pubkey) ? 'Remove from saved' : 'Save for later'}
                >
                  {isCacheSaved(geocache.id, geocache.dTag, geocache.pubkey) ? (
                    <BookmarkCheck className="h-3 w-3" />
                  ) : (
                    <Bookmark className="h-3 w-3" />
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="px-2"
                  onClick={() => {
                    window.open(
                      `https://www.openstreetmap.org/directions?from=&to=${geocache.location.lat}%2C${geocache.location.lng}#map=15/${geocache.location.lat}/${geocache.location.lng}`,
                      "_blank"
                    );
                  }}
                >
                  <Navigation className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
    
    {/* Offline status overlay - only show when actually offline */}
    {(isOfflineMode || (!isOnline && !navigator.onLine)) && (
      <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 z-[1000]">
        <div className="bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md px-2 py-1 shadow-sm">
          <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
            <WifiOff className="h-3 w-3" />
            <span>Offline mode</span>
          </div>
        </div>
      </div>
    )}

  </div>
  );
}