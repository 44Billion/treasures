/**
 * Clustered HTML markers.
 *
 * Supercluster runs with a 256px tile extent so its zoom levels and pixel
 * radius line up with the app's 256px-tile zoom units (see mapHandle.ts).
 * Markers are diffed by id on every zoom change, so a marker that stays
 * visible keeps its DOM element.
 */

import { useEffect, useMemo, useRef } from 'react';
import Supercluster from 'supercluster';
import type { MapIcon } from '@/utils/mapIcons';
import { useMapHandle } from './mapContext';
import type { MapMarkerRef } from './mapHandle';
import { getClusterIcon } from './mapMarkers';

export interface ClusterPoint {
  id: string;
  lat: number;
  lng: number;
  icon: MapIcon;
  title?: string;
  alt?: string;
}

interface ClusteredMarkersProps {
  points: ClusterPoint[];
  onPointClick: (point: ClusterPoint) => void;
  /** Cluster radius in screen pixels */
  radius?: number;
  /** Zoom level at and above which every point is shown individually */
  disableClusteringAtZoom?: number;
  /** Clicking a cluster never zooms past this */
  maxZoom?: number;
}

interface RenderedMarker {
  marker: MapMarkerRef;
  point?: ClusterPoint;
}

// The whole world: markers aren't culled to the viewport (at most a few
// hundred are shown) so panning never has to wait for a re-cluster.
const WORLD_BBOX: [number, number, number, number] = [-180, -85, 180, 85];

export function ClusteredMarkers({
  points,
  onPointClick,
  radius = 22,
  disableClusteringAtZoom = 14,
  maxZoom = 21,
}: ClusteredMarkersProps) {
  const map = useMapHandle();
  const renderedRef = useRef(new Map<string, RenderedMarker>());
  const onPointClickRef = useRef(onPointClick);
  onPointClickRef.current = onPointClick;

  const pointsById = useMemo(() => new Map(points.map(p => [p.id, p])), [points]);

  const index = useMemo(() => {
    const cluster = new Supercluster<{ id: string }>({
      radius,
      extent: 256,
      maxZoom: disableClusteringAtZoom - 1,
    });
    cluster.load(points.map(p => ({
      type: 'Feature' as const,
      properties: { id: p.id },
      geometry: { type: 'Point' as const, coordinates: [p.lng, p.lat] },
    })));
    return cluster;
  }, [points, radius, disableClusteringAtZoom]);

  useEffect(() => {
    const rendered = renderedRef.current;

    const render = () => {
      const zoom = Math.floor(map.getZoom());
      const visible = new Set<string>();

      for (const feature of index.getClusters(WORLD_BBOX, zoom)) {
        const [lng, lat] = feature.geometry.coordinates as [number, number];
        const props = feature.properties;

        if ('cluster' in props && props.cluster) {
          const count = props.point_count;
          // Cluster ids encode their zoom level, so they're unique across zooms.
          const key = `cluster:${props.cluster_id}:${count}`;
          visible.add(key);
          if (rendered.has(key)) continue;

          const clusterId = props.cluster_id;
          const marker = map.addMarker(getClusterIcon(count), { lat, lng }, {
            title: String(count),
            onClick: () => {
              const expansionZoom = Math.min(index.getClusterExpansionZoom(clusterId), maxZoom);
              map.setView({ lat, lng }, expansionZoom, { animate: true, duration: 0.5 });
            },
          });
          rendered.set(key, { marker });
          continue;
        }

        const point = pointsById.get((props as { id: string }).id);
        if (!point) continue;
        const key = `point:${point.id}`;
        visible.add(key);

        const existing = rendered.get(key);
        if (
          existing?.point &&
          existing.point.icon === point.icon &&
          existing.point.lat === point.lat &&
          existing.point.lng === point.lng &&
          existing.point.title === point.title
        ) {
          existing.point = point;
          continue;
        }
        existing?.marker.remove();

        const marker = map.addMarker(point.icon, { lat: point.lat, lng: point.lng }, {
          title: point.title,
          alt: point.alt,
          onClick: () => {
            const current = rendered.get(key)?.point;
            if (current) onPointClickRef.current(current);
          },
        });
        rendered.set(key, { marker, point });
      }

      for (const [key, entry] of rendered) {
        if (!visible.has(key)) {
          entry.marker.remove();
          rendered.delete(key);
        }
      }
    };

    render();
    map.on('zoomend', render);
    return () => {
      map.off('zoomend', render);
    };
  }, [map, index, pointsById, maxZoom]);

  useEffect(() => {
    const rendered = renderedRef.current;
    return () => {
      for (const entry of rendered.values()) entry.marker.remove();
      rendered.clear();
    };
  }, []);

  return null;
}
