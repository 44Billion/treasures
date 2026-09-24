import { createContext, useContext } from 'react';
import type { MapHandle } from './mapHandle';

export const MapContext = createContext<MapHandle | null>(null);

/** The map instance of the enclosing `<MapView>`. */
export function useMapHandle(): MapHandle {
  const map = useContext(MapContext);
  if (!map) throw new Error('useMapHandle must be used inside <MapView>');
  return map;
}
