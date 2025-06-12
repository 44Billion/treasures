import { useState, useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from "react-leaflet";
import { LatLngExpression } from "leaflet";
import { Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LocationSearch } from "@/components/LocationSearch";
import { MapStyleSelector, MAP_STYLES } from "@/components/MapStyleSelector";
import { useGeolocation } from "@/features/map/hooks/useGeolocation";
import { useTheme } from "next-themes";
import { autocorrectCoordinates, parseCoordinate, formatCoordinateForInput } from "@/features/map/utils/coordinates";
import { mapIcons } from "@/features/map/utils/mapIcons";

import "leaflet/dist/leaflet.css";

interface LocationPickerProps {
  value: { lat: number; lng: number } | null;
  onChange: (location: { lat: number; lng: number }) => void;
}

// Component to handle map clicks and center updates
function LocationSelector({ 
  value, 
  onChange,
  center,
  beaconLocation,
  onPinDropped,
  onMapClick
}: { 
  value: { lat: number; lng: number } | null;
  onChange: (location: { lat: number; lng: number }) => void;
  center?: LatLngExpression;
  beaconLocation?: { lat: number; lng: number } | null;
  onPinDropped?: () => void;
  onMapClick?: () => void;
}) {
  const map = useMap();
  
  useMapEvents({
    click: (e) => {
      onChange({
        lat: e.latlng.lat,
        lng: e.latlng.lng,
      });
      // Notify parent that pin was dropped (so it doesn't update map center)
      onPinDropped?.();
      // Notify parent that map was clicked (to reset manual coords modification)
      onMapClick?.();
    },
  });

  useEffect(() => {
    if (center) {
      // Preserve current zoom level when updating center
      const currentZoom = map.getZoom();
      map.setView(center, currentZoom);
    }
  }, [center, map]);

  return (
    <>
      {/* Blue beacon for current/searched location */}
      {beaconLocation && (
        <Marker 
          position={[beaconLocation.lat, beaconLocation.lng]} 
          icon={mapIcons.blueBeacon}
          interactive={false}
        />
      )}
      
      {/* Red pin for selected cache location */}
      {value && (
        <Marker position={[value.lat, value.lng]} icon={mapIcons.droppedPin} />
      )}
    </>
  );
}

export function LocationPicker({ value, onChange }: LocationPickerProps) {
  const { theme, systemTheme } = useTheme();
  const [manualCoords, setManualCoords] = useState({
    lat: value?.lat?.toString() || "",
    lng: value?.lng?.toString() || "",
  });
  const [mapCenter, setMapCenter] = useState<LatLngExpression>([40.7128, -74.0060]); // Default to NYC
  const [beaconLocation, setBeaconLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [pinDropped, setPinDropped] = useState(false);
  const { loading: isGettingLocation, coords, getLocation } = useGeolocation();
  const lastCoordsRef = useRef<GeolocationCoordinates | null>(null);

  // Track if manual coordinates have been modified by user
  const [manualCoordsModified, setManualCoordsModified] = useState(false);

  // Map style management
  const getDefaultMapStyle = () => {
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
  
  const [currentMapStyle, setCurrentMapStyle] = useState(getDefaultMapStyle());
  const [hasManuallySelectedStyle, setHasManuallySelectedStyle] = useState(false);
  const mapStyle = MAP_STYLES[currentMapStyle] || MAP_STYLES.original;

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

  useEffect(() => {
    if (value) {
      // Only update manual coords if they haven't been manually modified
      if (!manualCoordsModified) {
        setManualCoords({
          lat: formatCoordinateForInput(value.lat, true),
          lng: formatCoordinateForInput(value.lng, true),
        });
      }
      
      // Only update map center if pin wasn't just dropped
      if (!pinDropped) {
        setMapCenter([value.lat, value.lng]);
      }
      // Reset the pin dropped flag
      setPinDropped(false);
    }
  }, [value, pinDropped, manualCoordsModified]);

  // Only update location when user explicitly gets location, not automatically
  useEffect(() => {
    // Only process if we have new coords that are different from last time
    if (coords && coords !== lastCoordsRef.current) {
      lastCoordsRef.current = coords;
      
      // Apply autocorrection even to GPS coordinates (in case of device errors)
      const { lat, lng } = autocorrectCoordinates(coords.latitude, coords.longitude);
      const location = { lat, lng };
      
      // Set beacon location for current location
      setBeaconLocation(location);
      setMapCenter([lat, lng]);
      setManualCoords({ 
        lat: formatCoordinateForInput(lat, true), 
        lng: formatCoordinateForInput(lng, true) 
      });
      setManualCoordsModified(false);
      
      // If no pin has been set yet, automatically set it at current location
      if (!value) {
        onChange(location);
      }
    }
  }, [coords, value, onChange]);

  const handleGetCurrentLocation = () => {
    getLocation();
  };

  const handleManualInput = () => {
    const inputLat = parseCoordinate(manualCoords.lat);
    const inputLng = parseCoordinate(manualCoords.lng);

    if (isNaN(inputLat) || isNaN(inputLng)) {
      alert("Please enter valid coordinates. Examples: 40.7128, -74.0060 or 40, -74");
      return;
    }

    // Validate coordinate ranges before autocorrection
    if (Math.abs(inputLat) > 90 && Math.abs(inputLng) > 180) {
      alert("Both coordinates are out of valid range. Latitude must be between -90 and 90, longitude between -180 and 180.");
      return;
    }

    // Apply autocorrection
    const { lat, lng, corrected } = autocorrectCoordinates(inputLat, inputLng);
    
    // Update input fields to show corrected values
    if (corrected) {
      setManualCoords({ 
        lat: formatCoordinateForInput(lat, true), 
        lng: formatCoordinateForInput(lng, true) 
      });
    }

    const location = { lat, lng };
    setManualCoordsModified(false); // Reset modification flag
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
    // Update manual coords to show corrected values and reset modification flag
    setManualCoords({ 
      lat: formatCoordinateForInput(lat, true), 
      lng: formatCoordinateForInput(lng, true) 
    });
    setManualCoordsModified(false);
    
    // Don't automatically set the cache location - user must click on map
  };

  return (
    <div className="space-y-4">
      {/* Map - no card wrapper on mobile */}
      <div className="w-full h-64 rounded-lg overflow-hidden border relative">
        <MapContainer
          center={mapCenter}
          zoom={value ? 15 : 10}
          style={{ height: "100%", width: "100%" }}
          attributionControl={false}
        >
          <TileLayer
            attribution={mapStyle.attribution}
            url={mapStyle.url}
            maxZoom={19}
          />
          <LocationSelector 
            value={value} 
            onChange={onChange} 
            center={mapCenter} 
            beaconLocation={beaconLocation}
            onPinDropped={() => setPinDropped(true)}
            onMapClick={() => setManualCoordsModified(false)}
          />
        </MapContainer>
        
        {/* Map Style Selector - floating over the map */}
        <div className="absolute top-2 right-2 z-[1000]">
          <MapStyleSelector
            currentStyle={currentMapStyle}
            onStyleChange={handleStyleChange}
          />
        </div>
      </div>

      <p className="text-sm text-muted-foreground text-center">
        {beaconLocation ? (
          <>Tap the map to set your cache location<br />
          <span className="text-blue-600">Blue beacon shows your current/searched location</span></>
        ) : (
          "Tap the map to set your cache location"
        )}
      </p>

      {/* Location Options */}
      <div className="space-y-4">
        {/* Location Search */}
        <div>
          <Label className="text-sm font-medium">Search for a location</Label>
          <div className="mt-1">
            <LocationSearch 
              onLocationSelect={handleLocationSearch}
              placeholder="Search city, zip code, or address..."
              mobilePlaceholder="Search for a location..."
            />
          </div>
        </div>

        {/* Current Location Button */}
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

        {/* Manual Coordinates - Collapsible */}
        <details className="group">
          <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            Enter coordinates manually
          </summary>
          <div className="mt-3 space-y-3">
            <p className="text-xs text-muted-foreground">
              Accepts formats like: 40.7128, -74.0060
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="text"
                placeholder="Latitude"
                value={manualCoords.lat}
                onChange={(e) => {
                  setManualCoordsModified(true);
                  setManualCoords({ ...manualCoords, lat: e.target.value });
                }}
                className="text-sm"
              />
              <Input
                type="text"
                placeholder="Longitude"
                value={manualCoords.lng}
                onChange={(e) => {
                  setManualCoordsModified(true);
                  setManualCoords({ ...manualCoords, lng: e.target.value });
                }}
                className="text-sm"
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={handleManualInput}
              disabled={!manualCoords.lat || !manualCoords.lng}
              className="w-full"
              size="sm"
            >
              Set Coordinates
            </Button>
          </div>
        </details>

        {/* Selected location display */}
        {value && (
          <div className="bg-muted/50 dark:bg-muted rounded-lg p-3 text-center">
            <p className="text-sm font-medium text-foreground">
              Selected: {value.lat.toFixed(6)}, {value.lng.toFixed(6)}
            </p>
            <a
              href={`https://www.openstreetmap.org/?mlat=${value.lat}&mlon=${value.lng}#map=15/${value.lat}/${value.lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 hover:underline inline-block mt-1"
            >
              View on OpenStreetMap →
            </a>
          </div>
        )}
      </div>
    </div>
  );
}