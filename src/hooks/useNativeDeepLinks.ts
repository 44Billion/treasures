import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';

/**
 * Hosts whose URLs should be treated as in-app routes when the OS opens
 * one of our deep links. The Capacitor WebView serves the bundled assets
 * from `https://localhost`, so without this handler the WebView either
 * stays on whatever page was last shown or ends up trying to load the
 * external URL and failing.
 *
 * We strip these origins and re-route via react-router so the in-app
 * page (and any URL hash like `#verify=<nsec>` for claim URLs, or
 * search params like `?claimUrl=...`) is preserved exactly.
 */
const HANDLED_HOSTS = new Set([
  'treasures.to',
  'www.treasures.to',
  // Capacitor's own origin — listed for completeness, but stripping it
  // is harmless since the path/search/hash already match in-app routes.
  'localhost',
]);

/**
 * Convert an absolute URL coming from a native deep link into the
 * relative path+search+hash we can hand to react-router.
 *
 * Returns `null` if the URL is for a host we don't own (e.g. a
 * lightning invoice URL or an external link) so the caller can ignore
 * it.
 */
export function deepLinkToRoute(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  if (!HANDLED_HOSTS.has(parsed.hostname)) {
    return null;
  }

  // Preserve everything after the origin verbatim so claim URLs
  // (`/<naddr>#verify=<nsec>`) and the create flow's
  // (`/create-cache?claimUrl=...`) keep working.
  const path = parsed.pathname || '/';
  return `${path}${parsed.search}${parsed.hash}`;
}

/**
 * Module-level guard so the cold-start launch URL is only ever
 * processed once per app process. Without this, anything that causes
 * the bridge component to remount — a route change, a hot-reload, the
 * WebView being recreated by Android after backgrounding — would call
 * `App.getLaunchUrl()` again, which keeps returning the same URL and
 * yanks the user back to the claim screen they were trying to leave.
 */
let launchUrlConsumed = false;

/**
 * Tracks recently processed warm-start URLs so a single tap that
 * delivers duplicate `appUrlOpen` events (some Android launchers do
 * this) only navigates once.
 */
let lastWarmStartUrl: string | null = null;
let lastWarmStartAt = 0;

/**
 * Compare the route we're about to navigate to against the current
 * location. If they already match we skip the navigation entirely so
 * the user's current page state (form input, scroll position, etc.) is
 * preserved.
 */
function isAlreadyAtRoute(route: string): boolean {
  const current =
    window.location.pathname + window.location.search + window.location.hash;
  return current === route;
}

/**
 * Wires up Capacitor's `appUrlOpen` event so that opening a
 * `https://treasures.to/...` link on Android (or iOS, when configured)
 * navigates to the matching in-app screen.
 *
 * Must be rendered inside a `<BrowserRouter>` (uses `useNavigate`).
 *
 * No-ops on the web.
 */
export function useNativeDeepLinks(): void {
  const navigate = useNavigate();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let cleanup: (() => void) | undefined;
    let cancelled = false;

    (async () => {
      const { App } = await import('@capacitor/app');

      // 1. Cold-start: the app was launched *because* of the deep link.
      //    Capacitor doesn't fire appUrlOpen for the launch URL on every
      //    platform, so we explicitly check. We only do this once per
      //    process — see `launchUrlConsumed` above for why.
      if (!launchUrlConsumed) {
        launchUrlConsumed = true;
        try {
          const launch = await App.getLaunchUrl();
          const route = launch?.url ? deepLinkToRoute(launch.url) : null;
          if (route && !cancelled && !isAlreadyAtRoute(route)) {
            navigate(route, { replace: true });
          }
        } catch {
          // getLaunchUrl can throw on platforms where it isn't supported;
          // a missing launch URL just means we have nothing to do here.
        }
      }

      if (cancelled) return;

      // 2. Warm-start: app was already running when the link was opened.
      const handle = await App.addListener('appUrlOpen', ({ url }) => {
        const route = deepLinkToRoute(url);
        if (!route) return;

        // Drop obvious duplicate fires (same URL within 1s).
        const now = Date.now();
        if (lastWarmStartUrl === url && now - lastWarmStartAt < 1000) {
          return;
        }
        lastWarmStartUrl = url;
        lastWarmStartAt = now;

        // Don't yank the user away from a screen that already matches
        // the deep link — they may have navigated forward from it
        // (e.g. from `/<naddr>#verify=…` into `/create-cache?claimUrl=…`).
        if (isAlreadyAtRoute(route)) return;

        navigate(route);
      });

      cleanup = () => {
        handle.remove();
      };
    })();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [navigate]);
}
