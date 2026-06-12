/**
 * Tile layer components for GeocacheMap.
 */

import React, { useEffect, useRef } from "react";
import { TileLayer, useMap } from "react-leaflet";
import { type MapStyle } from "@/config/mapStyles";

// Threshold at which satellite tiles run out and we fall back to original
const SATELLITE_DEEP_ZOOM_THRESHOLD = 20;

// Custom tile layer with optimizations
export function OptimizedTileLayer({ mapStyle, crossOriginTiles = true }: { mapStyle: MapStyle; crossOriginTiles?: boolean }) {
  // All tile providers top out at 19 natively; CARTO upscales cleanly past that
  const nativeMaxZoom = 19;

  return (
    <TileLayer
      attribution={mapStyle.attribution}
      url={mapStyle.url}
      maxNativeZoom={nativeMaxZoom} // Highest zoom level tile server provides
      maxZoom={21} // Allow map to zoom past native tiles (Leaflet upscales)
      minZoom={2} // Allow zooming out further to see world wrapping
      // Optimize for fastest possible loading
      keepBuffer={1} // Smaller buffer for faster initial load
      updateWhenIdle={false} // Update immediately for faster rendering
      updateWhenZooming={false} // Don't update during zoom for smoother experience
      updateInterval={100} // Faster updates for quicker tile rendering
      // CORS: disabled in iOS Lockdown Mode (cross-origin restrictions)
      crossOrigin={crossOriginTiles ? "anonymous" : undefined}
      // Reduce tile loading overhead
      tileSize={256} // Standard tile size
      zoomOffset={0} // No zoom offset
      detectRetina={false} // Disable retina detection for consistency
      // World wrapping support
      noWrap={false} // Enable world wrapping
      bounds={[[-90, -180], [90, 180]]} // Standard world bounds
    />
  );
}

// Map styles are now imported from MapStyleSelector component

// Switches satellite style to 'original' at deep zoom where satellite tiles run out,
// and restores it when the user zooms back out.
export function SatelliteZoomFallback({
  currentStyle,
  onStyleChange,
}: {
  currentStyle: string;
  onStyleChange: (style: string) => void;
}) {
  const map = useMap();
  // Track the pre-fallback style so we can restore it on zoom-out
  const savedStyleRef = useRef<string | null>(null);

  useEffect(() => {
    const handleZoom = () => {
      const z = map.getZoom();
      if (currentStyle === 'satellite' && z >= SATELLITE_DEEP_ZOOM_THRESHOLD) {
        // Switch to original without marking it as a manual selection
        savedStyleRef.current = 'satellite';
        onStyleChange('original');
      } else if (savedStyleRef.current === 'satellite' && z < SATELLITE_DEEP_ZOOM_THRESHOLD) {
        // Restore satellite when zooming back out
        savedStyleRef.current = null;
        onStyleChange('satellite');
      }
    };

    map.on('zoomend', handleZoom);
    return () => { map.off('zoomend', handleZoom); };
  }, [map, currentStyle, onStyleChange]);

  return null;
}
