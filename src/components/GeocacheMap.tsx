import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import { LatLngExpression } from "leaflet";
import L from "leaflet";
import { MapPin, Navigation, Trophy, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import type { Geocache } from "@/types/geocache";

// Import Leaflet CSS
import "leaflet/dist/leaflet.css";

// Create custom icons using divIcon for better compatibility
const createCacheIcon = (type: string) => {
  const emoji = getCacheEmoji(type);
  
  return L.divIcon({
    html: `
      <div style="
        background: white;
        border: 2px solid #16a34a;
        border-radius: 50%;
        width: 36px;
        height: 36px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 20px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
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
        border-top: 8px solid white;
        filter: drop-shadow(0 2px 2px rgba(0,0,0,0.1));
      "></div>
    `,
    className: "custom-cache-icon",
    iconSize: [36, 44],
    iconAnchor: [18, 44],
    popupAnchor: [0, -44],
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
      "></div>
      <div style="
        position: absolute;
        top: 4px;
        left: 4px;
        width: 16px;
        height: 16px;
        background: #3b82f6;
        border-radius: 50%;
      "></div>
      <div style="
        position: absolute;
        top: 8px;
        left: 8px;
        width: 8px;
        height: 8px;
        background: white;
        border-radius: 50%;
      "></div>
    </div>
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
  onMarkerClick?: (geocache: Geocache) => void;
}

// Component to handle map centering
function MapController({ center, zoom }: { center: LatLngExpression; zoom: number }) {
  const map = useMap();
  
  useEffect(() => {
    map.setView(center, zoom);
  }, [map, center, zoom]);
  
  return null;
}

export function GeocacheMap({ 
  geocaches, 
  center,
  zoom = 10,
  userLocation,
  onMarkerClick 
}: GeocacheMapProps) {
  const navigate = useNavigate();

  // Calculate center if not provided
  const mapCenter: LatLngExpression = center 
    ? [center.lat, center.lng]
    : geocaches.length > 0 
      ? [
          geocaches.reduce((sum, g) => sum + g.location.lat, 0) / geocaches.length,
          geocaches.reduce((sum, g) => sum + g.location.lng, 0) / geocaches.length,
        ]
      : [40.7128, -74.0060]; // Default to NYC

  const handleMarkerClick = (geocache: Geocache) => {
    if (onMarkerClick) {
      onMarkerClick(geocache);
    } else {
      navigate(`/cache/${geocache.id}`);
    }
  };

  return (
    <MapContainer
      center={mapCenter}
      zoom={zoom}
      style={{ height: "100%", width: "100%" }}
      className="rounded-lg"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      
      <MapController center={mapCenter} zoom={zoom} />
      
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
      {geocaches.map((geocache) => (
        <Marker
          key={geocache.id}
          position={[geocache.location.lat, geocache.location.lng]}
          icon={createCacheIcon(geocache.type)}
          eventHandlers={{
            click: () => handleMarkerClick(geocache),
          }}
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
                  onClick={() => navigate(`/cache/${geocache.id}`)}
                >
                  View Details
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    window.open(
                      `https://www.google.com/maps/dir/?api=1&destination=${geocache.location.lat},${geocache.location.lng}`,
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