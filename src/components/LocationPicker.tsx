import React, { useState, useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from "react-leaflet";
import { LatLngExpression } from "leaflet";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OmniSearch } from "@/components/OmniSearch";
import { MapStyleSelector } from "@/components/MapStyleSelector";
import { NearMeButton } from "@/components/NearMeButton";
import { MAP_STYLES } from "@/config/mapStyles";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useInitialLocation } from "@/hooks/useInitialLocation";
import { useTheme } from "@/hooks/useTheme";
import { autocorrectCoordinates, formatCoordinateForInput, parseCoordinateString, CoordinateParseResult, CoordinateParseError } from "@/utils/coordinates";
import { mapIcons } from "@/utils/mapIcons";
import { hapticMedium } from "@/utils/haptics";
import { createRoot } from "react-dom/client";

import "leaflet/dist/leaflet.css";
import "@/styles/leaflet-overrides.css";

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
      // Check if click was on a control element (they have pointer-events: auto)
      const target = e.originalEvent.target as HTMLElement;
      if (target.closest('.custom-zoom-control') ||
          target.closest('.map-style-control-container') ||
          target.closest('.near-me-button-container') ||
          target.closest('button') ||
          target.closest('.leaflet-control')) {
        return; // Don't place marker on control clicks
      }

      hapticMedium();
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

// Custom zoom control component - positioned at lower left corner
function CustomZoomControl() {
  const map = useMap();
  const containerRef = useRef<HTMLDivElement>(null);
  const isInitializedRef = useRef(false);

  useEffect(() => {
    if (isInitializedRef.current) return;

    const mapContainer = map.getContainer();

    // Create container div for the zoom control
    const container = document.createElement('div');
    container.className = 'custom-zoom-control';
    container.style.cssText = `
      position: absolute;
      bottom: 24px;
      left: 10px;
      z-index: 10000;
      pointer-events: auto;
    `;

    // Get background color with opacity from CSS variable
    const bgColor = getComputedStyle(document.documentElement).getPropertyValue('--background').trim();
    const backgroundColor = bgColor ? `hsl(${bgColor} / 0.9)` : 'rgba(255, 255, 255, 0.9)';

    // Get accent color for hover
    const accentColor = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
    const accentBgColor = accentColor ? `hsl(${accentColor})` : 'rgba(240, 240, 240, 1)';

    // Get foreground color
    const fgColor = getComputedStyle(document.documentElement).getPropertyValue('--foreground').trim();
    const foregroundColor = fgColor ? `hsl(${fgColor})` : '#374151';

    // Create zoom in button
    const zoomInBtn = document.createElement('button');
    zoomInBtn.innerHTML = '+';
    zoomInBtn.className = 'zoom-btn zoom-in-btn';
    zoomInBtn.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      background: ${backgroundColor};
      border: 1px solid hsl(var(--border));
      border-bottom: none;
      color: ${foregroundColor};
      font-size: 18px;
      font-weight: 500;
      line-height: 1;
      cursor: pointer;
      border-top-left-radius: 0.375rem;
      border-top-right-radius: 0.375rem;
      transition: all 0.2s ease;
      backdrop-filter: blur(8px);
    `;
    zoomInBtn.onmouseover = () => {
      zoomInBtn.style.background = accentBgColor;
    };
    zoomInBtn.onmouseout = () => {
      zoomInBtn.style.background = backgroundColor;
    };
    zoomInBtn.onclick = () => {
      map.zoomIn();
    };

    // Create zoom out button
    const zoomOutBtn = document.createElement('button');
    zoomOutBtn.innerHTML = '−';
    zoomOutBtn.className = 'zoom-btn zoom-out-btn';
    zoomOutBtn.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      background: ${backgroundColor};
      border: 1px solid hsl(var(--border));
      color: ${foregroundColor};
      font-size: 18px;
      font-weight: 500;
      line-height: 1;
      cursor: pointer;
      border-bottom-left-radius: 0.375rem;
      border-bottom-right-radius: 0.375rem;
      transition: all 0.2s ease;
      backdrop-filter: blur(8px);
    `;
    zoomOutBtn.onmouseover = () => {
      zoomOutBtn.style.background = accentBgColor;
    };
    zoomOutBtn.onmouseout = () => {
      zoomOutBtn.style.background = backgroundColor;
    };
    zoomOutBtn.onclick = () => {
      map.zoomOut();
    };

    container.appendChild(zoomInBtn);
    container.appendChild(zoomOutBtn);

    // Add container to map container
    mapContainer.appendChild(container);
    (containerRef as React.MutableRefObject<HTMLDivElement | null>).current = container;
    (isInitializedRef as React.MutableRefObject<boolean>).current = true;

    const currentContainer = containerRef.current;

    // Cleanup
    return () => {
      if (currentContainer && currentContainer.parentNode) {
        currentContainer.parentNode.removeChild(currentContainer);
      }
      (isInitializedRef as React.MutableRefObject<boolean>).current = false;
    };
  }, [map]);

  return null;
}

