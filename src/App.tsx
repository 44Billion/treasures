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
import './styles/leaflet-overrides.css';

// Default relay configuration - using ditto.pub as primary relay
const defaultRelays = [
  'wss://ditto.pub/relay',
  // Additional relays can be configured by users in Settings
  // DO NOT ADD ANY RELAY WITHOUT FIRST USING A TOOL TO VERIFY IT IS ONLINE AND FUNCTIONAL
  // IF YOU CANNOT VERIFY A RELAY IS ONLINE AND FUNCTIONAL, DO NOT ADD IT HERE
];

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
  return (
    <PWAProvider>
      <NostrLoginProvider storageKey='nostr:login'>
        <NostrProvider relays={defaultRelays}>
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
  );
}

export default App;
