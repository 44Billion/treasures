// Map Feature Barrel Export
// This file provides a clean interface for importing map-related functionality

// Components
export { GeocacheMap } from './components/GeocacheMap';
export { MapStyleSelector } from './components/MapStyleSelector';
export { OfflineMap } from './components/OfflineMap';

// Constants
export { MAP_STYLES, ADVENTURE_COLORS } from './constants/mapStyles';

// Hooks
export { useGeolocation } from './hooks/useGeolocation';

// Utils - avoid duplicate exports
export { calculateDistance, formatDistance, sortByDistance, filterByRadius, findClosestGeocache } from './utils/geo';
export { coordinatesToArray, arrayToCoordinates, parseCoordinateString, formatCoordinates as formatCoordinateUtils, isValidCoordinates, calculateBounds, isWithinBounds, formatCoordinatesForDisplay as formatCoordinateDisplay } from './utils/coordinateUtils';
export { parseCoordinate, autocorrectCoordinates, formatCoordinates as formatCoordinateString, getCoordinatePrecision, getGeohashPrecisionLevels, formatCoordinateForInput } from './utils/coordinates';
export { getIPLocation } from './utils/ipGeolocation';
export * from './utils/mapIcons';

// Types
export type * from './types';