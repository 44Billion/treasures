import { useEffect, useState } from 'react';

// Extend Window interface to include deferredPrompt
declare global {
  interface Window {
    deferredPrompt?: {
      prompt: () => Promise<void>;
      userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
    };
  }
}

export function usePWAInstall() {
  const [installable, setInstallable] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) {
      setInstalled(true);
      return;
    }

    // Only set installable to true if we actually have a deferred prompt
    const checkInstallable = () => {
      if (window.deferredPrompt) {
        console.log('PWA: deferredPrompt available, setting installable to true');
        setInstallable(true);
      } else {
        setInstallable(false);
      }
    };

    // Check immediately
    checkInstallable();

    // Listen for custom PWA installable event (only fired when we actually capture the event)
    const handlePWAInstallable = () => {
      console.log('PWA: installable event received');
      checkInstallable();
    };

    // Listen for app installed event
    const handleAppInstalled = () => {
      setInstalled(true);
      setInstallable(false);
      window.deferredPrompt = undefined;
    };

    // Listen for beforeinstallprompt as backup
    const handleBeforeInstallPrompt = (e: Event) => {
      console.log('PWA: beforeinstallprompt event received in hook');
      e.preventDefault();
      window.deferredPrompt = e as unknown as Window['deferredPrompt'];
      setInstallable(true);
    };

    window.addEventListener('pwa-installable', handlePWAInstallable);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('pwa-installable', handlePWAInstallable);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const install = async () => {
    const deferredPrompt = window.deferredPrompt;
    
    if (!deferredPrompt) {
      console.log('PWA: No deferred prompt available for installation');
      return false;
    }

    setInstalling(true);
    try {
      console.log('PWA: Attempting to show install prompt');
      await deferredPrompt.prompt();
      const result = await deferredPrompt.userChoice;
      
      console.log('PWA: User choice:', result.outcome);
      if (result.outcome === 'accepted') {
        console.log('PWA: Installation accepted');
        setInstalled(true);
        setInstallable(false);
        window.deferredPrompt = undefined;
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('PWA: Install prompt failed:', error);
      return false;
    } finally {
      setInstalling(false);
    }
  };

  return {
    installable,
    installing,
    installed,
    install
  };
}