// NOTE: This file should normally not be modified unless you are adding a new provider.
// To add new routes, edit the AppRouter.tsx file.

import NostrProvider from '@/components/NostrProvider'
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NostrLoginProvider } from '@nostrify/react/login';
import AppRouter from './AppRouter';

import { ThemeProvider } from '@/components/ThemeProvider';
import { AppProvider } from '@/components/AppProvider';
import { AppConfig } from '@/contexts/AppContext';
import { StoreProvider } from '@/shared/stores/StoreProvider';
import { NWCProvider } from '@/components/NWCProvider';

import { initializeCacheCleanup } from '@/features/geocache/utils/cacheCleanup';
import { DEFAULT_RELAY, PRESET_RELAYS } from '@/shared/config/relays';
import { useEffect } from 'react';
import './styles/leaflet-overrides.css';
import './styles/print.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 60000, // 1 minute
      gcTime: 600000, // 10 minutes - reduced cache retention to prevent memory buildup
      retry: 2, // Limit retries to prevent hanging
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
  },
  // Add cache size limits to prevent unbounded growth
  queryCache: undefined, // Use default
  mutationCache: undefined, // Use default
});

const defaultConfig: AppConfig = {
  relayUrl: DEFAULT_RELAY,
};

export function App() {
  // Initialize cache cleanup manager
  useEffect(() => {
    const cacheCleanup = initializeCacheCleanup(queryClient);

    return () => {
      cacheCleanup.stop();
    };
  }, []);

  return (
    <AppProvider storageKey="treasures:app-config" defaultConfig={defaultConfig} presetRelays={PRESET_RELAYS}>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
        themes={['light', 'dark', 'system', 'adventure']}
      >
        <QueryClientProvider client={queryClient}>
          <NostrLoginProvider storageKey='nostr:login'>
            <NostrProvider>
              <NWCProvider>
                <StoreProvider>
                  <TooltipProvider>
                    <div className="min-h-screen flex flex-col">
                      <AppRouter />
                    </div>

                    <Toaster />
                  </TooltipProvider>
                </StoreProvider>
              </NWCProvider>
            </NostrProvider>
          </NostrLoginProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </AppProvider>
  );
}

export default App;
