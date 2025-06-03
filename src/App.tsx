// NOTE: This file should normally not be modified unless you are adding a new provider.
// To add new routes, edit the AppRouter.tsx file.

import NostrProvider from '@/components/NostrProvider'
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NostrLoginProvider } from '@nostrify/react/login';
import AppRouter from './AppRouter';
import { PWAUpdatePrompt } from '@/components/PWAUpdatePrompt';
import { PWAProvider } from '@/components/PWAProvider';
import { ServiceWorkerProvider } from '@/components/ServiceWorkerProvider';
import { ThemeProvider } from '@/components/ThemeProvider';
import { offlineStorage } from '@/lib/offlineStorage';
import { connectivityChecker } from '@/lib/connectivityChecker';
import { getUserRelays } from '@/lib/relayConfig';
import { useEffect, useState } from 'react';
import './styles/leaflet-overrides.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 60000, // 1 minute
      gcTime: Infinity,
    },
  },
});

export function App() {
  // State for user's preferred relays
  const [relays, setRelays] = useState<string[]>(getUserRelays);

  // Initialize offline storage and connectivity checking on app start
  useEffect(() => {
    offlineStorage.init().catch(console.error);
    
    // Initialize connectivity checker (it starts automatically)
    connectivityChecker.forceCheck().catch(console.error);
    
    // Clean up old data periodically (30 days)
    const cleanup = () => {
      offlineStorage.clearOldData(30 * 24 * 60 * 60 * 1000).catch(console.error);
    };
    
    // Run cleanup on app start and then every 24 hours
    cleanup();
    const cleanupInterval = setInterval(cleanup, 24 * 60 * 60 * 1000);
    
    return () => {
      clearInterval(cleanupInterval);
      connectivityChecker.destroy();
    };
  }, []);

  // Listen for changes to relay preferences in localStorage
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'geocaching-relays') {
        setRelays(getUserRelays());
      }
    };

    // Listen for storage changes from other tabs/windows
    window.addEventListener('storage', handleStorageChange);

    // Also listen for custom events from the same tab (Settings page)
    const handleRelayUpdate = () => {
      setRelays(getUserRelays());
    };

    window.addEventListener('relays-updated', handleRelayUpdate);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('relays-updated', handleRelayUpdate);
    };
  }, []);

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <ServiceWorkerProvider>
        <PWAProvider>
          <NostrLoginProvider storageKey='nostr:login'>
            <NostrProvider relays={relays}>
              <QueryClientProvider client={queryClient}>
                <TooltipProvider>
                  <div className="min-h-screen flex flex-col">
                    <AppRouter />
                  </div>
                  <PWAUpdatePrompt />
                  <Toaster />
                  <Sonner />
                </TooltipProvider>
              </QueryClientProvider>
            </NostrProvider>
          </NostrLoginProvider>
        </PWAProvider>
      </ServiceWorkerProvider>
    </ThemeProvider>
  );
}

export default App;
