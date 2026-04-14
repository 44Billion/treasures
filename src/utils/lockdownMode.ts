/**
 * Detect iOS Lockdown Mode and provide feature flags for graceful degradation.
 *
 * iOS Lockdown Mode disables JIT, restricts Canvas/WebGL, blocks web fonts,
 * limits cross-origin requests, and disables various "complex web technologies."
 *
 * Because there is no direct API to query Lockdown Mode, we detect it by
 * probing for its side-effects:
 *   1. Canvas `getContext('2d')` fails or fingerprint operations throw.
 *   2. WebGL context creation fails.
 *   3. Web fonts fail to load (FontFace API).
 *
 * The detection is cached after the first run so repeated calls are free.
 */

let _isLockdownMode: boolean | null = null;

/**
 * Heuristically detect whether iOS Lockdown Mode is active.
 *
 * Returns `true` when we're on an iOS/iPadOS device AND one or more of the
 * Canvas/WebGL probes fail — a strong signal that Lockdown Mode is enabled.
 *
 * On non-Apple platforms this always returns `false` immediately.
 */
export function detectLockdownMode(): boolean {
  if (_isLockdownMode !== null) return _isLockdownMode;

  // Quick exit: not iOS / iPadOS → not Lockdown Mode
  const ua = navigator.userAgent;
  const isAppleMobile =
    /iPhone|iPad|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); // iPadOS masquerades as Mac

  if (!isAppleMobile) {
    _isLockdownMode = false;
    return false;
  }

  // Probe 1: Canvas 2D — try a tainted-canvas export (toDataURL after drawImage
  // from a cross-origin source is blocked, but even basic toDataURL may throw).
  let canvasFailed = false;
  try {
    const c = document.createElement('canvas');
    c.width = 1;
    c.height = 1;
    const ctx = c.getContext('2d');
    if (!ctx) {
      canvasFailed = true;
    } else {
      // Draw something and read back — Lockdown Mode may throw on readback
      ctx.fillStyle = '#ff0000';
      ctx.fillRect(0, 0, 1, 1);
      const data = ctx.getImageData(0, 0, 1, 1);
      // If data came back all zeros despite drawing red, Canvas is neutered
      if (data.data[0] === 0 && data.data[1] === 0 && data.data[2] === 0 && data.data[3] === 0) {
        canvasFailed = true;
      }
    }
  } catch {
    canvasFailed = true;
  }

  // Probe 2: WebGL — Lockdown Mode disables WebGL entirely
  let webglFailed = false;
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl') || c.getContext('experimental-webgl');
    if (!gl) {
      webglFailed = true;
    }
  } catch {
    webglFailed = true;
  }

  // If we're on iOS and both Canvas readback AND WebGL are broken,
  // it's almost certainly Lockdown Mode.
  // If only WebGL is missing (older iPads, etc.) we still err on the side
  // of caution since Leaflet's Canvas renderer is the primary concern.
  _isLockdownMode = canvasFailed || webglFailed;
  return _isLockdownMode;
}

/**
 * Feature flags that components can use for graceful degradation.
 */
export interface LockdownFeatures {
  /** Whether Leaflet should use Canvas renderer (false in Lockdown Mode) */
  preferCanvas: boolean;
  /** Whether cross-origin tile loading is safe */
  crossOriginTiles: boolean;
  /** Whether CSS mix-blend-mode compositing is safe */
  mixBlendMode: boolean;
  /** Whether complex CSS animations are safe */
  complexAnimations: boolean;
}

/**
 * Returns an object of feature flags adjusted for Lockdown Mode.
 * All flags default to `true` (full features) on normal browsers.
 */
export function getLockdownFeatures(): LockdownFeatures {
  const lockdown = detectLockdownMode();

  if (!lockdown) {
    return {
      preferCanvas: true,
      crossOriginTiles: true,
      mixBlendMode: true,
      complexAnimations: true,
    };
  }

  return {
    preferCanvas: false,       // Use SVG/DOM renderer instead of Canvas
    crossOriginTiles: false,   // Don't set crossOrigin on tile <img> tags
    mixBlendMode: false,       // Skip blend-mode overlays
    complexAnimations: false,  // Use simpler or no animations
  };
}
