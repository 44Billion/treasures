/**
 * Unified Store Provider
 * Provides all stores through React context
 */

import { useMemo, useRef } from 'react';
import type { 
  UnifiedStores, 
  StoreProviderProps,
  StoreConfig 
} from './types';
import { useGeocacheStore } from './useGeocacheStore';
import { useLogStore } from './useLogStore';
import { useAuthorStore } from './useAuthorStore';
import { useOfflineStore } from './useOfflineStore';
import { DEFAULT_STORE_CONFIG } from './baseStore';
import {
  GeocacheStoreContext,
  LogStoreContext,
  AuthorStoreContext,
  OfflineStoreContext,
  UnifiedStoresContext
} from './contexts';

// Stable empty config object to prevent re-renders
const EMPTY_CONFIG = {};

// Deep equality check for config objects
function deepEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (a == null || b == null) return a === b;
  if (typeof a !== typeof b) return false;
  if (typeof a !== 'object') return a === b;
  
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  
  for (const key of keysA) {
    if (!keysB.includes(key)) return false;
    if (!deepEqual(a[key], b[key])) return false;
  }
  
  return true;
}

/**
 * Store Provider Component - Only component export in this file
 * Use hooks from './hooks' for accessing store contexts
 */
export function StoreProvider({ children, config = EMPTY_CONFIG }: StoreProviderProps) {
  // Use ref to store previous config for deep comparison
  const configRef = useRef(config);
  const prevConfigRef = useRef(config);

  // Only update storeConfig when config actually changes
  const storeConfig: StoreConfig = useMemo(() => {
    if (deepEqual(prevConfigRef.current, config)) {
      return configRef.current;
    }
    
    const newConfig = {
      ...DEFAULT_STORE_CONFIG,
      ...config,
    };
    
    configRef.current = newConfig;
    prevConfigRef.current = config;
    return newConfig;
  }, [config]);

  // Initialize all stores with stable config
  const geocacheStore = useGeocacheStore(storeConfig);
  const logStore = useLogStore(storeConfig);
  const authorStore = useAuthorStore(storeConfig);
  const offlineStore = useOfflineStore(storeConfig);

  // Create unified stores object with stable references
  const unifiedStores = useMemo((): UnifiedStores => ({
    geocache: geocacheStore,
    log: logStore,
    author: authorStore,
    offline: offlineStore,
  }), [geocacheStore, logStore, authorStore, offlineStore]);

  return (
    <GeocacheStoreContext.Provider value={geocacheStore}>
      <LogStoreContext.Provider value={logStore}>
        <AuthorStoreContext.Provider value={authorStore}>
          <OfflineStoreContext.Provider value={offlineStore}>
            <UnifiedStoresContext.Provider value={unifiedStores}>
              {children}
            </UnifiedStoresContext.Provider>
          </OfflineStoreContext.Provider>
        </AuthorStoreContext.Provider>
      </LogStoreContext.Provider>
    </GeocacheStoreContext.Provider>
  );
}