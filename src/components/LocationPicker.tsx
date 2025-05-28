import { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from "react-leaflet";
import { LatLngExpression } from "leaflet";
import L from "leaflet";
import { MapPin, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { LocationSearch } from "@/components/LocationSearch";
import { useGeolocation } from "@/hooks/useGeolocation";

import "leaflet/dist/leaflet.css";

// Custom marker icon
const locationIcon = L.divIcon({
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

interface LocationPickerProps {
  value: { lat: number; lng: number } | null;
  onChange: (location: { lat: number; lng: number }) => void;
}

// Component to handle map clicks and center updates
function LocationSelector({ 
  value, 
  onChange,
  center
}: { 
  value: { lat: number; lng: number } | null;
  onChange: (location: { lat: number; lng: number }) => void;
  center?: LatLngExpression;
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

  return value ? (
    <Marker position={[value.lat, value.lng]} icon={locationIcon} />
  ) : null;
}

export function LocationPicker({ value, onChange }: LocationPickerProps) {
  const [manualCoords, setManualCoords] = useState({
    lat: value?.lat?.toString() || "",
    lng: value?.lng?.toString() || "",
  });
  const [mapCenter, setMapCenter] = useState<LatLngExpression>([40.7128, -74.0060]); // Default to NYC
  const { loading: isGettingLocation, coords, getLocation } = useGeolocation();

  useEffect(() => {
    if (value) {
      setManualCoords({
        lat: value.lat.toString(),
        lng: value.lng.toString(),
      });
      setMapCenter([value.lat, value.lng]);
    }
  }, [value]);

  useEffect(() => {
    if (coords) {
      const location = {
        lat: coords.latitude,
        lng: coords.longitude,
      };
      onChange(location);
      setMapCenter([location.lat, location.lng]);
    }
  }, [coords, onChange]);

  const handleGetCurrentLocation = () => {
    getLocation();
  };

  const handleManualInput = () => {
    const lat = parseFloat(manualCoords.lat);
    const lng = parseFloat(manualCoords.lng);

    if (isNaN(lat) || isNaN(lng)) {
      alert("Please enter valid coordinates");
      return;
    }

    if (lat < -90 || lat > 90) {
      alert("Latitude must be between -90 and 90");
      return;
    }

    if (lng < -180 || lng > 180) {
      alert("Longitude must be between -180 and 180");
      return;
    }

    const location = { lat, lng };
    onChange(location);
    setMapCenter([lat, lng]);
  };

  const handleLocationSearch = (location: { lat: number; lng: number; name: string }) => {
    const newLocation = { lat: location.lat, lng: location.lng };
    onChange(newLocation);
    setMapCenter([location.lat, location.lng]);
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
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <LocationSelector value={value} onChange={onChange} center={mapCenter} />
              </MapContainer>
            </div>

            <p className="text-sm text-gray-600 text-center">
              Click on the map to set the geocache location
            </p>

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

              <Button
                type="button"
                variant="outline"
                onClick={handleGetCurrentLocation}
                disabled={isGettingLocation}
                className="w-full"
              >
                <Navigation className="h-4 w-4 mr-2" />
                {isGettingLocation ? "Getting location..." : "Use Current Location"}
              </Button>

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