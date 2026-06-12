/**
 * Popup positioning utilities for Leaflet maps.
 *
 * Extracted from GeocacheMap so popup auto-pan math (aware of the app's
 * floating UI overlays) can be reasoned about and tested independently.
 */

import L from "leaflet";

/**
 * Calculate autopan padding that accounts for floating UI elements
 * (search bar at top, zoom/style controls at left, near-me button at right).
 * Returns {top, left, bottom, right} pixel padding for the map viewport.
 */
export function getPopupAutoPanPadding(map: L.Map): { top: number; left: number; bottom: number; right: number } {
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
 * The popup tip extends ~12px below the popup element, and the marker icon
 * sits below that. We include extra bottom clearance for the tip + marker.
 */
export function panMapForPopup(map: L.Map, popup: L.Popup) {
  const popupEl = popup.getElement();
  if (!popupEl) return;

  const containerRect = map.getContainer().getBoundingClientRect();
  const popupRect = popupEl.getBoundingClientRect();
  const padding = getPopupAutoPanPadding(map);

  // The popup tip (~12px) + marker icon (~48px) extend below the popup element.
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
    map.panBy([dx, dy], { animate: true, duration: 0.3 });
  }
}

/**
 * Open a Leaflet popup on a marker after React renders content into a container.
 * Uses a MutationObserver with a single fallback. Returns a cleanup function.
 */
export function openPopupWhenReady(
  marker: L.Marker,
  container: HTMLDivElement,
  map: L.Map,
  abortSignal: { aborted: boolean },
): () => void {
  let observer: MutationObserver | null = null;
  let fallbackTimer: ReturnType<typeof setTimeout> | null = null;
  let panTimer: ReturnType<typeof setTimeout> | null = null;
  let opened = false;

  const doOpen = () => {
    if (opened || abortSignal.aborted) return;
    opened = true;

    // Disconnect observer and clear fallback
    if (observer) { observer.disconnect(); observer = null; }
    if (fallbackTimer) { clearTimeout(fallbackTimer); fallbackTimer = null; }

    if (!marker.isPopupOpen()) {
      marker.openPopup();
    }

    // After popup is open and painted, pan to ensure it's fully visible
    // Use two rAF to wait for layout + paint
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (abortSignal.aborted) return;
        panTimer = setTimeout(() => {
          const popup = marker.getPopup();
          if (popup && map.hasLayer(popup)) {
            panMapForPopup(map, popup);
          }
        }, 60);
      });
    });
  };

  // Watch for React to render content into the container
  observer = new MutationObserver(() => {
    if (container.childNodes.length > 0) {
      doOpen();
    }
  });
  observer.observe(container, { childList: true, subtree: true });

  // If content is already there (unlikely but safe)
  if (container.childNodes.length > 0) {
    doOpen();
  }

  // Safety fallback: if React doesn't render within 800ms, open anyway
  fallbackTimer = setTimeout(() => {
    doOpen();
  }, 800);

  return () => {
    abortSignal.aborted = true;
    if (observer) { observer.disconnect(); observer = null; }
    if (fallbackTimer) { clearTimeout(fallbackTimer); fallbackTimer = null; }
    if (panTimer) { clearTimeout(panTimer); panTimer = null; }
  };
}
