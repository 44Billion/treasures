import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { MysteriousMap } from "@/components/MysteriousMap";
import { OmniSearch } from "@/components/OmniSearch";
import { CustomZoomControl } from "@/components/map/CustomZoomControl";
import { MapView } from "@/components/map/MapView";
import { MapMarker } from "@/components/map/MapMarker";
import { MapClickHandler } from "@/components/map/GeocacheMapControllers";
import { MapStyleControl, NearMeButtonControl } from "@/components/map/GeocacheMapControls";
import { useMapHandle } from "@/components/map/mapContext";
import { MAP_STYLES, type MapStyle } from "@/config/mapStyles";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useInitialLocation } from "@/hooks/useInitialLocation";
import { useTheme } from "@/hooks/useTheme";
import { autocorrectCoordinates, formatCoordinateForInput, parseCoordinateString, CoordinateParseResult, CoordinateParseError } from "@/utils/coordinates";
import { mapIcons } from "@/utils/mapIcons";
import { hapticMedium } from "@/utils/haptics";

interface LocationPickerProps {
  value: { lat: number; lng: number } | null;
  onChange: (location: { lat: number; lng: number }) => void;
  /**
   * Optional "unknown location" mystery mode. When these props are provided a
   * toggle appears inside the "Enter manually" advanced disclosure; enabling it
   * swaps the map for the mysterious placeholder and hides coordinate entry.
   * Omit both to render a plain picker (unchanged behaviour for other callers).
   */
  locationUnknown?: boolean;
  onLocationUnknownChange?: (value: boolean) => void;
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
  center?: [number, number];
  beaconLocation?: { lat: number; lng: number } | null;
  onPinDropped?: () => void;
  onMapClick?: () => void;
}) {
  const map = useMapHandle();

  // Floating controls and markers never reach the map's click handler, so
  // every click here landed on the map itself.
  const handleClick = (location: { lat: number; lng: number }) => {
    hapticMedium();
    onChange(location);
    // Notify parent that pin was dropped (so it doesn't update map center)
    onPinDropped?.();
    // Notify parent that map was clicked (to reset manual coords modification)
    onMapClick?.();
  };

  useEffect(() => {
    if (center) {
      // Preserve current zoom level when updating center
      map.setView(center, map.getZoom());
    }
  }, [center, map]);

  return (
    <>
      <MapClickHandler onClick={handleClick} />

      {/* Blue beacon for current/searched location */}
      {beaconLocation && (
        <MapMarker position={beaconLocation} icon={mapIcons.blueBeacon} interactive={false} />
      )}

      {/* Red pin for selected cache location */}
      {value && (
        <MapMarker position={value} icon={mapIcons.droppedPin} />
      )}
    </>
  );
}

export function LocationPicker({ value, onChange, locationUnknown, onLocationUnknownChange }: LocationPickerProps) {
  const { t } = useTranslation();
  const { theme, systemTheme } = useTheme();
  const { location: initialLocation } = useInitialLocation();
  const [coordInput, setCoordInput] = useState(
    value ? `${value.lat}, ${value.lng}` : ""
  );
  const [coordParseResult, setCoordParseResult] = useState<CoordinateParseResult | CoordinateParseError | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number]>([initialLocation.lat, initialLocation.lng]);
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
    } else if (theme === "mojave") {
      return "mojave";
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
  const mapStyle = (MAP_STYLES[currentMapStyle] || MAP_STYLES.original) as MapStyle;

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
      } else if (theme === "mojave") {
        return "mojave";
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
      {locationUnknown ? (
        /* Mystery mode — no map, no coordinates leaked */
        <div className="w-full h-96 rounded-lg overflow-hidden border">
          <MysteriousMap />
        </div>
      ) : (
      <>
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

        <MapView
          center={mapCenter}
          zoom={value ? 15 : 10}
          maxZoom={19}
          mapStyle={mapStyle}
        >
          <LocationSelector
            value={value}
            onChange={onChange}
            center={mapCenter}
            beaconLocation={beaconLocation}
            onPinDropped={() => setPinDropped(true)}
            onMapClick={() => setManualCoordsModified(false)}
          />
          <CustomZoomControl bottomOffset={24} respectSafeArea={false} zIndex={10000} />
          <MapStyleControl
            currentStyle={currentMapStyle}
            onStyleChange={handleStyleChange}
            bottom="114px"
            zIndex={10000}
          />
          <NearMeButtonControl
            onNearMe={handleGetCurrentLocation}
            isNearMeActive={false}
            isGettingLocation={isGettingLocation}
            isAdventureTheme={false}
            bottom="24px"
            right={10}
            zIndex={10000}
          />
        </MapView>
      </div>

      <p className="text-sm text-muted-foreground text-center">
        {beaconLocation ? (
          <>{t("locationPicker.tapToSet")}<br />
          <span className="text-primary">{t("locationPicker.beaconHint")}</span></>
        ) : (
          t("locationPicker.tapToSet")
        )}
      </p>
      </>
      )}

      {/* Manual Coordinates - Collapsible */}
      <div className="space-y-4">
        <details className="group" open={locationUnknown}>
          <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground transition-colors text-center">
            {t("locationPicker.enterManually")}
          </summary>
          <div className="mt-3 space-y-2">
            {!locationUnknown && (
            <>
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
                  className="text-xs text-primary hover:underline inline-block mt-1"
                >
                  {t("locationPicker.viewOnOSM")}
                </a>
              </div>
            )}

            {/* Single coordinate input */}
            <Input
              type="text"
              inputMode="text"
              enterKeyHint="done"
              placeholder={t("locationPicker.inputPlaceholder")}
              value={coordInput}
              onChange={(e) => handleCoordInputChange(e.target.value)}
              onPaste={handleCoordPaste}
              onKeyDown={handleCoordKeyDown}
              className="text-sm font-mono"
              autoComplete="off"
              spellCheck={false}
              aria-label={t("locationPicker.inputPlaceholder")}
            />

            {/* Live parse feedback */}
            {coordParseResult && (
              <div className="text-xs space-y-1" role="status" aria-live="polite">
                {isParseError(coordParseResult) ? (
                  /* Error message */
                  <p className="text-destructive">{t(coordParseResult.errorKey)}</p>
                ) : coordParseResult.possibleSwap ? (
                  /* Swap suggestion */
                  <div className="bg-yellow-500/10 border border-yellow-500/40 rounded-md p-2 space-y-1.5">
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
            </>
            )}

            {/* Unknown-location mystery toggle (only when the caller opts in) */}
            {onLocationUnknownChange && (
              <div className="mt-1 space-y-1">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <HelpCircle className="h-4 w-4 text-muted-foreground shrink-0" />
                    <Label htmlFor="lp-location-unknown" className="text-sm font-normal text-muted-foreground cursor-pointer">
                      {t("locationPicker.unknownLocation.label")}
                    </Label>
                  </div>
                  <Switch
                    id="lp-location-unknown"
                    checked={!!locationUnknown}
                    onCheckedChange={onLocationUnknownChange}
                  />
                </div>
                <p className="text-xs text-muted-foreground pl-6">
                  {t("locationPicker.unknownLocation.description")}
                </p>
              </div>
            )}
          </div>
        </details>
      </div>
    </div>
  );
}