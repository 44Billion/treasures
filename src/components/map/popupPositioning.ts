/**
 * React-content map popups, plus auto-pan math aware of the app's floating
 * UI overlays (search bar, zoom/style controls, near-me button).
 */

import type { LatLng, MapHandle, MapPopupRef } from "./mapHandle";

/**
 * Calculate autopan padding that accounts for floating UI elements
 * (search bar at top, zoom/style controls at left, near-me button at right).
 * Returns {top, left, bottom, right} pixel padding for the map viewport.
 */
export function getPopupAutoPanPadding(map: MapHandle): { top: number; left: number; bottom: number; right: number } {
  const container = map.getContainer();
  const containerRect = container.getBoundingClientRect();

  // Default safe padding
  let top = 20;
  let left = 20;
  let bottom = 20;
  let right = 20;

  // Detect floating search bar at top of map (mobile map view).
  // The bar sits inside the parent .relative wrapper at `top-3` (`top: 0.75rem`).
  const floatingSearch = container.closest('.relative')?.querySelector('[class*="absolute"][class*="top-3"]') as HTMLElement;
  if (floatingSearch) {
    const searchRect = floatingSearch.getBoundingClientRect();
    // How far the search bar's bottom edge extends below the map container's top
    const searchBottom = searchRect.bottom - containerRect.top;
    if (searchBottom > 0) {
      top = Math.max(top, searchBottom + 12); // 12px breathing room
    }
  }

  // On desktop, the sidebar search isn't overlaid but the header might be.
  // Desktop header is separate (DesktopHeader) and outside the map container,
  // so no extra top padding needed for it.

  // Detect zoom control at bottom-left
  const zoomControl = container.querySelector('.custom-zoom-control') as HTMLElement;
  if (zoomControl) {
    const zoomRect = zoomControl.getBoundingClientRect();
    const zoomRight = zoomRect.right - containerRect.left;
    if (zoomRight > 0) {
      left = Math.max(left, zoomRight + 10);
    }
    // Bottom padding = distance from container bottom to top of zoom control + breathing room
    const zoomDistFromBottom = containerRect.bottom - zoomRect.top;
    if (zoomDistFromBottom > 0) {
      bottom = Math.max(bottom, zoomDistFromBottom + 10);
    }
  }

  // Detect map style control above zoom (also bottom-left)
  const styleControl = container.querySelector('.map-style-control-container') as HTMLElement;
  if (styleControl) {
    const styleRect = styleControl.getBoundingClientRect();
    const styleRight = styleRect.right - containerRect.left;
    if (styleRight > 0) {
      left = Math.max(left, styleRight + 10);
    }
    // The style control is above the zoom; its top edge is further up
    const styleDistFromBottom = containerRect.bottom - styleRect.top;
    if (styleDistFromBottom > bottom) {
      bottom = Math.max(bottom, styleDistFromBottom + 10);
    }
  }

  // Detect near-me button at bottom-right
  const nearMe = container.querySelector('.near-me-button-container') as HTMLElement;
  if (nearMe) {
    const nearMeRect = nearMe.getBoundingClientRect();
    const nearMeDistFromRight = containerRect.right - nearMeRect.left;
    if (nearMeDistFromRight > 0) {
      right = Math.max(right, nearMeDistFromRight + 10);
    }
    // Also protect bottom-right area
    const nearMeDistFromBottom = containerRect.bottom - nearMeRect.top;
    if (nearMeDistFromBottom > 0) {
      bottom = Math.max(bottom, nearMeDistFromBottom + 10);
    }
  }

  return { top, left, bottom, right };
}

/**
 * Pan the map so a popup is fully visible, respecting UI overlay padding.
 * The popup tip extends ~10px below the popup element, and the marker icon
 * sits below that. We include extra bottom clearance for the tip + marker.
 */
