/**
 * Returns the canonical app origin (https://treasures.to) for use in
 * shareable URLs, QR codes, etc.
 *
 * On Android/iOS Capacitor builds the WebView runs under a synthetic
 * origin (e.g. "https://localhost" or "capacitor://localhost"), so
 * window.location.origin would produce broken share links.  We detect
 * the native context via Capacitor and always return the production URL.
 */

import { Capacitor } from '@capacitor/core';

const PRODUCTION_ORIGIN = 'https://treasures.to';

/**
 * Returns the canonical HTTPS origin for the app.
 * - On native (Android / iOS) Capacitor builds: always 'https://treasures.to'
 * - In a browser: uses window.location.origin (supports local dev / staging)
 */
export function getAppOrigin(): string {
  if (Capacitor.isNativePlatform()) {
    return PRODUCTION_ORIGIN;
  }
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return PRODUCTION_ORIGIN;
}
