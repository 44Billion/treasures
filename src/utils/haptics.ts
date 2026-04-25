/**
 * Haptic feedback utility for mobile devices.
 * Uses the Vibration API (navigator.vibrate) which is supported on
 * Android Chrome, Samsung Internet, and other mobile browsers.
 * iOS Safari does NOT support the Vibration API — haptics silently no-op there.
 *
 * Vibration patterns are specified in milliseconds: [vibrate, pause, vibrate, ...]
 */

function vibrate(pattern: number | number[]): void {
  if (navigator.vibrate) navigator.vibrate(pattern);
}

// ── Feedback levels ─────────────────────────────────────────────

/** Subtle tap for selections, toggles, tab switches (10ms) */
export function hapticLight(): void {
  vibrate(10);
}

/** Standard tap for button presses, confirmations (25ms) */
export function hapticMedium(): void {
  vibrate(25);
}

/** Strong tap for important actions — publish, pay, delete confirm (40ms) */
export function hapticHeavy(): void {
  vibrate(40);
}

/** Success pattern — double pulse (25ms on, 60ms off, 25ms on) */
export function hapticSuccess(): void {
  vibrate([25, 60, 25]);
}

/** Error / warning pattern — three short sharp pulses */
export function hapticError(): void {
  vibrate([30, 40, 30, 40, 30]);
}

/** Selection change — very brief tick for radio/toggle group items (8ms) */
export function hapticSelection(): void {
  vibrate(8);
}

// ── Compass-specific patterns ───────────────────────────────────

/** Compass activated / GPS lock acquired */
export function hapticCompassActivated(): void {
  vibrate([15, 50, 15]);
}

/** Proximity threshold crossed (getting closer) — single firm pulse */
export function hapticProximityThreshold(): void {
  vibrate(30);
}

/** Treasure nearby! (≤10m) — celebratory triple pulse */
export function hapticTreasureNearby(): void {
  vibrate([40, 80, 40, 80, 40]);
}

/** Radar blip tap-to-lock */
export function hapticBlipLock(): void {
  vibrate([12, 40, 20]);
}
