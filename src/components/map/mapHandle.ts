/**
 * App-facing map API, implemented by the MapLibre (vector) map and by the
 * Leaflet (raster) fallback for browsers without WebGL2. Map components only
 * talk to this interface, so they work on either.
 *
 * ZOOM UNITS: every zoom level that crosses this API is a standard 256px-tile
 * ("slippy map") zoom — the convention used by openstreetmap.org URLs, our own
 * `/map?zoom=` links, saved map views and `geohashPrecisionForZoom`. MapLibre
 * renders 512px tiles, so its native zoom is exactly one level lower for the
 * same view; the MapLibre implementation converts at its boundary. Leaflet
 * uses 256px-tile zooms natively.
 */

import type { MapStyle } from '@/config/mapStyles';
import type { MapIcon } from '@/utils/mapIcons';

export const GL_ZOOM_OFFSET = 1;
export const toGlZoom = (zoom: number) => zoom - GL_ZOOM_OFFSET;
export const fromGlZoom = (glZoom: number) => glZoom + GL_ZOOM_OFFSET;

export interface LatLng {
  lat: number;
  lng: number;
}

export type LatLngInput = LatLng | [number, number];

export function toLatLng(input: LatLngInput): LatLng {
  return Array.isArray(input) ? { lat: input[0], lng: input[1] } : input;
}

export function toLngLatArray(input: LatLngInput): [number, number] {
  const { lat, lng } = toLatLng(input);
  return [lng, lat];
}

/** Geographic bounding box (south/west/north/east in degrees). */
export class MapBounds {
  constructor(
    readonly south: number,
    readonly west: number,
    readonly north: number,
    readonly east: number,
  ) {}

  static fromPoints(points: LatLngInput[]): MapBounds {
    const latLngs = points.map(toLatLng);
    const lats = latLngs.map(p => p.lat);
    const lngs = latLngs.map(p => p.lng);
    return new MapBounds(Math.min(...lats), Math.min(...lngs), Math.max(...lats), Math.max(...lngs));
  }

  getSouth() { return this.south; }
  getWest() { return this.west; }
  getNorth() { return this.north; }
  getEast() { return this.east; }
  getNorthEast(): LatLng { return { lat: this.north, lng: this.east }; }
  getSouthWest(): LatLng { return { lat: this.south, lng: this.west }; }
  getCenter(): LatLng {
    return { lat: (this.south + this.north) / 2, lng: (this.west + this.east) / 2 };
  }

  /** Grow the box by `ratio` of its size on every side. */
  pad(ratio: number): MapBounds {
    const dLat = (this.north - this.south) * ratio;
    const dLng = (this.east - this.west) * ratio;
    return new MapBounds(this.south - dLat, this.west - dLng, this.north + dLat, this.east + dLng);
  }
}

export interface ViewOptions {
  animate?: boolean;
  /** Animation duration in seconds */
  duration?: number;
}

/** Camera events the app subscribes to. */
export type MapHandleEvent = 'movestart' | 'move' | 'moveend' | 'zoomend' | 'dragstart' | 'dragend' | 'load';

export interface MarkerOptions {
  title?: string;
  /** Accessible label; defaults to `title` */
  alt?: string;
  /**
   * Interactive markers are focusable, and swallow clicks so they never reach
   * the map (a marker click is not a map click).
   */
  interactive?: boolean;
  onClick?: () => void;
}

export interface MapMarkerRef {
  setPosition(position: LatLng): void;
  remove(): void;
}

export interface PopupOptions {
  position: LatLng;
  content: HTMLElement;
  /** Pixel offset of the popup tip from `position` (negative y = above) */
  offset: [number, number];
  maxWidth: number;
  className: string;
  /** Fired whenever the popup closes (outside click, Escape, replaced, map teardown) */
  onClose?: () => void;
}

export interface MapPopupRef {
  /** Show it, closing any other popup first (one popup per map) */
  open(): void;
  close(): void;
  isOpen(): boolean;
  getElement(): HTMLElement | null;
}

export interface CircleOptions {
  center: LatLng;
  radiusMeters: number;
  color: string;
  opacity: number;
  weight: number;
  dashed: boolean;
}

export interface MapHandle {
  /** 'vector' = MapLibre GL, 'raster' = Leaflet fallback */
  readonly kind: 'vector' | 'raster';

  getContainer(): HTMLElement;
  /** Render `style`; vector styles come from the OpenFreeMap-compatible `tilesUrl` */
  setMapStyle(style: MapStyle, tilesUrl: string): void;
  getZoom(): number;
  getCenter(): LatLng;
  getBounds(): MapBounds;
  getSize(): { x: number; y: number };

  setView(center: LatLngInput, zoom: number, options?: ViewOptions): void;
  flyTo(center: LatLngInput, zoom: number, options?: { duration?: number }): void;
  fitBounds(bounds: MapBounds, options?: { maxZoom?: number; animate?: boolean }): void;
  /** Pan by a screen offset; positive y moves the content up */
  panBy(offset: [number, number], options?: { duration?: number }): void;
  zoomIn(): void;
  zoomOut(): void;
  /** Re-measure the container (after it was resized or became visible). */
  invalidateSize(): void;

  on(event: MapHandleEvent, listener: () => void): void;
  off(event: MapHandleEvent, listener: () => void): void;
  once(event: MapHandleEvent, listener: () => void): void;
  /** Clicks on the map itself (never on markers, popups or floating controls) */
  onClick(listener: (position: LatLng) => void): () => void;

  addMarker(icon: MapIcon, position: LatLng, options?: MarkerOptions): MapMarkerRef;
  createPopup(options: PopupOptions): MapPopupRef;
  closePopup(): void;
  /** Outline circle that survives style switches */
  addCircle(options: CircleOptions): { remove(): void };

  remove(): void;
}

/** What a map implementation needs to create a map. */
export interface MapInitOptions {
  center: LatLngInput;
  /** 256px-tile units */
  zoom: number;
  minZoom?: number;
  maxZoom?: number;
  keyboard: boolean;
  mapStyle: MapStyle;
  tilesUrl: string;
  /** wsrv.nl-compatible image proxy for raster tiles ('' = direct) */
  imageProxy: string;
}

/** Class on every map container, whichever implementation renders it. */
export const MAP_CONTAINER_CLASS = 'treasure-map';
