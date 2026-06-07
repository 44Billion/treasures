/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

/**
 * Coordinates the mobile bottom-nav "List" button with the Adventure detail
 * page. While viewing an adventure, the global list page (`/map?tab=list`)
 * would throw away the adventure context, so the AdventureDetail page
 * registers a handler here that opens its own treasure-list drawer instead.
 * The bottom nav consumes `openList` and falls back to normal navigation when
 * no adventure handler is registered.
 */
interface AdventureListNavContextValue {
  /** True when an adventure page has registered a list-drawer handler. */
  hasHandler: boolean;
  /** Open the current adventure's treasure-list drawer. No-op if unregistered. */
  openList: () => void;
  /** Register/clear the handler. Adventure pages call this on mount/unmount. */
  registerHandler: (handler: (() => void) | null) => void;
}

const AdventureListNavContext = createContext<AdventureListNavContextValue | null>(null);

export function AdventureListNavProvider({ children }: { children: ReactNode }) {
  const [handler, setHandler] = useState<(() => void) | null>(null);

  const registerHandler = useCallback((next: (() => void) | null) => {
    // Wrap in a closure so React doesn't treat a function value as a state
    // updater when stored via the setter.
    setHandler(() => next);
  }, []);

  const openList = useCallback(() => {
    handler?.();
  }, [handler]);

  return (
    <AdventureListNavContext.Provider
      value={{ hasHandler: handler !== null, openList, registerHandler }}
    >
      {children}
    </AdventureListNavContext.Provider>
  );
}

export function useAdventureListNav(): AdventureListNavContextValue {
  const ctx = useContext(AdventureListNavContext);
  if (!ctx) {
    throw new Error('useAdventureListNav must be used within an AdventureListNavProvider');
  }
  return ctx;
}