// Custom map style control - positioned at lower left above zoom
function MapStyleControl({
  currentStyle,
  onStyleChange
}: {
  currentStyle: string;
  onStyleChange: (style: string) => void;
}) {
  const map = useMap();
  const containerRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<ReturnType<typeof createRoot> | null>(null);
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

    const mapContainer = map.getContainer();

    // Create container div for the map style control
    const container = document.createElement('div');
    container.className = 'map-style-control-container';
    container.style.cssText = `
      position: absolute;
      bottom: 114px;
      left: 10px;
      z-index: 10000;
      pointer-events: auto;
    `;

    // Add container to map container
    mapContainer.appendChild(container);
    (containerRef as React.MutableRefObject<HTMLDivElement | null>).current = container;

    // Create React root and render the MapStyleSelector
    rootRef.current = createRoot(container);
    rootRef.current.render(
      <MapStyleSelector
        currentStyle={currentStyleRef.current}
        onStyleChange={onStyleChangeRef.current}
      />
    );

    (isInitializedRef as React.MutableRefObject<boolean>).current = true;

    const currentContainer = containerRef.current;

    // Cleanup
    return () => {
      if (currentContainer && currentContainer.parentNode) {
        currentContainer.parentNode.removeChild(currentContainer);
      }

      if (rootRef.current) {
        const root = rootRef.current;
        rootRef.current = null;

        setTimeout(() => {
          try {
            if (root && typeof root.unmount === 'function') {
              root.unmount();
            }
          } catch (error) {
            console.debug('MapStyleControl unmount:', error);
          }
        }, 0);
      }

      (isInitializedRef as React.MutableRefObject<boolean>).current = false;
    };
  }, [map]);

  // Update the rendered component when props change
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

// Custom "Near Me" button control - positioned at lower right corner
function NearMeControl({
  onGetLocation,
  isGettingLocation
}: {
  onGetLocation: () => void;
  isGettingLocation: boolean;
}) {
  const map = useMap();
  const containerRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<ReturnType<typeof createRoot> | null>(null);
  const isInitializedRef = useRef(false);

  // Use refs to store the latest props to avoid dependency issues
  const onGetLocationRef = useRef(onGetLocation);
  const isGettingLocationRef = useRef(isGettingLocation);

  // Update refs when props change
  useEffect(() => {
    onGetLocationRef.current = onGetLocation;
    isGettingLocationRef.current = isGettingLocation;
  });

  useEffect(() => {
    // Only initialize once
    if (isInitializedRef.current) return;

    const mapContainer = map.getContainer();

    // Create container div for the near me button
    const container = document.createElement('div');
    container.className = 'near-me-button-container';
    container.style.cssText = `
      position: absolute;
      bottom: 24px;
      right: 10px;
      z-index: 10000;
      pointer-events: auto;
    `;

    // Add container to map container
    mapContainer.appendChild(container);
    (containerRef as React.MutableRefObject<HTMLDivElement | null>).current = container;

    // Create React root and render the NearMeButton
    rootRef.current = createRoot(container);
    rootRef.current.render(
      <NearMeButton
        onNearMe={onGetLocationRef.current}
        isActive={false}
        isLocating={isGettingLocationRef.current}
        isAdventureTheme={false}
      />
    );

    (isInitializedRef as React.MutableRefObject<boolean>).current = true;

    const currentContainer = containerRef.current;

    // Cleanup
    return () => {
      if (currentContainer && currentContainer.parentNode) {
        currentContainer.parentNode.removeChild(currentContainer);
      }

      if (rootRef.current) {
        const root = rootRef.current;
        rootRef.current = null;

        setTimeout(() => {
          try {
            if (root && typeof root.unmount === 'function') {
              root.unmount();
            }
          } catch (error) {
            console.debug('NearMeControl unmount:', error);
          }
        }, 0);
      }

      (isInitializedRef as React.MutableRefObject<boolean>).current = false;
    };
  }, [map]);

  // Update the rendered component when props change
  useEffect(() => {
    if (rootRef.current && isInitializedRef.current) {
      rootRef.current.render(
        <NearMeButton
          onNearMe={onGetLocationRef.current}
          isActive={false}
          isLocating={isGettingLocationRef.current}
          isAdventureTheme={false}
        />
      );
    }
  }, [isGettingLocation]);

  return null;
}

