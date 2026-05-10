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
      //    platform, so we explicitly check.
      try {
        const launch = await App.getLaunchUrl();
        const route = launch?.url ? deepLinkToRoute(launch.url) : null;
        if (route && !cancelled) {
          navigate(route, { replace: true });
        }
      } catch {
        // getLaunchUrl can throw on platforms where it isn't supported;
        // a missing launch URL just means we have nothing to do here.
      }

      if (cancelled) return;

      // 2. Warm-start: app was already running when the link was opened.
      const handle = await App.addListener('appUrlOpen', ({ url }) => {
        const route = deepLinkToRoute(url);
        if (route) {
          navigate(route);
        }
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
