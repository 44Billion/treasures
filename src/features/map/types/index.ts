// Map Types

// Location and coordinate types
export interface Location {
  lat: number;
  lng: number;
}

export interface GeolocationPosition {
  coords: {
    latitude: number;
    longitude: number;
    accuracy: number;
    altitude?: number | null;
    altitudeAccuracy?: number | null;
    heading?: number | null;
    speed?: number | null;
  };
  timestamp: number;
}

export interface GeolocationError {
  code: number;
  message: string;
}

// Map style types (re-export from MapStyleSelector)
export interface MapStyle {
  key: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  url: string;
  attribution: string;
  preview?: string;
}

// Map component props
export interface MapProps {
  center?: Location;
  zoom?: number;
  userLocation?: Location | null;
  searchLocation?: Location | null;
  searchRadius?: number;
  onMarkerClick?: (geocache: any) => void;
  highlightedGeocache?: string;
  showStyleSelector?: boolean;
  isNearMeActive?: boolean;
  mapRef?: React.RefObject<L.Map>;
  isMapCenterLocked?: boolean;
}

// Geolocation hook types
export interface GeolocationState {
  location: Location | null;
  error: GeolocationError | null;
  loading: boolean;
  accuracy: number | null;
}

export interface GeolocationOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
  watch?: boolean;
}