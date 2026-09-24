/**
 * Floating button controls for GeocacheMap.
 *
 * Each renders a real React component (style selector, near-me, compass,
 * earth-view buttons) into an absolutely positioned container inside the
 * map container. The container class names are what `getPopupAutoPanPadding`
 * looks for, so keep them stable.
 */

import { MapStyleSelector } from "@/components/MapStyleSelector";
import { NearMeButton } from "@/components/NearMeButton";
import { CompassMapButton } from "@/components/CompassMapButton";
import { EarthViewMapButton } from "@/components/EarthViewMapButton";
import { MapOverlay } from "./MapOverlay";

// Custom map style control - positioned at lower left above zoom
export function MapStyleControl({
  currentStyle,
  onStyleChange,
  bottom = 'calc(106px + env(safe-area-inset-bottom, 0px))',
  zIndex = 1000,
}: {
  currentStyle: string;
  onStyleChange: (style: string) => void;
  bottom?: string;
  zIndex?: number;
}) {
  return (
    <MapOverlay className="map-style-control-container" style={{ bottom, left: 10, zIndex }}>
      <MapStyleSelector currentStyle={currentStyle} onStyleChange={onStyleChange} />
    </MapOverlay>
  );
}

// Custom component for near me button - positioned at lower right corner
export function NearMeButtonControl({
  onNearMe,
  isNearMeActive,
  isGettingLocation,
  isAdventureTheme,
  bottom = 'calc(16px + env(safe-area-inset-bottom, 0px))',
  right = 16,
  zIndex = 1000,
}: {
  onNearMe: () => void;
  isNearMeActive: boolean;
  isGettingLocation: boolean;
  isAdventureTheme: boolean;
  bottom?: string;
  right?: number;
  zIndex?: number;
}) {
  return (
    <MapOverlay className="near-me-button-container" style={{ bottom, right, zIndex }}>
      <NearMeButton
        onNearMe={onNearMe}
        isActive={isNearMeActive}
        isLocating={isGettingLocation}
        isAdventureTheme={isAdventureTheme}
      />
    </MapOverlay>
  );
}

// Custom component for compass/radar button — positioned above Near Me button at lower right
export function CompassMapButtonControl({
  onOpenRadar,
  isAdventureTheme
}: {
  onOpenRadar: () => void;
  isAdventureTheme: boolean;
}) {
  return (
    <MapOverlay
      className="compass-button-container hidden lg:block"
      style={{ bottom: 'calc(112px + env(safe-area-inset-bottom, 0px))', right: 16, zIndex: 1000 }}
    >
      <CompassMapButton onClick={onOpenRadar} isAdventureTheme={isAdventureTheme} />
    </MapOverlay>
  );
}

// Custom component for earth view button — positioned between compass and Near Me at lower right
export function EarthViewButtonControl({
  onShowEarth
}: {
  onShowEarth: () => void;
}) {
  return (
    <MapOverlay
      className="earth-button-container"
      style={{ bottom: 'calc(64px + env(safe-area-inset-bottom, 0px))', right: 16, zIndex: 1000 }}
    >
      <EarthViewMapButton onClick={onShowEarth} />
    </MapOverlay>
  );
}
