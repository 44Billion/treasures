/**
 * Store hooks and contexts for accessing store contexts
 * Separated from StoreProvider.tsx to avoid Fast Refresh warnings
 */

import { createContext, useContext } from 'react';
import type { 
  GeocacheStore,
  LogStore,
  AuthorStore,
  UnifiedStores,
} from './types';

// Create contexts for each store
export const GeocacheStoreContext = createContext<GeocacheStore | null>(null);
export const LogStoreContext = createContext<LogStore | null>(null);
export const AuthorStoreContext = createContext<AuthorStore | null>(null);
export const UnifiedStoresContext = createContext<UnifiedStores | null>(null);

/**
 * Hook to access the geocache store
 */
export function useGeocacheStoreContext(): GeocacheStore {
  const store = useContext(GeocacheStoreContext);
  if (!store) {
    throw new Error('useGeocacheStoreContext must be used within a StoreProvider');
  }
  return store;
}

/**
 * Hook to access the log store
 */
export function useLogStoreContext(): LogStore {
  const store = useContext(LogStoreContext);
  if (!store) {
    throw new Error('useLogStoreContext must be used within a StoreProvider');
  }
  return store;
}