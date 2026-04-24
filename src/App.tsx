// NOTE: This file should normally not be modified unless you are adding a new provider.
// To add new routes, edit the AppRouter.tsx file.

import NostrProvider from '@/components/NostrProvider'
import { NostrSync } from '@/components/NostrSync';
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NostrLoginProvider } from '@nostrify/react/login';
import AppRouter from './AppRouter';

import { ThemeProvider } from '@/components/ThemeProvider';
import { DittoThemeInjector } from '@/components/DittoThemeInjector';
import { AppProvider } from '@/components/AppProvider';
import { AppConfig } from '@/contexts/AppContext';
import { StoreProvider } from '@/stores/StoreProvider';
import { NWCProvider } from '@/components/NWCProvider';
import { PlausibleProvider } from '@/components/PlausibleProvider';
import { APP_RELAYS } from '@/lib/appRelays';
import { APP_BLOSSOM_SERVERS } from '@/lib/appBlossom';

import { PWAUpdatePrompt } from '@/components/PWAUpdatePrompt';
import './lib/i18n';
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
  relayMetadata: APP_RELAYS,
  useAppRelays: true,
  blossomServerMetadata: APP_BLOSSOM_SERVERS,
  useAppBlossomServers: true,
  imageQuality: 'compressed',
  imageProxy: 'https://wsrv.nl',
  plausibleDomain: import.meta.env.VITE_PLAUSIBLE_DOMAIN || '',
  plausibleEndpoint: import.meta.env.VITE_PLAUSIBLE_ENDPOINT || '',
};

export function App() {
  return (
    <AppProvider storageKey="treasures:app-config" defaultConfig={defaultConfig}>
      <PlausibleProvider>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
        themes={['light', 'dark', 'system', 'adventure', 'ditto']}
      >
        <QueryClientProvider client={queryClient}>
          <NostrLoginProvider storageKey='nostr:login'>
            <NostrProvider>
              <NostrSync />
              <DittoThemeInjector />
              <NWCProvider>
                <StoreProvider>
                  <TooltipProvider>
                    <div className="min-h-screen flex flex-col">
                      <AppRouter />
                    </div>

                    <Toaster />
                    <PWAUpdatePrompt />
                  </TooltipProvider>
                </StoreProvider>
              </NWCProvider>
            </NostrProvider>
          </NostrLoginProvider>
        </QueryClientProvider>
      </ThemeProvider>
      </PlausibleProvider>
    </AppProvider>
  );
}

export default App;