export function panMapForPopup(map: MapHandle, popupEl: HTMLElement) {
  const containerRect = map.getContainer().getBoundingClientRect();
  const popupRect = popupEl.getBoundingClientRect();
  const padding = getPopupAutoPanPadding(map);

  // The popup tip + marker icon (~48px) extend below the popup element.
  // We need the marker anchor point to stay above the bottom controls.
  const tipAndMarkerHeight = 60;

  let dx = 0;
  let dy = 0;

  // Check bottom overflow first (tip + marker must not overlap bottom controls)
  const bottomOverflow = (popupRect.bottom + tipAndMarkerHeight) - (containerRect.bottom - padding.bottom);
  if (bottomOverflow > 0) {
    dy = bottomOverflow; // positive = pan down (moves popup up on screen)
  }

  // Check top overflow (popup content must not hide behind search bar).
  // If we just panned down for bottom overflow, check if top is still visible.
  const topOverflow = (containerRect.top + padding.top) - (popupRect.top - dy);
  if (topOverflow > 0) {
    // Top is clipped. If popup fits in the safe area, prioritize top visibility.
    // If it doesn't fit, show as much from the top as possible.
    dy = dy - topOverflow; // negative adjustment = pan up (moves popup down on screen)
  }

  // Check left overflow
  if (popupRect.left < containerRect.left + padding.left) {
    dx = popupRect.left - (containerRect.left + padding.left);
  }
  // Check right overflow
  if (popupRect.right > containerRect.right - padding.right) {
    dx = popupRect.right - (containerRect.right - padding.right);
  }

  if (dx !== 0 || dy !== 0) {
    map.panBy([dx, dy], { duration: 0.3 });
  }
}

export interface ReactPopupOptions {
  position: LatLng;
  /**
   * Popup attachment point relative to the marker anchor, in pixels
   * (a `MapIcon.popupAnchor`) — negative y lifts the popup above the icon.
   */
  anchor?: [number, number];
  maxWidth?: number;
  /** Fired whenever the popup closes (outside click, Escape, replaced, map teardown) */
  onClose?: () => void;
}

// One pending popup per map: opening a new popup aborts a previous one that
// is still waiting for its React content.
const pendingOpens = new WeakMap<MapHandle, () => void>();

/**
 * Create a popup whose content React will portal into `container`, and open
 * it once that content has rendered (so it's measured and positioned with
 * its real size), then pan the map to keep it clear of the floating UI.
 *
 * Returns the container to hand to React. Closes any open popup first.
 */
export function openReactPopup(map: MapHandle, options: ReactPopupOptions): { container: HTMLDivElement; popup: MapPopupRef } {
  pendingOpens.get(map)?.();
  map.closePopup();

  const container = document.createElement('div');
  container.className = 'react-popup-root';

  let cancel = () => {};

  // Leaflet's default 7px popup offset sat the tip slightly over the icon top;
  // keep that so popups land where they always have.
  const [anchorX, anchorY] = options.anchor ?? [0, 0];
  const popup = map.createPopup({
    position: options.position,
    content: container,
    offset: [anchorX, anchorY + 7],
    maxWidth: options.maxWidth ?? 400,
    className: 'geocache-popup react-popup',
    onClose: () => {
      cancel();
      options.onClose?.();
    },
  });

  let observer: MutationObserver | null = null;
  let fallbackTimer: ReturnType<typeof setTimeout> | null = null;
  let panTimer: ReturnType<typeof setTimeout> | null = null;
  let aborted = false;
  let opened = false;

  cancel = () => {
    aborted = true;
    if (observer) { observer.disconnect(); observer = null; }
    if (fallbackTimer) { clearTimeout(fallbackTimer); fallbackTimer = null; }
    if (panTimer) { clearTimeout(panTimer); panTimer = null; }
    if (pendingOpens.get(map) === cancel) pendingOpens.delete(map);
  };

  const doOpen = () => {
    if (opened || aborted) return;
    opened = true;
    if (observer) { observer.disconnect(); observer = null; }
    if (fallbackTimer) { clearTimeout(fallbackTimer); fallbackTimer = null; }

    popup.open();

    // After the popup is open and painted, pan to ensure it's fully visible.
    // Two rAFs wait for layout + paint.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (aborted) return;
        panTimer = setTimeout(() => {
          pendingOpens.delete(map);
          const el = popup.getElement();
          if (el && popup.isOpen()) {
            panMapForPopup(map, el);
          }
        }, 60);
      });
    });
  };

  // Watch for React to render content into the container
  observer = new MutationObserver(() => {
    if (container.childNodes.length > 0) doOpen();
  });
  observer.observe(container, { childList: true, subtree: true });

  // Safety fallback: if React doesn't render within 800ms, open anyway
  fallbackTimer = setTimeout(doOpen, 800);

  pendingOpens.set(map, cancel);

  return { container, popup };
}
