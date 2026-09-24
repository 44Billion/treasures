import { useEffect } from 'react';
import { useMapHandle } from './mapContext';
import type { LatLng } from './mapHandle';

interface MapCircleProps {
  center: LatLng;
  radiusMeters: number;
  color: string;
  opacity: number;
  weight?: number;
  dashed?: boolean;
}

/** Outline-only circle; survives map style switches. */
export function MapCircle({ center, radiusMeters, color, opacity, weight = 1.5, dashed = true }: MapCircleProps) {
  const map = useMapHandle();
  const { lat, lng } = center;

  useEffect(() => {
    const circle = map.addCircle({ center: { lat, lng }, radiusMeters, color, opacity, weight, dashed });
    return () => circle.remove();
  }, [map, lat, lng, radiusMeters, color, opacity, weight, dashed]);

  return null;
}
