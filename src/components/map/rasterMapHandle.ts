/**
 * `MapHandle` backed by Leaflet and server-rendered PNG tiles — the fallback
 * for browsers without WebGL2 (iOS Lockdown Mode, WebGL1-only browsers, GPU
 * acceleration off). Loaded on demand, so other browsers never download it.
 */

import L from 'leaflet';
import {
  colorFilterToCss,
  rasterTileUrl,
  type MapStyle,
} from '@/config/mapStyles';
import type { MapIcon } from '@/utils/mapIcons';
import {
  MAP_CONTAINER_CLASS,
  MapBounds,
  toLatLng,
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

import 'leaflet/dist/leaflet.css';
import '@/styles/map-raster.css';

/** Leaflet icon that places a prebuilt element (see `createMarkerElement`). */
class ElementIcon extends L.Icon {
  constructor(private readonly element: HTMLElement, icon: MapIcon) {
    // Leaflet rewrites the element's className from these options
    super({ iconUrl: '', iconSize: icon.iconSize, iconAnchor: icon.iconAnchor, className: icon.className });
  }

  createIcon(): HTMLElement {
    // Leaflet's own sizing/anchoring (margins from iconSize/iconAnchor).
    (this as unknown as { _setIconStyles(el: HTMLElement, name: string): void })
      ._setIconStyles(this.element, 'icon');
    return this.element;
  }
}

function tileLayerFor(style: MapStyle, imageProxy: string): L.TileLayer {
  const { source } = style;
  if (source.type === 'raster') {
    return L.tileLayer(source.tiles[0]!, {
      maxNativeZoom: source.maxzoom,
      maxZoom: 21,
    });
  }
  const layer = L.tileLayer(rasterTileUrl(source.style, imageProxy), {
    maxNativeZoom: 20,
    maxZoom: 21,
  });
  if (source.colorFilter) {
    // Same retint the vector map bakes into its style colors
    const filter = colorFilterToCss(source.colorFilter);
    layer.on('add', () => {
      const el = layer.getContainer();
      if (el) el.style.filter = filter;
    });
  }
  return layer;
}

export class RasterMapHandle implements MapHandle {
  readonly kind = 'raster';
  private tiles: L.TileLayer | null = null;

  constructor(readonly leaflet: L.Map, private readonly imageProxy: string) {}

  getContainer(): HTMLElement {
    return this.leaflet.getContainer();
  }

  setMapStyle(style: MapStyle): void {
    this.tiles?.remove();
    this.tiles = tileLayerFor(style, this.imageProxy).addTo(this.leaflet);
  }

  getZoom(): number {
    return this.leaflet.getZoom();
  }

  getCenter(): LatLng {
    const { lat, lng } = this.leaflet.getCenter();
    return { lat, lng };
  }

  getBounds(): MapBounds {
    const b = this.leaflet.getBounds();
    return new MapBounds(b.getSouth(), b.getWest(), b.getNorth(), b.getEast());
  }

  getSize(): { x: number; y: number } {
    const { x, y } = this.leaflet.getSize();
    return { x, y };
  }

  setView(center: LatLngInput, zoom: number, options: ViewOptions = {}): void {
    const { lat, lng } = toLatLng(center);
    this.leaflet.setView([lat, lng], zoom, {
      animate: options.animate ?? false,
      duration: options.duration ?? 0.25,
    });
  }

  flyTo(center: LatLngInput, zoom: number, options: { duration?: number } = {}): void {
    const { lat, lng } = toLatLng(center);
    this.leaflet.flyTo([lat, lng], zoom, { duration: options.duration ?? 1.5 });
  }

  fitBounds(bounds: MapBounds, options: { maxZoom?: number; animate?: boolean } = {}): void {
    this.leaflet.fitBounds(
      [[bounds.south, bounds.west], [bounds.north, bounds.east]],
      { maxZoom: options.maxZoom, animate: options.animate ?? true },
    );
  }

  panBy(offset: [number, number], options: { duration?: number } = {}): void {
    this.leaflet.panBy(offset, { animate: true, duration: options.duration ?? 0.25 });
  }

  zoomIn(): void {
    this.leaflet.zoomIn();
  }

  zoomOut(): void {
    this.leaflet.zoomOut();
  }

  invalidateSize(): void {
    this.leaflet.invalidateSize();
  }

  on(event: MapHandleEvent, listener: () => void): void {
    this.leaflet.on(event, listener);
  }

  off(event: MapHandleEvent, listener: () => void): void {
    this.leaflet.off(event, listener);
  }

  once(event: MapHandleEvent, listener: () => void): void {
    this.leaflet.once(event, listener);
  }

  onClick(listener: (position: LatLng) => void): () => void {
    const handler = (e: L.LeafletMouseEvent) => {
      listener({ lat: e.latlng.lat, lng: e.latlng.lng });
    };
    this.leaflet.on('click', handler);
    return () => {
      this.leaflet.off('click', handler);
    };
  }

  addMarker(icon: MapIcon, position: LatLng, options: MarkerOptions = {}): MapMarkerRef {
    const element = createMarkerElement(icon, options);
    // The element handles its own clicks/keys; Leaflet only positions it.
    const marker = L.marker([position.lat, position.lng], {
      icon: new ElementIcon(element, icon),
      interactive: false,
      keyboard: false,
    }).addTo(this.leaflet);

    return {
      setPosition: (p) => { marker.setLatLng([p.lat, p.lng]); },
      remove: () => { marker.remove(); },
    };
  }

  createPopup(options: PopupOptions): MapPopupRef {
    const popup = L.popup({
      closeButton: false,
      autoPan: false, // openReactPopup pans around the floating UI itself
      closeOnClick: true,
      closeOnEscapeKey: true,
      maxWidth: options.maxWidth,
      minWidth: 0,
      offset: options.offset,
      className: options.className,
    })
      .setLatLng([options.position.lat, options.position.lng])
      .setContent(options.content);

    if (options.onClose) popup.on('remove', options.onClose);

    return {
      open: () => { popup.openOn(this.leaflet); },
      close: () => { this.leaflet.closePopup(popup); },
      isOpen: () => popup.isOpen(),
      getElement: () => popup.getElement() ?? null,
    };
  }

  closePopup(): void {
    this.leaflet.closePopup();
  }

  addCircle(options: CircleOptions): { remove(): void } {
    const circle = L.circle([options.center.lat, options.center.lng], {
      radius: options.radiusMeters,
      color: options.color,
      opacity: options.opacity,
      weight: options.weight,
      dashArray: options.dashed ? '6, 6' : undefined,
      fill: false,
      interactive: false,
    }).addTo(this.leaflet);
    return { remove: () => { circle.remove(); } };
  }

  remove(): void {
    this.leaflet.closePopup();
    this.leaflet.remove();
  }
}

export function createRasterMap(container: HTMLElement, init: MapInitOptions): RasterMapHandle {
  const { lat, lng } = toLatLng(init.center);
  const leaflet = L.map(container, {
    center: [lat, lng],
    zoom: init.zoom,
    minZoom: init.minZoom,
    maxZoom: init.maxZoom ?? 21,
    zoomControl: false,
    attributionControl: false,
    keyboard: init.keyboard,
    boxZoom: false,
    worldCopyJump: true,
  });
  leaflet.getContainer().classList.add(MAP_CONTAINER_CLASS);
  const handle = new RasterMapHandle(leaflet, init.imageProxy);
  handle.setMapStyle(init.mapStyle);
  return handle;
}
