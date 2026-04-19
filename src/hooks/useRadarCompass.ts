import { useMemo } from 'react';
import { useCompass, formatCompassDistance, getBearingLabel } from './useCompass';
import type { Geocache } from '@/types/geocache';

export interface RadarTarget {
  geocache: Geocache;
  /** Absolute bearing from user to target (0-360, 0 = North) */
  bearing: number;
  /** Distance from user to target in meters */
  distance: number;
}

/**
 * Calculate the initial bearing from point A to point B.
 * Returns degrees (0-360, 0 = North, clockwise).
 */
function calculateBearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => deg * (Math.PI / 180);
  const toDeg = (rad: number) => rad * (180 / Math.PI);

  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);
  const deltaLambda = toRad(lng2 - lng1);

  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) -
            Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);

  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/**
 * Calculate Haversine distance between two points in meters.
 */
function calculateDistanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (deg: number) => deg * (Math.PI / 180);

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Compute the N nearest geocaches to a position, with bearing and distance.
 * Returns targets sorted by distance (nearest first).
 */
export function computeNearbyTargets(
  userLat: number,
  userLng: number,
  geocaches: Geocache[],
  maxTargets: number = 6,
): RadarTarget[] {
  return geocaches
    .filter(g => g.location && isFinite(g.location.lat) && isFinite(g.location.lng))
    .map(g => ({
      geocache: g,
      bearing: calculateBearing(userLat, userLng, g.location.lat, g.location.lng),
      distance: calculateDistanceMeters(userLat, userLng, g.location.lat, g.location.lng),
    }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, maxTargets);
}

/**
 * Hook that provides a compass pointing to the nearest geocache,
 * plus radar blips for surrounding nearby caches.
 *
 * The gem pointer tracks the closest treasure.
 * Radar blips are positioned around the compass perimeter based on bearing.
 */
export function useRadarCompass(geocaches: Geocache[], maxTargets: number = 6) {
  // Start with null target — will be set to nearest once tracking begins
  // The compass manages its own GPS + device orientation internally.
  // We pass null initially, and once we get a position, we'll know the nearest.
  // But useCompass needs a target up front to compute bearing…
  //
  // The trick: we drive useCompass with the nearest geocache as target.
  // On first render we pick the nearest from available geocaches (which may
  // have pre-computed distances from the map's proximity search).
  // As the user walks, useCompass's internal GPS will update, but the target
  // stays the same until the component re-renders with new nearest.

  // Find the nearest geocache by pre-computed distance (if available from
  // the proximity search), otherwise just pick the first one.
  const nearestTarget = useMemo(() => {
    if (geocaches.length === 0) return null;

    // If geocaches have distances pre-computed, use the nearest
    const withDistance = geocaches.filter(
      (g): g is Geocache & { distance: number } =>
        typeof (g as unknown as { distance?: number }).distance === 'number'
    );

    if (withDistance.length > 0) {
      const nearest = withDistance.reduce((a, b) => a.distance < b.distance ? a : b);
      return nearest.location;
    }

    // Fallback: just use the first geocache
    return geocaches[0]?.location ?? null;
  }, [geocaches]);

  const compass = useCompass(nearestTarget);

  return {
    compass,
    nearestTarget,
    /** Total geocaches available for radar */
    geocacheCount: geocaches.length,
    maxTargets,
  };
}

export { formatCompassDistance, getBearingLabel };
