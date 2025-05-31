import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from "react-leaflet";
import { LatLngExpression } from "leaflet";
import L from "leaflet";
import { MapPin, Navigation, Trophy, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import type { Geocache } from "@/types/geocache";
import { isIOS, logIOSInfo, getIOSCompatibleMapOptions } from "@/lib/ios";
import { findClosestGeocache } from "@/lib/geo";

// Import Leaflet CSS
import "leaflet/dist/leaflet.css";

// Create custom icons using divIcon for better compatibility
const createCacheIcon = (type: string) => {
  const emoji = getCacheEmoji(type);
  
  // Different colors for different cache types
  const colors = {
    traditional: '#10b981', // Emerald
    multi: '#f59e0b',      // Amber
    mystery: '#8b5cf6',    // Purple
    earth: '#3b82f6',      // Blue
  };
  
  const color = colors[type as keyof typeof colors] || '#10b981';
  
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
        font-size: 22px;
        box-shadow: 0 3px 6px rgba(0,0,0,0.3);
        position: relative;
      ">
        ${emoji}
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
    `,
    className: "custom-cache-icon",
    iconSize: [40, 48],
    iconAnchor: [20, 48],
    popupAnchor: [0, -48],
  });
};

const userLocationIcon = L.divIcon({
  html: `
    <div style="position: relative; width: 24px; height: 24px;">
      <div style="
        position: absolute;
        width: 24px;
        height: 24px;
        background: rgba(59, 130, 246, 0.3);
        border-radius: 50%;
        animation: pulse 2s ease-out infinite;
      "></div>
      <div style="
        position: absolute;
        top: 2px;
        left: 2px;
        width: 20px;
        height: 20px;
        background: #3b82f6;
        border: 2px solid white;
        border-radius: 50%;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      "></div>
    </div>
    <style>
      @keyframes pulse {
        0% { transform: scale(1); opacity: 1; }
        50% { transform: scale(1.5); opacity: 0.5; }
        100% { transform: scale(2); opacity: 0; }
      }
    </style>
  `,
  className: "user-location-icon",
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

function getCacheEmoji(type: string) {
  switch (type) {
    case "traditional":
      return "📦";
    case "multi":
      return "🔄";
    case "mystery":
      return "❓";
    case "earth":
      return "🌍";
    default:
      return "📍";
  }
}

interface GeocacheMapProps {
  geocaches: Geocache[];
  center?: { lat: number; lng: number };
  zoom?: number;
  userLocation?: { lat: number; lng: number } | null;
  searchLocation?: { lat: number; lng: number } | null;
  searchRadius?: number; // in km
  onMarkerClick?: (geocache: Geocache) => void;
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

// Map style options
const MAP_STYLES = {
  light: {
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
  },
  voyager: {
    url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
  },
  positron: {
    url: "https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
  },
  watercolor: {
    url: "https://tiles.stadiamaps.com/tiles/stamen_watercolor/{z}/{x}/{y}.jpg",
    attribution: '&copy; <a href="https://stadiamaps.com/">Stadia Maps</a> &copy; <a href="https://stamen.com">Stamen Design</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  },
  toner: {
    url: "https://tiles.stadiamaps.com/tiles/stamen_toner_lite/{z}/{x}/{y}{r}.png",
    attribution: '&copy; <a href="https://stadiamaps.com/">Stadia Maps</a> &copy; <a href="https://stamen.com">Stamen Design</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }
};

export function GeocacheMap({ 
  geocaches, 
  center,
  zoom = 10,
  userLocation,
  searchLocation,
  searchRadius,
  onMarkerClick 
}: GeocacheMapProps) {
  const navigate = useNavigate();
  const mapStyle = MAP_STYLES.voyager; // Using voyager for vibrant, adventure-ready look

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
      navigate(`/cache/${geocache.dTag}`);
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

  return (
    <MapContainer
      center={mapCenter}
      zoom={zoom}
      style={{ height: "100%", width: "100%" }}
      className="rounded-lg z-0"
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
      
      {/* Search radius circle */}
      {searchLocation && searchRadius && (
        <Circle
          center={[searchLocation.lat, searchLocation.lng]}
          radius={searchRadius * 1000} // Convert km to meters
          pathOptions={{
            color: '#10b981', // Emerald green
            fillColor: '#10b981',
            fillOpacity: 0.15,
            weight: 3,
            dashArray: '10, 5'
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
          icon={createCacheIcon(geocache.type)}
        >
          <Popup>
            <div className="p-2 min-w-[200px]">
              <h3 className="font-semibold text-lg mb-2">{geocache.name}</h3>
              
              <div className="flex gap-2 mb-2">
                <Badge variant="secondary" className="text-xs">
                  {geocache.size}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  D{geocache.difficulty}/T{geocache.terrain}
                </Badge>
              </div>
              
              <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                {geocache.description}
              </p>
              
              <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
                <span className="flex items-center gap-1">
                  <Trophy className="h-3 w-3" />
                  {geocache.foundCount || 0} finds
                </span>
                <span className="flex items-center gap-1">
                  <MessageSquare className="h-3 w-3" />
                  {geocache.logCount || 0} logs
                </span>
              </div>
              
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="flex-1"
                  onClick={() => handleMarkerClick(geocache)}
                >
                  View Details
                </Button>
                <Button
                  size="sm"
                  variant="outline"
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
  );
}