import { useEffect, useState } from 'react';

export interface PWAUpdateState {
  updateAvailable: boolean;
  isUpdating: boolean;
  needsRefresh: boolean;
  checkingForUpdate: boolean;
}

export function usePWAUpdate() {
  const [state, setState] = useState<PWAUpdateState>({
    updateAvailable: false,
    isUpdating: false,
    needsRefresh: false,
    checkingForUpdate: false,
  });
  
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const handleServiceWorkerUpdate = async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        setRegistration(reg);
        
        // Check for waiting worker immediately
        if (reg.waiting) {
          setWaitingWorker(reg.waiting);
          setState(prev => ({ ...prev, updateAvailable: true }));
        }

        // Listen for new service worker installations
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (!newWorker) return;

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              setWaitingWorker(newWorker);
              setState(prev => ({ 
                ...prev, 
                updateAvailable: true,
                checkingForUpdate: false 
              }));
            }
          });
        });
      } catch (error) {
        console.error('Service worker setup failed:', error);
        setState(prev => ({ ...prev, checkingForUpdate: false }));
      }
    };

    // Listen for controller changes (when update is applied)
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      setState(prev => ({ ...prev, needsRefresh: true, isUpdating: false }));
    });

    handleServiceWorkerUpdate();
  }, []);

  const checkForUpdate = async () => {
    if (!registration) return false;
    
    setState(prev => ({ ...prev, checkingForUpdate: true }));
    
    try {
      await registration.update();
      // The updatefound event will handle the rest
      return true;
    } catch (error) {
      console.error('Failed to check for updates:', error);
      setState(prev => ({ ...prev, checkingForUpdate: false }));
      return false;
    }
  };

  const applyUpdate = () => {
    if (!waitingWorker) return;
    
    setState(prev => ({ ...prev, isUpdating: true }));
    waitingWorker.postMessage({ type: 'SKIP_WAITING' });
  };

  const reloadApp = () => {
    window.location.reload();
  };

  const dismissUpdate = () => {
    setState(prev => ({ ...prev, updateAvailable: false }));
  };

  return {
    ...state,
    checkForUpdate,
    applyUpdate,
    reloadApp,
    dismissUpdate,
  };
}