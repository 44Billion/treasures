/**
 * `MapHandle` backed by MapLibre GL JS (vector tiles, WebGL2).
 */

import {
  LngLatBounds,
  Map as MapLibreMap,
  Marker,
  Popup,
  type GeoJSONSource,
} from 'maplibre-gl';
import type { MapStyle } from '@/config/mapStyles';
import { applyMapStyle } from '@/lib/mapStyleLoader';
import type { MapIcon } from '@/utils/mapIcons';
import {
  MAP_CONTAINER_CLASS,
  MapBounds,
  fromGlZoom,
  toGlZoom,
  toLatLng,
  toLngLatArray,
  type CircleOptions,
  type LatLng,
  type LatLngInput,
  type MapHandle,
  type MapHandleEvent,
  type MapInitOptions,
  type MapMarkerRef,
  type MapPopupRef,
  type MarkerOptions,
  type PopupOptions,
  type ViewOptions,
} from './mapHandle';
import { createMarkerElement } from './mapMarkers';

const EARTH_RADIUS_M = 6371008.8;
const CIRCLE_SEGMENTS = 64;

/** Closed ring approximating a geodesic circle. */
function circleRing(center: LatLng, radiusMeters: number): [number, number][] {
  const lat1 = (center.lat * Math.PI) / 180;
  const lng1 = (center.lng * Math.PI) / 180;
  const d = radiusMeters / EARTH_RADIUS_M;
  const ring: [number, number][] = [];
  for (let i = 0; i <= CIRCLE_SEGMENTS; i++) {
    const bearing = (i / CIRCLE_SEGMENTS) * 2 * Math.PI;
    const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(bearing));
    const lng2 = lng1 + Math.atan2(
      Math.sin(bearing) * Math.sin(d) * Math.cos(lat1),
      Math.cos(d) - Math.sin(lat1) * Math.sin(lat2),
    );
    ring.push([(lng2 * 180) / Math.PI, (lat2 * 180) / Math.PI]);
  }
  return ring;
}

let circleIds = 0;

export class GlMapHandle implements MapHandle {
  readonly kind = 'vector';
  private activePopup: Popup | null = null;
  private removeEscapeListener: (() => void) | null = null;

  constructor(readonly gl: MapLibreMap) {}

  getContainer(): HTMLElement {
    return this.gl.getContainer();
  }

  setMapStyle(style: MapStyle, tilesUrl: string): void {
    applyMapStyle(this.gl, style, tilesUrl);
  }

  getZoom(): number {
    return fromGlZoom(this.gl.getZoom());
  }

  getCenter(): LatLng {
    const { lat, lng } = this.gl.getCenter();
    return { lat, lng };
  }

  getBounds(): MapBounds {
    const b = this.gl.getBounds();
    return new MapBounds(b.getSouth(), b.getWest(), b.getNorth(), b.getEast());
  }

  getSize(): { x: number; y: number } {
    const container = this.getContainer();
    return { x: container.clientWidth, y: container.clientHeight };
  }

  setView(center: LatLngInput, zoom: number, options: ViewOptions = {}): void {
    const camera = { center: toLngLatArray(center), zoom: toGlZoom(zoom) };
    if (options.animate) {
      this.gl.easeTo({ ...camera, duration: (options.duration ?? 0.25) * 1000 });
    } else {
      this.gl.jumpTo(camera);
    }
  }

  flyTo(center: LatLngInput, zoom: number, options: { duration?: number } = {}): void {
    this.gl.flyTo({
      center: toLngLatArray(center),
      zoom: toGlZoom(zoom),
      duration: (options.duration ?? 1.5) * 1000,
      essential: true,
    });
  }

  fitBounds(bounds: MapBounds, options: { maxZoom?: number; animate?: boolean } = {}): void {
    this.gl.fitBounds(
      new LngLatBounds([bounds.west, bounds.south], [bounds.east, bounds.north]),
      {
        maxZoom: options.maxZoom !== undefined ? toGlZoom(options.maxZoom) : undefined,
        animate: options.animate ?? true,
      },
    );
  }

  panBy(offset: [number, number], options: { duration?: number } = {}): void {
    this.gl.panBy(offset, { duration: (options.duration ?? 0.25) * 1000 });
  }

  zoomIn(): void {
    this.gl.zoomIn();
  }

  zoomOut(): void {
    this.gl.zoomOut();
  }

  invalidateSize(): void {
    this.gl.resize();
  }

  on(event: MapHandleEvent, listener: () => void): void {
    this.gl.on(event, listener);
  }

  off(event: MapHandleEvent, listener: () => void): void {
    this.gl.off(event, listener);
  }

  once(event: MapHandleEvent, listener: () => void): void {
    this.gl.once(event, listener);
  }

