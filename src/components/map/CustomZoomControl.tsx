import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";

interface CustomZoomControlProps {
  /**
   * Distance from the bottom of the map container, in pixels.
   * The component automatically adds `env(safe-area-inset-bottom, 0px)`
   * unless `respectSafeArea` is set to `false`.
   * @default 16
   */
  bottomOffset?: number;
  /**
   * Distance from the left of the map container, in pixels.
   * @default 10
   */
  leftOffset?: number;
  /**
   * z-index for the control container.
   * @default 1000
   */
  zIndex?: number;
  /**
   * When `true`, adds `env(safe-area-inset-bottom, 0px)` to `bottomOffset`.
   * Disable for embedded maps where the OS safe area should not apply.
   * @default true
   */
  respectSafeArea?: boolean;
}

/**
 * Shared themed zoom control for Leaflet maps.
 *
 * Renders a +/- button stack at the lower-left of the map container,
 * styled with the app's theme tokens (`--background`, `--foreground`,
 * `--accent`, `--border`). Use this in place of Leaflet's default
 * `Control.Zoom` so every map in the app looks consistent across themes.
 *
 * Set `zoomControl={false}` on the parent `<MapContainer>` to avoid
 * duplicating the default Leaflet control.
 */
export function CustomZoomControl({
  bottomOffset = 16,
  leftOffset = 10,
  zIndex = 1000,
  respectSafeArea = true,
}: CustomZoomControlProps = {}) {
  const map = useMap();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isInitializedRef = useRef(false);

  useEffect(() => {
    if (isInitializedRef.current) return;

    const mapContainer = map.getContainer();

    // Create container div for the zoom control
    const container = document.createElement('div');
    container.className = 'custom-zoom-control';
    const bottomCss = respectSafeArea
      ? `calc(${bottomOffset}px + env(safe-area-inset-bottom, 0px))`
      : `${bottomOffset}px`;
    container.style.cssText = `
      position: absolute;
      bottom: ${bottomCss};
      left: ${leftOffset}px;
      z-index: ${zIndex};
      pointer-events: auto;
    `;

    // Pull theme colors from CSS variables so the control matches the
    // current app theme (light, dark, adventure, mojave, ditto, ...).
    const bgColor = getComputedStyle(document.documentElement).getPropertyValue('--background').trim();
    const backgroundColor = bgColor ? `hsl(${bgColor} / 0.9)` : 'rgba(255, 255, 255, 0.9)';

    const accentColor = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
    const accentBgColor = accentColor ? `hsl(${accentColor})` : 'rgba(240, 240, 240, 1)';

    const fgColor = getComputedStyle(document.documentElement).getPropertyValue('--foreground').trim();
    const foregroundColor = fgColor ? `hsl(${fgColor})` : '#374151';

    // Create zoom in button
    const zoomInBtn = document.createElement('button');
    zoomInBtn.type = 'button';
    zoomInBtn.innerHTML = '+';
    zoomInBtn.setAttribute('aria-label', 'Zoom in');
    zoomInBtn.className = 'zoom-btn zoom-in-btn';
    zoomInBtn.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      background: ${backgroundColor};
      border: 1px solid hsl(var(--border));
      border-bottom: none;
      color: ${foregroundColor};
      font-size: 18px;
      font-weight: 500;
      line-height: 1;
      cursor: pointer;
      border-top-left-radius: 0.375rem;
      border-top-right-radius: 0.375rem;
      transition: all 0.2s ease;
      backdrop-filter: blur(8px);
    `;
    zoomInBtn.onmouseover = () => {
      zoomInBtn.style.background = accentBgColor;
    };
    zoomInBtn.onmouseout = () => {
      zoomInBtn.style.background = backgroundColor;
    };
    zoomInBtn.onclick = () => {
      map.zoomIn();
    };

    // Create zoom out button
    const zoomOutBtn = document.createElement('button');
    zoomOutBtn.type = 'button';
    zoomOutBtn.innerHTML = '−';
    zoomOutBtn.setAttribute('aria-label', 'Zoom out');
    zoomOutBtn.className = 'zoom-btn zoom-out-btn';
    zoomOutBtn.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      background: ${backgroundColor};
      border: 1px solid hsl(var(--border));
      color: ${foregroundColor};
      font-size: 18px;
      font-weight: 500;
      line-height: 1;
      cursor: pointer;
      border-bottom-left-radius: 0.375rem;
      border-bottom-right-radius: 0.375rem;
      transition: all 0.2s ease;
      backdrop-filter: blur(8px);
    `;
    zoomOutBtn.onmouseover = () => {
      zoomOutBtn.style.background = accentBgColor;
    };
    zoomOutBtn.onmouseout = () => {
      zoomOutBtn.style.background = backgroundColor;
    };
    zoomOutBtn.onclick = () => {
      map.zoomOut();
    };

    container.appendChild(zoomInBtn);
    container.appendChild(zoomOutBtn);

    mapContainer.appendChild(container);
    containerRef.current = container;
    isInitializedRef.current = true;

    const currentContainer = container;
    return () => {
      if (currentContainer.parentNode) {
        currentContainer.parentNode.removeChild(currentContainer);
      }
      isInitializedRef.current = false;
    };
  }, [map, bottomOffset, leftOffset, zIndex, respectSafeArea]);

  return null;
}

export default CustomZoomControl;
