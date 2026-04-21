/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

interface RadarOverlayContextValue {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

const RadarOverlayContext = createContext<RadarOverlayContextValue | null>(null);

export function RadarOverlayProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  return (
    <RadarOverlayContext.Provider value={{ isOpen, open, close }}>
      {children}
    </RadarOverlayContext.Provider>
  );
}

export function useRadarOverlay(): RadarOverlayContextValue {
  const ctx = useContext(RadarOverlayContext);
  if (!ctx) {
    throw new Error('useRadarOverlay must be used within a RadarOverlayProvider');
  }
  return ctx;
}
