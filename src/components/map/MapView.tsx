/**
 * React host for a map.
 *
 * Creates the map once on mount (`center` and `zoom` are initial values
 * only — move the map through the handle), keeps the rendered style in sync
 * with `mapStyle`, and exposes the `MapHandle` to children through
 * `useMapHandle()`. Children render only once the map exists.
 *
 * Renders a MapLibre vector map; browsers without WebGL2 get a Leaflet map of
 * server-rendered raster tiles instead (loaded on demand), with the same
 * markers, popups and controls.
 */

import React, { useEffect, useRef, useState } from 'react';
import { GPUInitializationError, setWorkerUrl } from 'maplibre-gl';
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { resolveMapTilesUrl, type MapStyle } from '@/config/mapStyles';
import { useAppContext } from '@/hooks/useAppContext';
import { cn } from '@/lib/utils';
import { MapContext } from './mapContext';
import { createVectorMap, GlMapHandle } from './glMapHandle';
import { toLatLng, type LatLngInput, type MapHandle, type MapInitOptions } from './mapHandle';
import { MapUnavailable, type MapFailure } from './MapUnavailable';

import 'maplibre-gl/dist/maplibre-gl.css';
import '@/styles/map-overrides.css';
import '@/styles/map-features.css';

// MapLibre resolves its worker relative to its own module URL, which doesn't
// survive bundling — point it at the worker chunk Vite emits instead.
setWorkerUrl(maplibreWorkerUrl);

interface MapViewProps {
  center: LatLngInput;
  /** Initial zoom (256px-tile units, see mapHandle.ts) */
  zoom: number;
  minZoom?: number;
  maxZoom?: number;
  mapStyle: MapStyle;
  /** Arrow-key panning / +/- zooming when the map has focus */
  keyboard?: boolean;
  className?: string;
  /** Fired once, when the first style has loaded (tiles may still be streaming in) */
  onLoad?: (map: MapHandle) => void;
  /** Fired if no map can be created; a notice renders instead */
  onUnavailable?: () => void;
  /** Offered on that notice as a way to browse without the map */
  onShowList?: () => void;
  children?: React.ReactNode;
}

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

export function MapView({
  center,
  zoom,
  minZoom,
  maxZoom,
  mapStyle,
  keyboard = true,
  className,
  onLoad,
  onUnavailable,
  onShowList,
  children,
}: MapViewProps) {
  const { config } = useAppContext();
  const tilesUrl = resolveMapTilesUrl(config.mapTilesUrl);
  const containerRef = useRef<HTMLDivElement>(null);
  const [handle, setHandle] = useState<MapHandle | null>(null);
  const [failure, setFailure] = useState<MapFailure | null>(null);

  const initialRef = useRef<MapInitOptions>({
    center, zoom, minZoom, maxZoom, mapStyle, keyboard, tilesUrl, imageProxy: config.imageProxy,
  });
  const onLoadRef = useRef(onLoad);
  onLoadRef.current = onLoad;
  const onUnavailableRef = useRef(onUnavailable);
  onUnavailableRef.current = onUnavailable;
  // Identifies the rendered style: map style + tile server
  const appliedStyleKeyRef = useRef<string | null>(null);
  const styleKey = `${mapStyle.key}@${tilesUrl}`;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const init = initialRef.current;
    let cancelled = false;
    let mapHandle: MapHandle | null = null;

    const attach = (created: MapHandle) => {
      mapHandle = created;
      appliedStyleKeyRef.current = `${init.mapStyle.key}@${init.tilesUrl}`;
      if (created instanceof GlMapHandle) {
        created.gl.once('style.load', () => onLoadRef.current?.(created));
      } else {
        onLoadRef.current?.(created);
      }
      setHandle(created);
    };

    const fail = (next: MapFailure, error: unknown) => {
      console.warn('Map failed to initialize:', error);
      setFailure(next);
      onUnavailableRef.current?.();
    };

    try {
      attach(createVectorMap(container, init));
    } catch (error: unknown) {
      if (!(error instanceof GPUInitializationError)) {
        // Anything other than missing WebGL2 is a real bug — show it.
        fail({ reason: 'error', message: errorMessage(error) }, error);
      } else {
        // No WebGL2 (iOS Lockdown Mode, WebGL1-only browsers, GPU acceleration
        // off): fall back to the raster map.
        console.warn('WebGL2 unavailable, using the raster map:', error);
        // Clear whatever MapLibre set up before it gave up.
        container.replaceChildren();
        container.className = cn('h-full w-full', className);
        import('./rasterMapHandle')
          .then(({ createRasterMap }) => {
            if (!cancelled) attach(createRasterMap(container, init));
          })
          .catch((rasterError: unknown) => {
            if (!cancelled) fail({ reason: 'webgl' }, rasterError);
          });
      }
    }

    return () => {
      cancelled = true;
      setHandle(null);
      mapHandle?.remove();
    };
    // Mount-only: the map is created once; later prop changes go through the handle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!handle || appliedStyleKeyRef.current === styleKey) return;
    handle.setMapStyle(mapStyle, tilesUrl);
    appliedStyleKeyRef.current = styleKey;
  }, [handle, mapStyle, tilesUrl, styleKey]);

  if (failure) {
    return (
      <MapUnavailable
        failure={failure}
        center={toLatLng(initialRef.current.center)}
        zoom={initialRef.current.zoom}
        onShowList={onShowList}
        className={className}
      />
    );
  }

  return (
    <div ref={containerRef} className={cn('h-full w-full', className)}>
      {handle && <MapContext.Provider value={handle}>{children}</MapContext.Provider>}
    </div>
  );
}
