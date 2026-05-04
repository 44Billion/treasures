import { useEffect, useRef } from 'react';
import { useLocation, useNavigationType, NavigationType } from 'react-router-dom';

/**
 * Scroll management component.
 *
 * Behaviour:
 * - On PUSH/REPLACE navigation (forward / new page): scroll to top.
 * - On POP (browser back/forward): restore the scroll position that was
 *   recorded when the user left that location.
 * - Hash-only changes are left to the browser.
 *
 * Positions are keyed by `location.key` in sessionStorage so they survive
 * soft reloads within the same tab.
 */
export function ScrollToTop() {
  const { pathname, hash, key } = useLocation();
  const navigationType = useNavigationType();
  const previousKeyRef = useRef<string | null>(null);

  useEffect(() => {
    // Before navigating away from the previous location, record its scroll.
    const prevKey = previousKeyRef.current;
    if (prevKey) {
      try {
        sessionStorage.setItem(
          `scroll:${prevKey}`,
          String(window.scrollY || 0)
        );
      } catch {
        // sessionStorage may be unavailable (private mode, etc.) — ignore.
      }
    }
    previousKeyRef.current = key ?? null;

    // Let the browser handle same-page hash navigation.
    if (hash) {
      return;
    }

    const isPop = navigationType === NavigationType.Pop;

    if (isPop) {
      // Restore previous scroll position on back/forward navigation.
      let savedY = 0;
      try {
        const raw = sessionStorage.getItem(`scroll:${key}`);
        if (raw) savedY = parseInt(raw, 10) || 0;
      } catch {
        // ignore
      }
      // Defer to allow the page to render before scrolling.
      requestAnimationFrame(() => {
        window.scrollTo({ top: savedY, left: 0, behavior: 'instant' });
        const mainElement = document.querySelector('main');
        if (mainElement && typeof mainElement.scrollTo === 'function') {
          mainElement.scrollTo({ top: savedY, left: 0, behavior: 'instant' });
        }
      });
      return;
    }

    // Forward navigation: reset scroll.
    const scrollOptions: ScrollToOptions = {
      top: 0,
      left: 0,
      behavior: 'instant',
    };

    window.scrollTo(scrollOptions);

    const mainElement = document.querySelector('main');
    if (mainElement && typeof mainElement.scrollTo === 'function') {
      mainElement.scrollTo(scrollOptions);
    }

    const scrollableContainers = document.querySelectorAll('[data-scroll-reset]');
    scrollableContainers.forEach(container => {
      if (container instanceof HTMLElement && typeof container.scrollTo === 'function') {
        container.scrollTo(scrollOptions);
      }
    });
  }, [hash, pathname, key, navigationType]);

  return null;
}
