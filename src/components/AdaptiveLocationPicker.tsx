import { useState, useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from "react-leaflet";
import { LatLngExpression } from "leaflet";
import L from "leaflet";
import { MapPin, Navigation, Target, Wifi, Globe, X, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { LocationSearch } from "@/components/LocationSearch";
import { useAdaptiveGeolocation } from "@/hooks/useAdaptiveGeolocation";
import { autocorrectCoordinates } from "@/lib/coordinates";
import { testLocationCapabilities, getCapabilityDescription } from "@/lib/locationCapabilities";

import "leaflet/dist/leaflet.css";

// Custom marker icon for dropped pin
const droppedPinIcon = L.divIcon({
  html: `
    <div style="position: relative;">
      <svg width="32" height="40" viewBox="0 0 32 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M16 0C9.373 0 4 5.373 4 12c0 9 12 24 12 24s12-15 12-24c0-6.627-5.373-12-12-12z" fill="#ef4444"/>
        <circle cx="16" cy="12" r="4" fill="white"/>
      </svg>
    </div>
  `,
  className: "location-picker-icon",
  iconSize: [32, 40],
  iconAnchor: [16, 40],
});

// Adaptive beacon icons based on accuracy and source
const createBeaconIcon = (accuracy: 'high' | 'medium' | 'low', source: 'precise' | 'network' | 'approximate') => {
  const colors = {
    high: { bg: '#10b981', border: '#059669' }, // green
    medium: { bg: '#f59e0b', border: '#d97706' }, // amber
    low: { bg: '#ef4444', border: '#dc2626' }, // red
  };
  
  const icons = {
    precise: '<path d="M12 2L13.09 8.26L22 9L13.09 9.74L12 16L10.91 9.74L2 9L10.91 8.26L12 2Z" fill="white"/>',
    network: '<path d="M1 9L9 1L17 9H13V17H9V9H1Z" fill="white"/>',
    approximate: '<circle cx="12" cy="12" r="8" fill="none" stroke="white" stroke-width="2"/><circle cx="12" cy="12" r="3" fill="white"/>',
  };
  
  const color = colors[accuracy];
  const icon = icons[source];
  
  return L.divIcon({
    html: `
      <div style="position: relative; width: 28px; height: 28px;">
        <div style="
          position: absolute;
          width: 28px;
          height: 28px;
          background: ${color.bg}40;
          border-radius: 50%;
          animation: pulse 2s ease-out infinite;
        "></div>
        <div style="
          position: absolute;
          top: 2px;
          left: 2px;
          width: 24px;
          height: 24px;
          background: ${color.bg};
          border: 2px solid white;
          border-radius: 50%;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            ${icon}
          </svg>
        </div>
      </div>
      <style>
        @keyframes pulse {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.5); opacity: 0.5; }
          100% { transform: scale(2); opacity: 0; }
        }
      </style>
    `,
    className: `beacon-icon-${accuracy}-${source}`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
};

interface AdaptiveLocationPickerProps {
  value: { lat: number; lng: number } | null;
  onChange: (location: { lat: number; lng: number }) => void;
  prioritizePrecision?: boolean;
  enableApproximateFallback?: boolean;
}

// Component to handle map clicks and center updates
function LocationSelector({ 
  value, 
  onChange,
  center,
  beaconLocation,
  beaconAccuracy,
  beaconSource
}: { 
  value: { lat: number; lng: number } | null;
  onChange: (location: { lat: number; lng: number }) => void;
  center?: LatLngExpression;
  beaconLocation?: { lat: number; lng: number } | null;
  beaconAccuracy?: 'high' | 'medium' | 'low' | null;
  beaconSource?: 'precise' | 'network' | 'approximate' | null;
}) {
  const map = useMap();
  
  useMapEvents({
    click: (e) => {
      onChange({
        lat: e.latlng.lat,
        lng: e.latlng.lng,
      });
    },
  });

  useEffect(() => {
    if (center) {
      map.setView(center, 15);
    }
  }, [center, map]);

  return (
    <>
      {/* Adaptive beacon for current/searched location */}
      {beaconLocation && beaconAccuracy && beaconSource && (
        <Marker 
          position={[beaconLocation.lat, beaconLocation.lng]} 
          icon={createBeaconIcon(beaconAccuracy, beaconSource)}
          interactive={false}
        />
      )}
      
      {/* Red pin for selected cache location */}
      {value && (
        <Marker position={[value.lat, value.lng]} icon={droppedPinIcon} />
      )}
    </>
  );
}

export function AdaptiveLocationPicker({ 
  value, 
  onChange, 
  prioritizePrecision = true,
  enableApproximateFallback = false 
}: AdaptiveLocationPickerProps) {
  const [manualCoords, setManualCoords] = useState({
    lat: value?.lat?.toString() || "",
    lng: value?.lng?.toString() || "",
  });
  const [mapCenter, setMapCenter] = useState<LatLngExpression>([40.7128, -74.0060]); // Default to NYC
  const [beaconLocation, setBeaconLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [capabilities, setCapabilities] = useState<string>("");
  const { 
    loading: isGettingLocation, 
    coords, 
    accuracy,
    source,
    error,
    attempts,
    getLocation,
    cancelLocation
  } = useAdaptiveGeolocation({ 
    enableFallback: enableApproximateFallback,
    prioritizePrecision 
  });
  const lastCoordsRef = useRef<GeolocationCoordinates | null>(null);

  useEffect(() => {
    if (value) {
      setManualCoords({
        lat: value.lat.toFixed(6),
        lng: value.lng.toFixed(6),
      });
      setMapCenter([value.lat, value.lng]);
    }
  }, [value]);

  // Test capabilities on mount
  useEffect(() => {
    testLocationCapabilities().then(caps => {
      setCapabilities(getCapabilityDescription(caps));
    });
  }, []);

  // Process new location data
  useEffect(() => {
    if (coords && coords !== lastCoordsRef.current) {
      lastCoordsRef.current = coords;
      
      // Apply autocorrection
      const { lat, lng } = autocorrectCoordinates(coords.latitude, coords.longitude);
      const location = { lat, lng };
      
      // Set beacon location
      setBeaconLocation(location);
      setMapCenter([lat, lng]);
      setManualCoords({ 
        lat: lat.toFixed(6), 
        lng: lng.toFixed(6) 
      });
    }
  }, [coords]);

  const handleGetCurrentLocation = () => {
    getLocation();
  };

  const handleCancelLocation = () => {
    cancelLocation();
  };

  const handleManualInput = () => {
    const inputLat = parseFloat(manualCoords.lat);
    const inputLng = parseFloat(manualCoords.lng);

    if (isNaN(inputLat) || isNaN(inputLng)) {
      alert("Please enter valid coordinates");
      return;
    }

    // Apply autocorrection
    const { lat, lng, corrected } = autocorrectCoordinates(inputLat, inputLng);
    
    // Update input fields to show corrected values
    if (corrected) {
      setManualCoords({ 
        lat: lat.toFixed(6), 
        lng: lng.toFixed(6) 
      });
    }

    const location = { lat, lng };
    onChange(location);
    setMapCenter([lat, lng]);
  };

  const handleLocationSearch = (location: { lat: number; lng: number; name: string }) => {
    // Apply autocorrection to search results
    const { lat, lng } = autocorrectCoordinates(location.lat, location.lng);
    
    const newLocation = { lat, lng };
    // Set beacon location for searched location
    setBeaconLocation(newLocation);
    setMapCenter([lat, lng]);
    // Update manual coords to show corrected values
    setManualCoords({ 
      lat: lat.toFixed(6), 
      lng: lng.toFixed(6) 
    });
  };

  const getAccuracyIcon = () => {
    if (!accuracy || !source) return <Navigation className="h-4 w-4" />;
    
    switch (source) {
      case 'precise':
        return <Target className="h-4 w-4" />;
      case 'network':
        return <Wifi className="h-4 w-4" />;
      case 'approximate':
        return <Globe className="h-4 w-4" />;
      default:
        return <Navigation className="h-4 w-4" />;
    }
  };

  const getAccuracyBadge = () => {
    if (!accuracy || !source) return null;
    
    const variants = {
      high: 'default',
      medium: 'secondary',
      low: 'outline',
    } as const;
    
    const sourceLabels = {
      precise: 'Precise',
      network: 'Network',
      approximate: 'Approximate',
    };
    
    return (
      <Badge variant={variants[accuracy]} className="text-xs">
        {accuracy.charAt(0).toUpperCase() + accuracy.slice(1)} ({sourceLabels[source]})
      </Badge>
    );
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="space-y-4">
            {/* Map */}
            <div className="w-full h-64 rounded-lg overflow-hidden border">
              <MapContainer
                center={mapCenter}
                zoom={value ? 15 : 10}
                style={{ height: "100%", width: "100%" }}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                  url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                  maxZoom={19}
                />
                <LocationSelector 
                  value={value} 
                  onChange={onChange} 
                  center={mapCenter} 
                  beaconLocation={beaconLocation}
                  beaconAccuracy={accuracy}
                  beaconSource={source}
                />
              </MapContainer>
            </div>

            {/* Status and Instructions */}
            <div className="space-y-2">
              {beaconLocation && accuracy && source && (
                <div className="flex items-center justify-between p-2 bg-blue-50 rounded-md">
                  <div className="flex items-center gap-2 text-sm text-blue-800">
                    {getAccuracyIcon()}
                    <span>Location detected</span>
                    {attempts > 1 && (
                      <span className="text-xs text-blue-600">({attempts} attempts)</span>
                    )}
                  </div>
                  {getAccuracyBadge()}
                </div>
              )}
              
              <p className="text-sm text-gray-600 text-center">
                {beaconLocation ? (
                  <>Click on the map to set the geocache location<br />
                  <span className="text-blue-600">Beacon shows your current/searched location</span></>
                ) : (
                  "Click on the map to set the geocache location"
                )}
              </p>
            </div>

            {/* Device Capabilities */}
            {capabilities && (
              <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded-md">
                <strong>Device capability:</strong> {capabilities}
              </div>
            )}

            {/* Error Display */}
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Location Options */}
            <div className="grid gap-4">
              {/* Location Search */}
              <div>
                <Label>Search for a location</Label>
                <LocationSearch 
                  onLocationSelect={handleLocationSearch}
                  placeholder="Search city, zip code, or address..."
                />
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-gray-500">Or</span>
                </div>
              </div>

              {/* Adaptive Current Location Button */}
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleGetCurrentLocation}
                  disabled={isGettingLocation}
                  className="flex-1"
                >
                  {prioritizePrecision ? <Target className="h-4 w-4 mr-2" /> : <Zap className="h-4 w-4 mr-2" />}
                  <span>
                    {isGettingLocation ? "Getting location..." : 
                     prioritizePrecision ? "Get Precise Location" : "Get Current Location"}
                  </span>
                </Button>
                
                {isGettingLocation && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={handleCancelLocation}
                    className="shrink-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>

              {/* Precision Mode Info */}
              {prioritizePrecision && (
                <div className="text-xs text-gray-600 bg-blue-50 p-2 rounded-md">
                  <strong>Precision mode:</strong> Prioritizes GPS accuracy over speed. 
                  {!enableApproximateFallback && (
                    <span className="block mt-1 text-green-700">
                      <strong>GPS required</strong> - will not fall back to approximate location.
                    </span>
                  )}
                </div>
              )}
              
              {enableApproximateFallback && (
                <div className="text-xs text-amber-700 bg-amber-50 p-2 rounded-md">
                  <strong>Fallback enabled:</strong> Will use approximate city-level location if GPS fails.
                </div>
              )}

              <div className="space-y-2">
                <Label>Or enter coordinates manually:</Label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Input
                      type="number"
                      placeholder="Latitude"
                      value={manualCoords.lat}
                      onChange={(e) => setManualCoords({ ...manualCoords, lat: e.target.value })}
                      step="0.000001"
                      min="-90"
                      max="90"
                    />
                  </div>
                  <div>
                    <Input
                      type="number"
                      placeholder="Longitude"
                      value={manualCoords.lng}
                      onChange={(e) => setManualCoords({ ...manualCoords, lng: e.target.value })}
                      step="0.000001"
                      min="-180"
                      max="180"
                    />
                  </div>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleManualInput}
                  disabled={!manualCoords.lat || !manualCoords.lng}
                  className="w-full"
                >
                  Set Coordinates
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {value && (
        <div className="text-sm text-gray-600">
          <p>
            <strong>Selected location:</strong> {value.lat.toFixed(6)}, {value.lng.toFixed(6)}
          </p>
          <a
            href={`https://www.openstreetmap.org/?mlat=${value.lat}&mlon=${value.lng}#map=15/${value.lat}/${value.lng}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline"
          >
            View on OpenStreetMap →
          </a>
        </div>
      )}
    </div>
  );
}