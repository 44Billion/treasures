import { useEffect, useRef } from 'react';
import type { MapIcon } from '@/utils/mapIcons';
import { useMapHandle } from './mapContext';
import type { LatLng, MapMarkerRef } from './mapHandle';

interface MapMarkerProps {
  position: LatLng;
  icon: MapIcon;
  title?: string;
  alt?: string;
  interactive?: boolean;
  onClick?: () => void;
}

/** A single HTML marker on the enclosing map. */
export function MapMarker({ position, icon, title, alt, interactive = true, onClick }: MapMarkerProps) {
  const map = useMapHandle();
  const markerRef = useRef<MapMarkerRef | null>(null);
  const positionRef = useRef(position);
  positionRef.current = position;
  const onClickRef = useRef(onClick);
  onClickRef.current = onClick;

  useEffect(() => {
    const marker = map.addMarker(icon, positionRef.current, {
      title,
      alt,
      interactive,
      onClick: () => onClickRef.current?.(),
    });
    markerRef.current = marker;
    return () => {
      marker.remove();
      markerRef.current = null;
    };
  }, [map, icon, title, alt, interactive]);

  useEffect(() => {
    markerRef.current?.setPosition({ lat: position.lat, lng: position.lng });
  }, [position.lat, position.lng]);

  return null;
}
