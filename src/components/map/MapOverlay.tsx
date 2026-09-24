import React from 'react';
import { createPortal } from 'react-dom';
import { useMapHandle } from './mapContext';

interface MapOverlayProps {
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

/**
 * Floating UI rendered inside the map container (above the canvas, outside
 * the map's gesture handling), so clicks on it never reach the map.
 */
export function MapOverlay({ className, style, children }: MapOverlayProps) {
  const map = useMapHandle();
  return createPortal(
    <div className={className} style={{ position: 'absolute', pointerEvents: 'auto', ...style }}>
      {children}
    </div>,
    map.getContainer(),
  );
}
