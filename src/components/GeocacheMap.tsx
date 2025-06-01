import { useEffect, useRef, useState, useCallback } from "react";
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from "react-leaflet";
import { LatLngExpression } from "leaflet";
import L from "leaflet";
import { createRoot } from "react-dom/client";
import { useTheme } from "next-themes";
import { MapPin, Navigation, Trophy, MessageSquare, Bookmark, BookmarkCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SaveButton } from "@/components/SaveButton";
import { MapStyleSelector, MAP_STYLES } from "@/components/MapStyleSelector";
import { useSavedCaches } from "@/hooks/useSavedCaches";
import { useToast } from "@/hooks/useToast";
import { useNavigate } from "react-router-dom";
import type { Geocache } from "@/types/geocache";
import { getTypeLabel, getSizeLabel } from "@/lib/geocache-utils";
import { isIOS, logIOSInfo, getIOSCompatibleMapOptions } from "@/lib/ios";
import { findClosestGeocache } from "@/lib/geo";
import { geocacheToNaddr } from "@/lib/naddr-utils";
import { getCacheIconSvg, getCacheColor } from "@/lib/cacheIcons";

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
}

// Component to handle map centering
function MapController({ 
  center, 
  zoom,
  searchLocation,
  searchRadius 
}: { 
  center: LatLngExpression; 
  zoom: number;
  searchLocation?: { lat: number; lng: number } | null;
  searchRadius?: number;
}) {
  const map = useMap();
  
  useEffect(() => {
    if (center) {
      console.log('Setting map view to:', center, 'zoom:', zoom);
      
      // If we have a search location with radius, fit bounds to show the full circle
      if (searchLocation && searchRadius) {
        const bounds = L.latLng(searchLocation.lat, searchLocation.lng).toBounds(searchRadius * 1000);
        map.fitBounds(bounds, {
          padding: [50, 50],
          animate: true,
          duration: 0.5
        });
      } else {
        // Otherwise just set the view
        map.setView(center, zoom, {
          animate: true,
          duration: 0.5
        });
      }
    }
  }, [map, center, zoom, searchLocation, searchRadius]);
  
  return null;
}

// Component to handle theme styling
function ThemeController({ 
  currentStyle 
}: { 
  currentStyle: string;
}) {
  const map = useMap();
  
  useEffect(() => {
    const container = map.getContainer();
    
    // Remove all theme classes
    container.classList.remove('dark-theme', 'pirate-theme');
    
    // Add current theme class
    if (currentStyle === 'dark') {
      container.classList.add('dark-theme');
    } else if (currentStyle === 'pirate') {
      container.classList.add('pirate-theme');
    }
  }, [map, currentStyle]);
  
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
  showStyleSelector = true
}: GeocacheMapProps) {
  const navigate = useNavigate();
  const { theme, systemTheme } = useTheme();
  
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

  // Calculate center if not provided
  const mapCenter: LatLngExpression = center 
    ? [center.lat, center.lng]
    : searchLocation
      ? [searchLocation.lat, searchLocation.lng]
      : userLocation && geocaches.length > 0 && geocaches.every(g => g.location)
        ? (() => {
            // Snap to the closest geocache to user location
            const closestCache = findClosestGeocache(geocaches, userLocation.lat, userLocation.lng);
            return closestCache ? [closestCache.location.lat, closestCache.location.lng] : [userLocation.lat, userLocation.lng];
          })()
        : geocaches.length > 0 && geocaches.every(g => g.location)
          ? (() => {
              // When no user location, snap to the first geocache instead of averaging
              const firstCache = geocaches[0];
              return [firstCache.location.lat, firstCache.location.lng];
            })()
          : [40.7128, -74.0060]; // Default to NYC

  const handleMarkerClick = (geocache: Geocache) => {
    if (onMarkerClick) {
      onMarkerClick(geocache);
    } else {
      // Fallback to navigation if no callback provided
      navigate(`/${geocacheToNaddr(geocache.pubkey, geocache.dTag, geocache.relays)}`);
    }
  };

  // iOS-specific map options
  const iosDetected = isIOS();
  const mapOptions = getIOSCompatibleMapOptions();
  
  // Log iOS info for debugging
  if (iosDetected) {
    logIOSInfo();
  }
  
  console.log('GeocacheMap - iOS detected:', iosDetected);
  console.log('GeocacheMap - geocaches count:', geocaches.length);
  console.log('GeocacheMap - mapCenter:', mapCenter);
  console.log('GeocacheMap - mapOptions:', mapOptions);

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
    <div className="relative h-full w-full overflow-hidden rounded-lg min-h-[400px] md:min-h-0">
      <MapContainer
        center={mapCenter}
        zoom={zoom}
        style={{ height: "100%", width: "100%", minHeight: "400px" }}
        className="z-0"
        zoomControl={true}
        doubleClickZoom={true}
        touchZoom={true}
        attributionControl={false}
        {...mapOptions}
      >
      <TileLayer
        attribution={mapStyle.attribution}
        url={mapStyle.url}
        maxZoom={19}
      />
      
      <MapController 
        center={mapCenter} 
        zoom={zoom} 
        searchLocation={searchLocation}
        searchRadius={searchRadius}
      />
      
      <ThemeController 
        currentStyle={currentMapStyle}
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
                      console.error('Failed to toggle save cache:', error);
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
    

  </div>
  );
}