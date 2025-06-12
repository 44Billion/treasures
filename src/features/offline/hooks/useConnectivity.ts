/**
 * React hook for enhanced connectivity detection
 */

import { useState, useEffect } from 'react';
import { connectivityChecker, ConnectivityStatus } from '@/features/offline/utils/connectivityChecker';

export function useConnectivity() {
  const [status, setStatus] = useState<ConnectivityStatus>(() => 
    connectivityChecker.getStatus()
  );

  useEffect(() => {
    // Subscribe to connectivity changes
    const unsubscribe = connectivityChecker.addListener(setStatus);

    // Get initial status
    setStatus(connectivityChecker.getStatus());

    return unsubscribe;
  }, []);

  const forceCheck = async () => {
    return await connectivityChecker.forceCheck();
  };

  return {
    ...status,
    forceCheck,
  };
}

// Convenience hook for simple online/offline detection
export function useOnlineStatus() {
  const { isConnected, connectionQuality } = useConnectivity();
  
  return {
    isOnline: isConnected && connectionQuality !== 'offline',
    isConnected,
    connectionQuality,
  };
}