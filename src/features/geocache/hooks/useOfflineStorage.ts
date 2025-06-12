import { useState, useEffect } from 'react';

/**
 * Hook for managing offline mode detection
 */
export function useOfflineMode() {
  const [isOfflineMode, setIsOfflineMode] = useState(false);

  useEffect(() => {
    // Check initial online status
    setIsOfflineMode(!navigator.onLine);

    // Listen for online/offline events
    const handleOnline = () => setIsOfflineMode(false);
    const handleOffline = () => setIsOfflineMode(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return {
    isOfflineMode,
  };
}