  onClick(listener: (position: LatLng) => void): () => void {
    // Markers swallow their clicks and floating controls/popups live outside
    // the canvas container, so every click here landed on the map itself.
    const handler = (e: { lngLat: { lat: number; lng: number } }) => {
      listener({ lat: e.lngLat.lat, lng: e.lngLat.lng });
    };
    this.gl.on('click', handler);
    return () => {
      this.gl.off('click', handler);
    };
  }

  addMarker(icon: MapIcon, position: LatLng, options: MarkerOptions = {}): MapMarkerRef {
    const marker = new Marker({
      element: createMarkerElement(icon, options),
      anchor: 'top-left',
      offset: [-icon.iconAnchor[0], -icon.iconAnchor[1]],
    })
      .setLngLat([position.lng, position.lat])
      .addTo(this.gl);

    return {
      setPosition: (p) => { marker.setLngLat([p.lng, p.lat]); },
      remove: () => { marker.remove(); },
    };
  }

  createPopup(options: PopupOptions): MapPopupRef {
    const popup = new Popup({
      closeButton: false,
      closeOnClick: true,
      closeOnMove: false,
      focusAfterOpen: false,
      anchor: 'bottom',
      offset: options.offset,
      maxWidth: `${options.maxWidth}px`,
      className: options.className,
    })
      .setLngLat([options.position.lng, options.position.lat])
      .setDOMContent(options.content);

    if (options.onClose) popup.on('close', options.onClose);

    return {
      open: () => this.openPopup(popup),
      close: () => { popup.remove(); },
      isOpen: () => this.activePopup === popup && popup.isOpen(),
      getElement: () => popup.getElement() ?? null,
    };
  }

  private openPopup(popup: Popup): void {
    if (this.activePopup && this.activePopup !== popup) {
      this.closePopup();
    }
    this.activePopup = popup;
    popup.once('close', () => {
      if (this.activePopup === popup) {
        this.activePopup = null;
        this.removeEscapeListener?.();
        this.removeEscapeListener = null;
      }
    });
    popup.addTo(this.gl);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') this.closePopup();
    };
    this.removeEscapeListener?.();
    document.addEventListener('keydown', onKeyDown);
    this.removeEscapeListener = () => document.removeEventListener('keydown', onKeyDown);
  }

  closePopup(): void {
    // `remove()` fires the popup's `close` event, which clears `activePopup`.
    this.activePopup?.remove();
    this.activePopup = null;
    this.removeEscapeListener?.();
    this.removeEscapeListener = null;
  }

  addCircle(options: CircleOptions): { remove(): void } {
    const gl = this.gl;
    const id = `circle-${++circleIds}`;
    const data = {
      type: 'Feature' as const,
      properties: {},
      geometry: { type: 'LineString' as const, coordinates: circleRing(options.center, options.radiusMeters) },
    };

    const sync = () => {
      if (!gl.isStyleLoaded()) return;
      const source = gl.getSource<GeoJSONSource>(id);
      if (source) {
        source.setData(data);
        return;
      }
      gl.addSource(id, { type: 'geojson', data });
      gl.addLayer({
        id,
        type: 'line',
        source: id,
        paint: {
          'line-color': options.color,
          'line-opacity': options.opacity,
          'line-width': options.weight,
          ...(options.dashed ? { 'line-dasharray': [4, 4] } : {}),
        },
      });
    };

    sync();
    // A style switch drops custom layers; put the circle back on the new style.
    gl.on('style.load', sync);
    return {
      remove: () => {
        gl.off('style.load', sync);
        try {
          if (gl.getLayer(id)) gl.removeLayer(id);
          if (gl.getSource(id)) gl.removeSource(id);
        } catch {
          // The map was already torn down.
        }
      },
    };
  }

  remove(): void {
    this.closePopup();
    this.gl.remove();
  }
}

/**
 * Create a vector map in `container`. Throws `GPUInitializationError` when
 * the browser can't provide a WebGL2 context.
 */
export function createVectorMap(container: HTMLElement, init: MapInitOptions): GlMapHandle {
  const { lat, lng } = toLatLng(init.center);
  const gl = new MapLibreMap({
    container,
    center: [lng, lat],
    zoom: toGlZoom(init.zoom),
    minZoom: init.minZoom !== undefined ? toGlZoom(init.minZoom) : undefined,
    maxZoom: init.maxZoom !== undefined ? toGlZoom(init.maxZoom) : undefined,
    attributionControl: false,
    // Flat, north-up map: no rotation or pitch gestures.
    dragRotate: false,
    pitchWithRotate: false,
    touchPitch: false,
    maxPitch: 0,
    boxZoom: false,
    keyboard: init.keyboard,
  });
  gl.getContainer().classList.add(MAP_CONTAINER_CLASS);
  gl.touchZoomRotate.disableRotation();
  applyMapStyle(gl, init.mapStyle, init.tilesUrl);
  return new GlMapHandle(gl);
}
