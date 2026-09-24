/**
 * Builds marker DOM elements from `MapIcon` descriptors. Both map
 * implementations position the same element, so markers look and behave
 * identically on the vector map and the raster fallback.
 */

import type { MapIcon } from '@/utils/mapIcons';
import type { MarkerOptions } from './mapHandle';

export function createMarkerElement(icon: MapIcon, options: MarkerOptions = {}): HTMLDivElement {
  const { title, alt, interactive = true, onClick } = options;

  const el = document.createElement('div');
  el.className = icon.className;
  el.style.width = `${icon.iconSize[0]}px`;
  el.style.height = `${icon.iconSize[1]}px`;
  el.innerHTML = icon.html;

  if (interactive) {
    if (title) el.title = title;
    const label = alt ?? title;
    if (label) el.setAttribute('aria-label', label);
    el.setAttribute('role', 'button');
    el.tabIndex = 0;
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      onClick?.();
    });
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        onClick?.();
      }
    });
  } else {
    el.style.pointerEvents = 'none';
  }

  return el;
}

const clusterIconCache = new Map<number, MapIcon>();

/** Round count badge for a cluster of `count` markers (styled in map-features.css). */
export function getClusterIcon(count: number): MapIcon {
  const cached = clusterIconCache.get(count);
  if (cached) return cached;

  const size = count < 10 ? 'small' : count < 100 ? 'medium' : 'large';
  const px = size === 'large' ? 50 : size === 'medium' ? 42 : 36;
  const icon: MapIcon = {
    html: `<div class="cluster-marker cluster-${size}"><span>${count}</span></div>`,
    className: 'custom-cluster-icon',
    iconSize: [px, px],
    iconAnchor: [px / 2, px / 2],
  };
  clusterIconCache.set(count, icon);
  return icon;
}
