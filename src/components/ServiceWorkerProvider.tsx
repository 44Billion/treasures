/**
 * Service Worker provider for PWA functionality
 */

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Workbox } from 'workbox-window';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RefreshCw, Download, X } from 'lucide-react';
import { useToast } from '@/hooks/useToast';

interface ServiceWorkerContextType {
  isUpdateAvailable: boolean;
  isInstallPromptAvailable: boolean;
  updateApp: () => void;
  installApp: () => void;
  skipUpdate: () => void;
}

const ServiceWorkerContext = createContext<ServiceWorkerContextType | null>(null);

export function useServiceWorker() {
  const context = useContext(ServiceWorkerContext);
  if (!context) {
    throw new Error('useServiceWorker must be used within ServiceWorkerProvider');
  }
  return context;
}

interface ServiceWorkerProviderProps {
  children: ReactNode;
}

export function ServiceWorkerProvider({ children }: ServiceWorkerProviderProps) {
  const [isUpdateAvailable, setIsUpdateAvailable] = useState(false);
  const [isInstallPromptAvailable, setIsInstallPromptAvailable] = useState(false);
  const [workbox, setWorkbox] = useState<Workbox | null>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<Event | null>(null);
  const [showUpdatePrompt, setShowUpdatePrompt] = useState(false);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      const wb = new Workbox('/sw.js');

      // Service worker update available
      wb.addEventListener('waiting', () => {
        setIsUpdateAvailable(true);
        setShowUpdatePrompt(true);
      });

      // Service worker activated
      wb.addEventListener('controlling', () => {
        window.location.reload();
      });

      // Service worker installed for the first time
      wb.addEventListener('installed', (event) => {
        if (!event.isUpdate) {
          toast({
            title: 'App installed!',
            description: 'The app is now available offline.',
          });
        }
      });

      // Register the service worker
      wb.register().catch((error) => {
        console.error('Service worker registration failed:', error);
      });

      setWorkbox(wb);
    }

    // Handle install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallPromptAvailable(true);
      setShowInstallPrompt(true);
    };

    // Handle app installed
    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setIsInstallPromptAvailable(false);
      setShowInstallPrompt(false);
      toast({
        title: 'App installed!',
        description: 'Treasures has been added to your home screen.',
      });
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [toast]);

  const updateApp = () => {
    if (workbox) {
      workbox.messageSkipWaiting();
      setShowUpdatePrompt(false);
    }
  };

  const installApp = async () => {
    if (deferredPrompt) {
      const promptEvent = deferredPrompt as any;
      promptEvent.prompt();
      const result = await promptEvent.userChoice;
      
      if (result.outcome === 'accepted') {
        setDeferredPrompt(null);
        setIsInstallPromptAvailable(false);
        setShowInstallPrompt(false);
      }
    }
  };

  const skipUpdate = () => {
    setShowUpdatePrompt(false);
  };

  const skipInstall = () => {
    setShowInstallPrompt(false);
  };

  const contextValue: ServiceWorkerContextType = {
    isUpdateAvailable,
    isInstallPromptAvailable,
    updateApp,
    installApp,
    skipUpdate,
  };

  return (
    <ServiceWorkerContext.Provider value={contextValue}>
      {children}
      
      {/* Update Available Prompt */}
      {showUpdatePrompt && (
        <div className="fixed bottom-4 right-4 z-50 max-w-sm">
          <Card className="shadow-lg border-blue-200 bg-blue-50">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base text-blue-900">Update Available</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={skipUpdate}
                  className="h-6 w-6 p-0 text-blue-700 hover:text-blue-900"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <CardDescription className="text-blue-700">
                A new version of Treasures is ready to install.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={updateApp}
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Update
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={skipUpdate}
                  className="flex-1 border-blue-300 text-blue-700 hover:bg-blue-100"
                >
                  Later
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Install App Prompt */}
      {showInstallPrompt && (
        <div className="fixed bottom-4 right-4 z-50 max-w-sm">
          <Card className="shadow-lg border-green-200 bg-green-50">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base text-green-900">Install App</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={skipInstall}
                  className="h-6 w-6 p-0 text-green-700 hover:text-green-900"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <CardDescription className="text-green-700">
                Install Treasures for quick access and offline use.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={installApp}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  <Download className="h-3 w-3 mr-1" />
                  Install
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={skipInstall}
                  className="flex-1 border-green-300 text-green-700 hover:bg-green-100"
                >
                  Not now
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </ServiceWorkerContext.Provider>
  );
}