export function LocationPicker({ value, onChange }: LocationPickerProps) {
  const { t } = useTranslation();
  const { theme, systemTheme } = useTheme();
  const { location: initialLocation } = useInitialLocation();
  const [coordInput, setCoordInput] = useState(
    value ? `${value.lat}, ${value.lng}` : ""
  );
  const [coordParseResult, setCoordParseResult] = useState<CoordinateParseResult | CoordinateParseError | null>(null);
  const [mapCenter, setMapCenter] = useState<LatLngExpression>([initialLocation.lat, initialLocation.lng]);
  const [beaconLocation, setBeaconLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [pinDropped, setPinDropped] = useState(false);
  const { loading: isGettingLocation, coords, getLocation } = useGeolocation();
  const lastCoordsRef = useRef<GeolocationCoordinates | null>(null);

  // Track if manual coordinates have been modified by user
  const [manualCoordsModified, setManualCoordsModified] = useState(false);

  // Update map center when initial location is detected
  useEffect(() => {
    // Only update if we don't have a value set yet and haven't dropped a pin
    if (!value && !pinDropped) {
      setMapCenter([initialLocation.lat, initialLocation.lng]);
    }
  }, [initialLocation, value, pinDropped]);

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
      // Only update coord input if it hasn't been manually modified
      if (!manualCoordsModified) {
        setCoordInput(`${formatCoordinateForInput(value.lat, true)}, ${formatCoordinateForInput(value.lng, true)}`);
        setCoordParseResult(null);
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

      // Validate GPS coordinates
      const { lat, lng } = autocorrectCoordinates(coords.latitude, coords.longitude);
      const location = { lat, lng };

      // Set beacon location for current location
      setBeaconLocation(location);
      setMapCenter([lat, lng]);
      setCoordInput(`${formatCoordinateForInput(lat, true)}, ${formatCoordinateForInput(lng, true)}`);
      setCoordParseResult(null);
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

  const handleCoordInputChange = (newValue: string) => {
    setManualCoordsModified(true);
    setCoordInput(newValue);

    if (!newValue.trim()) {
      setCoordParseResult(null);
      return;
    }

    const result = parseCoordinateString(newValue);
    setCoordParseResult(result);
  };

  const applyParsedCoordinates = (result: CoordinateParseResult) => {
    const { lat, lng } = autocorrectCoordinates(result.lat, result.lng);
    const location = { lat, lng };
    setManualCoordsModified(false);
    setCoordParseResult(null);
    setCoordInput(`${formatCoordinateForInput(lat, true)}, ${formatCoordinateForInput(lng, true)}`);
    onChange(location);
    setMapCenter([lat, lng]);
  };

  const isParseError = (result: CoordinateParseResult | CoordinateParseError): result is CoordinateParseError => {
    return 'errorKey' in result;
  };

  const handleManualInput = () => {
    const result = parseCoordinateString(coordInput);
    if (isParseError(result)) {
      setCoordParseResult(result);
      return;
    }
    // It's a valid parse (possibly with a warning)
    if (result.possibleSwap) {
      // Don't auto-apply swapped coords — let user confirm
      setCoordParseResult(result);
      return;
    }
    applyParsedCoordinates(result);
  };

  const handleSwapCoordinates = () => {
    if (coordParseResult && !isParseError(coordParseResult) && coordParseResult.possibleSwap) {
      const swapped: CoordinateParseResult = {
        ...coordParseResult,
        lat: coordParseResult.lng,
        lng: coordParseResult.lat,
        warningKey: undefined,
        possibleSwap: false,
      };
      applyParsedCoordinates(swapped);
    }
  };

  const handleCoordPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text');
    if (!pasted.trim()) return;

    // Parse the pasted value immediately
    const result = parseCoordinateString(pasted.trim());
    if (!isParseError(result) && !result.possibleSwap && !result.warningKey) {
      // Valid, clean result — auto-apply
      e.preventDefault();
      setCoordInput(pasted.trim());
      setCoordParseResult(result);
      applyParsedCoordinates(result);
    }
    // Otherwise let normal typing flow handle it (the onChange will parse it)
  };

  const handleCoordKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleManualInput();
    }
  };

  const handleLocationSearch = (location: { lat: number; lng: number; name: string }) => {
    // Validate search result coordinates
    const { lat, lng } = autocorrectCoordinates(location.lat, location.lng);

    const newLocation = { lat, lng };
    // Set beacon location for searched location
    setBeaconLocation(newLocation);
    setMapCenter([lat, lng]);
    // Update coord input and reset modification flag
    setCoordInput(`${formatCoordinateForInput(lat, true)}, ${formatCoordinateForInput(lng, true)}`);
    setCoordParseResult(null);
    setManualCoordsModified(false);

    // Don't automatically set the cache location - user must click on map
  };

  return (
    <div className="space-y-4">
      {/* Map */}
      <div className="w-full h-96 rounded-lg overflow-hidden border relative">
        {/* Search bar overlay */}
        <div className="absolute top-3 left-3 right-3 z-[1000] pointer-events-auto">
          <OmniSearch
            onLocationSelect={handleLocationSearch}
            onGeocacheSelect={() => {}} // No geocache selection on create page
            onTextSearch={() => {}} // No text search on create page
            geocaches={[]}
            placeholder={t("locationPicker.searchPlaceholder")}
            mobilePlaceholder={t("locationPicker.searchPlaceholderMobile")}
          />
        </div>

        <MapContainer
          center={mapCenter}
          zoom={value ? 15 : 10}
          style={{ height: "100%", width: "100%" }}
          attributionControl={false}
          zoomControl={false}
        >
          <TileLayer
            attribution={mapStyle?.attribution ?? ''}
            url={mapStyle?.url ?? ''}
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
          <CustomZoomControl />
          <MapStyleControl
            currentStyle={currentMapStyle}
            onStyleChange={handleStyleChange}
          />
          <NearMeControl
            onGetLocation={handleGetCurrentLocation}
            isGettingLocation={isGettingLocation}
          />
        </MapContainer>
      </div>

      <p className="text-sm text-gray-600 dark:text-muted-foreground text-center">
        {beaconLocation ? (
          <>{t("locationPicker.tapToSet")}<br />
          <span className="text-blue-600">{t("locationPicker.beaconHint")}</span></>
        ) : (
          t("locationPicker.tapToSet")
        )}
      </p>

      {/* Manual Coordinates - Collapsible */}
      <div className="space-y-4">
        <details className="group">
          <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground transition-colors text-center">
            {t("locationPicker.enterManually")}
          </summary>
          <div className="mt-3 space-y-2">
            {/* Selected location display */}
            {value && (
              <div className="bg-muted/50 dark:bg-muted rounded-lg p-3 text-center">
                <p className="text-sm font-medium text-foreground">
                  {t("locationPicker.selected", { coords: `${value.lat.toFixed(6)}, ${value.lng.toFixed(6)}` })}
                </p>
                <a
                  href={`https://www.openstreetmap.org/?mlat=${value.lat}&mlon=${value.lng}#map=15/${value.lat}/${value.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:underline inline-block mt-1"
                >
                  {t("locationPicker.viewOnOSM")}
                </a>
              </div>
            )}

            {/* Single coordinate input */}
            <Input
              type="text"
              placeholder={t("locationPicker.inputPlaceholder")}
              value={coordInput}
              onChange={(e) => handleCoordInputChange(e.target.value)}
              onPaste={handleCoordPaste}
              onKeyDown={handleCoordKeyDown}
              className="text-sm font-mono"
              autoComplete="off"
              spellCheck={false}
            />

            {/* Live parse feedback */}
            {coordParseResult && (
              <div className="text-xs space-y-1">
                {isParseError(coordParseResult) ? (
                  /* Error message */
                  <p className="text-destructive">{t(coordParseResult.errorKey)}</p>
                ) : coordParseResult.possibleSwap ? (
                  /* Swap suggestion */
                  <div className="bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded-md p-2 space-y-1.5">
                    <p className="text-yellow-700 dark:text-yellow-400 font-medium">
                      {coordParseResult.warningKey && t(coordParseResult.warningKey)}
                    </p>
                    <p className="text-muted-foreground">
                      {t("locationPicker.parsed", { coords: `${coordParseResult.lat.toFixed(5)}, ${coordParseResult.lng.toFixed(5)}` })}
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full text-xs h-7"
                      onClick={handleSwapCoordinates}
                    >
                      {t("locationPicker.swapTo", { coords: `${coordParseResult.lng.toFixed(5)}, ${coordParseResult.lat.toFixed(5)}` })}
                    </Button>
                  </div>
                ) : coordParseResult.warningKey ? (
                  /* Warning (still usable) */
                  <div className="space-y-1">
                    <p className="text-yellow-600 dark:text-yellow-400">{t(coordParseResult.warningKey)}</p>
                    <p className="text-muted-foreground">
                      {t("locationPicker.detected", { format: t(coordParseResult.format), coords: `${coordParseResult.lat.toFixed(5)}, ${coordParseResult.lng.toFixed(5)}` })}
                    </p>
                  </div>
                ) : (
                  /* Clean parse */
                  <p className="text-green-600 dark:text-green-400">
                    {t(coordParseResult.format)}: {coordParseResult.lat.toFixed(5)}, {coordParseResult.lng.toFixed(5)}
                  </p>
                )}
              </div>
            )}

            {/* Format help */}
            <p className="text-xs text-muted-foreground">
              {t("locationPicker.formatHelp")}
            </p>

            <Button
              type="button"
              variant="secondary"
              onClick={handleManualInput}
              disabled={!coordInput.trim() || (coordParseResult !== null && isParseError(coordParseResult))}
              className="w-full"
              size="sm"
            >
              {t("locationPicker.setCoordinates")}
            </Button>
          </div>
        </details>
      </div>
    </div>
  );
}