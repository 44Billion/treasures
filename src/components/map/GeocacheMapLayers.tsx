/**
 * Map layer helpers for GeocacheMap.
 */

import { useEffect, useRef } from "react";
import { useMapHandle } from "./mapContext";

// Threshold at which satellite tiles run out and we fall back to original
const SATELLITE_DEEP_ZOOM_THRESHOLD = 20;

// Switches satellite style to 'original' at deep zoom where satellite tiles run out,
// and restores it when the user zooms back out.
export function SatelliteZoomFallback({
  currentStyle,
  onStyleChange,
}: {
  currentStyle: string;
  onStyleChange: (style: string) => void;
}) {
  const map = useMapHandle();
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
