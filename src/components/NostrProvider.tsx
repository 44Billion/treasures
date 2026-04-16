import React, { useEffect, useMemo, useRef } from 'react';
import { NostrEvent, NostrFilter, NPool, NRelay1 } from '@nostrify/nostrify';
import { NostrContext } from '@nostrify/react';
import { NUser, useNostrLogin } from '@nostrify/react/login';
import type { NostrSigner } from '@nostrify/types';
import { useAppContext } from '@/hooks/useAppContext';
import { getEffectiveRelays } from '@/lib/appRelays';
import { NostrBatcher } from '@/lib/NostrBatcher';

interface NostrProviderProps {
  children: React.ReactNode;
}

const NostrProvider: React.FC<NostrProviderProps> = (props) => {
  const { children } = props;
  const { config } = useAppContext();
  const { logins } = useNostrLogin();

  // Create NPool instance only once
  const pool = useRef<NPool | undefined>(undefined);

  // Use refs so the pool always has the latest data
  const effectiveRelays = useRef(getEffectiveRelays(config.relayMetadata, config.useAppRelays));

  // Stable ref to the current user's signer for NIP-42 AUTH.
  const signerRef = useRef<NostrSigner | undefined>(undefined);

  // Derive the current signer from the active login.
  const currentLogin = logins[0];
  const currentSigner = useMemo(() => {
    if (!currentLogin) return undefined;
    try {
      switch (currentLogin.type) {
        case 'nsec':
          return NUser.fromNsecLogin(currentLogin).signer;
        case 'bunker':
          return NUser.fromBunkerLogin(currentLogin, pool.current!).signer;
        case 'extension':
          return NUser.fromExtensionLogin(currentLogin).signer;
        default:
          return undefined;
      }
    } catch {
      return undefined;
    }
  }, [currentLogin]);

  // Keep the ref in sync so the AUTH callback always sees the latest signer.
  signerRef.current = currentSigner;

  // Update effective relays ref when config changes.
  useEffect(() => {
    effectiveRelays.current = getEffectiveRelays(config.relayMetadata, config.useAppRelays);
  }, [config.relayMetadata, config.useAppRelays]);

  // Initialize NPool only once
  if (!pool.current) {
    pool.current = new NPool({
      open(url: string) {
        return new NRelay1(url, {
          // NIP-42: Respond to relay AUTH challenges
          auth: async (challenge: string) => {
            const signer = signerRef.current;
            if (!signer) {
              throw new Error('AUTH failed: no signer available (user not logged in)');
            }
            return signer.signEvent({
              kind: 22242,
              content: '',
              tags: [
                ['relay', url],
                ['challenge', challenge],
              ],
              created_at: Math.floor(Date.now() / 1000),
            });
          },
        });
      },
      reqRouter(filters: NostrFilter[]): Map<URL['href'], NostrFilter[]> {
        const routes = new Map<string, NostrFilter[]>();

        // Route to all read relays
        const readRelays = effectiveRelays.current.relays
          .filter(r => r.read)
          .map(r => r.url);

        for (const url of readRelays) {
          routes.set(url, filters);
        }

        return routes;
      },
      eventRouter(_event: NostrEvent) {
        // Get write relays from effective relays
        const writeRelays = effectiveRelays.current.relays
          .filter(r => r.write)
          .map(r => r.url);

        return [...new Set(writeRelays)];
      },
      // Resolve queries quickly once any relay sends EOSE
      eoseTimeout: 300,
    });
  }

  // Wrap the pool in a batching proxy
  const batcher = useRef<NostrBatcher | undefined>(undefined);
  if (!batcher.current && pool.current) {
    batcher.current = new NostrBatcher(pool.current);
  }

  // Cleanup: Close all relay connections when the provider unmounts
  useEffect(() => {
    return () => {
      if (pool.current) {
        pool.current.close();
      }
    };
  }, []);

  return (
    <NostrContext.Provider value={{ nostr: (batcher.current ?? pool.current) as unknown as NPool }}>
      {children}
    </NostrContext.Provider>
  );
};

export default NostrProvider;
