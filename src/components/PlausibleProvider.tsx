import { ReactNode, useEffect, useRef } from 'react';
import { useAppContext } from '@/hooks/useAppContext';

interface PlausibleProviderProps {
  children: ReactNode;
}

/**
 * Reactively initializes Plausible Analytics from AppConfig.
 *
 * The tracker's `init()` can only be called once per page load, so we
 * guard with a ref. Init only happens when:
 *   - the operator configured a `plausibleDomain` (build-time env var), AND
 *   - the user has not opted out via the Privacy settings.
 *
 * Once initialized for a tab, turning analytics off only takes effect on
 * the next full reload — the Privacy UI explains this to the user.
 */
export function PlausibleProvider({ children }: PlausibleProviderProps) {
  const { config } = useAppContext();
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    if (!config.plausibleDomain) return;
    if (!config.analyticsEnabled) return;
    initializedRef.current = true;

    import('@plausible-analytics/tracker').then(({ init }) => {
      init({
        domain: config.plausibleDomain,
        ...(config.plausibleEndpoint && { endpoint: config.plausibleEndpoint }),
      });
    }).catch(console.error);
  }, [config.plausibleDomain, config.plausibleEndpoint, config.analyticsEnabled]);

  return <>{children}</>;
}
