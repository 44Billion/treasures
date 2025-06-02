import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/useToast';

interface PWAUpdateHook {
  isUpdateAvailable: boolean;
  isInstallable: boolean;
  isInstalling: boolean;
  isChecking: boolean;
  checkForUpdate: () => Promise<void>;
  installUpdate: () => Promise<void>;
  installPWA: () => Promise<void>;
}

export function usePWAUpdate(): PWAUpdateHook {
  const [isUpdateAvailable, setIsUpdateAvailable] = useState(false);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const { toast } = useToast();

  useEffect(() => {
    // Check for service worker updates
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((registration) => {
        const checkForUpdates = () => {
          if (registration.waiting) {
            setWaitingWorker(registration.waiting);
            setIsUpdateAvailable(true);
          }
        };

        checkForUpdates();

        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                setWaitingWorker(newWorker);
                setIsUpdateAvailable(true);
                toast({
                  title: "Update available",
                  description: "A new version of the app is ready to install.",
                });
              }
            });
          }
        });
      });

      // Listen for controlling service worker changes
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        window.location.reload();
      });
    }

    // Check for PWA install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setIsInstallable(false);
      toast({
        title: "App installed",
        description: "Treasures has been installed on your device.",
      });
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [toast]);

  const checkForUpdate = async (): Promise<void> => {
    if (!('serviceWorker' in navigator)) {
      toast({
        title: "Updates not supported",
        description: "Service workers are not supported in this browser.",
        variant: "destructive",
      });
      return;
    }

    setIsChecking(true);
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        // Force check for updates
        await registration.update();
        
        // Check multiple times to catch updates that might be detected slightly later
        const checkWaitingWorker = () => {
          if (registration.waiting && registration.waiting !== waitingWorker) {
            setWaitingWorker(registration.waiting);
            setIsUpdateAvailable(true);
            toast({
              title: "Update available",
              description: "A new version is ready to install.",
            });
            return true;
          }
          return false;
        };

        // Check immediately
        if (checkWaitingWorker()) {
          setIsChecking(false);
          return;
        }

        // Check after a short delay for updates that need time to process
        setTimeout(() => {
          if (checkWaitingWorker()) {
            setIsChecking(false);
            return;
          }
        }, 1000);

        // Final check after a longer delay
        setTimeout(() => {
          if (!checkWaitingWorker()) {
            toast({
              title: "No updates",
              description: "You're running the latest version.",
            });
          }
          setIsChecking(false);
        }, 3000);

      } else {
        setIsChecking(false);
        toast({
          title: "Service worker not found",
          description: "Unable to check for updates.",
          variant: "destructive",
        });
      }
    } catch (error) {
      setIsChecking(false);
      toast({
        title: "Update check failed",
        description: "Failed to check for updates. Please try again.",
        variant: "destructive",
      });
    }
  };

  const installUpdate = async (): Promise<void> => {
    if (!waitingWorker) {
      toast({
        title: "No update available",
        description: "There's no update waiting to be installed.",
        variant: "destructive",
      });
      return;
    }

    setIsInstalling(true);
    try {
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });
      setIsUpdateAvailable(false);
      setWaitingWorker(null);
    } catch (error) {
      toast({
        title: "Installation failed",
        description: "Failed to install the update. Please refresh the page.",
        variant: "destructive",
      });
    } finally {
      setIsInstalling(false);
    }
  };

  const installPWA = async (): Promise<void> => {
    if (!deferredPrompt) {
      toast({
        title: "Installation not available",
        description: "The app is already installed or installation is not supported.",
        variant: "destructive",
      });
      return;
    }

    setIsInstalling(true);
    try {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        toast({
          title: "Installation started",
          description: "The app is being installed on your device.",
        });
      } else {
        toast({
          title: "Installation cancelled",
          description: "App installation was cancelled.",
        });
      }
      
      setDeferredPrompt(null);
      setIsInstallable(false);
    } catch (error) {
      toast({
        title: "Installation failed",
        description: "Failed to install the app. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsInstalling(false);
    }
  };

  return {
    isUpdateAvailable,
    isInstallable,
    isInstalling,
    isChecking,
    checkForUpdate,
    installUpdate,
    installPWA,
  };
}