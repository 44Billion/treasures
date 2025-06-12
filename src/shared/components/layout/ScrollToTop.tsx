import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Component that scrolls to top on route changes.
 * Should be placed inside BrowserRouter but outside Routes.
 * 
 * Features:
 * - Scrolls to top on pathname changes (major navigation)
 * - Preserves scroll position for hash changes (same page navigation)
 * - Uses smooth scrolling behavior when available
 * - Handles both window and main content scrolling
 */
export function ScrollToTop() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    // Don't scroll to top if we're navigating to a hash on the same page
    if (hash) {
      // Let the browser handle hash navigation
      return;
    }

    // Scroll to top for major page navigation
    // Use smooth scrolling if supported, instant otherwise
    const scrollOptions: ScrollToOptions = {
      top: 0,
      left: 0,
      behavior: 'instant' // Use instant for page changes to feel snappy
    };

    // Scroll the main window
    window.scrollTo(scrollOptions);

    // Also scroll any main content areas that might be independently scrollable
    const mainElement = document.querySelector('main');
    if (mainElement && typeof mainElement.scrollTo === 'function') {
      mainElement.scrollTo(scrollOptions);
    }

    // Handle any other scrollable containers that might need reset
    const scrollableContainers = document.querySelectorAll('[data-scroll-reset]');
    scrollableContainers.forEach(container => {
      if (container instanceof HTMLElement && typeof container.scrollTo === 'function') {
        container.scrollTo(scrollOptions);
      }
    });
  }, [pathname]); // Only trigger on pathname changes, not hash changes

  return null;
}