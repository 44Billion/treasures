import { useMemo, useState } from "react";
import { useMapHandle } from "./mapContext";
import { MapOverlay } from "./MapOverlay";

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

/** Read the theme colors once, when the control mounts. */
function useThemeColors() {
  return useMemo(() => {
    const root = getComputedStyle(document.documentElement);
    const bg = root.getPropertyValue('--background').trim();
    const accent = root.getPropertyValue('--accent').trim();
    const fg = root.getPropertyValue('--foreground').trim();
    return {
      background: bg ? `hsl(${bg} / 0.9)` : 'rgba(255, 255, 255, 0.9)',
      accentBackground: accent ? `hsl(${accent})` : 'rgba(240, 240, 240, 1)',
      foreground: fg ? `hsl(${fg})` : '#374151',
    };
  }, []);
}

function ZoomButton({
  label,
  symbol,
  className,
  position,
  onClick,
}: {
  label: string;
  symbol: string;
  className: string;
  position: 'top' | 'bottom';
  onClick: () => void;
}) {
  const colors = useThemeColors();
  const [hovered, setHovered] = useState(false);
  const radius = '0.375rem';

  return (
    <button
      type="button"
      aria-label={label}
      className={`zoom-btn ${className}`}
      onClick={onClick}
      onMouseOver={() => setHovered(true)}
      onMouseOut={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 40,
        height: 40,
        background: hovered ? colors.accentBackground : colors.background,
        border: '1px solid hsl(var(--border))',
        borderBottom: position === 'top' ? 'none' : undefined,
        color: colors.foreground,
        fontSize: 18,
        fontWeight: 500,
        lineHeight: 1,
        cursor: 'pointer',
        borderTopLeftRadius: position === 'top' ? radius : undefined,
        borderTopRightRadius: position === 'top' ? radius : undefined,
        borderBottomLeftRadius: position === 'bottom' ? radius : undefined,
        borderBottomRightRadius: position === 'bottom' ? radius : undefined,
        transition: 'all 0.2s ease',
        backdropFilter: 'blur(8px)',
      }}
    >
      {symbol}
    </button>
  );
}

/**
 * Shared themed zoom control for maps.
 *
 * Renders a +/- button stack at the lower-left of the map container,
 * styled with the app's theme tokens (`--background`, `--foreground`,
 * `--accent`, `--border`), so every map in the app looks consistent
 * across themes.
 */
export function CustomZoomControl({
  bottomOffset = 16,
  leftOffset = 10,
  zIndex = 1000,
  respectSafeArea = true,
}: CustomZoomControlProps = {}) {
  const map = useMapHandle();
  const bottom = respectSafeArea
    ? `calc(${bottomOffset}px + env(safe-area-inset-bottom, 0px))`
    : `${bottomOffset}px`;

  return (
    <MapOverlay className="custom-zoom-control" style={{ bottom, left: leftOffset, zIndex }}>
      <ZoomButton label="Zoom in" symbol="+" className="zoom-in-btn" position="top" onClick={() => map.zoomIn()} />
      <ZoomButton label="Zoom out" symbol="−" className="zoom-out-btn" position="bottom" onClick={() => map.zoomOut()} />
    </MapOverlay>
  );
}

export default CustomZoomControl;
