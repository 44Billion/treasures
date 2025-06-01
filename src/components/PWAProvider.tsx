import { useEffect } from 'react';

// Extend Window interface to include deferredPrompt
declare global {
  interface Window {
    deferredPrompt?: {
      prompt: () => Promise<void>;
      userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
    };
  }
}

// Global PWA provider that captures the beforeinstallprompt event early
export function PWAProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Capture the beforeinstallprompt event as early as possible
    const handleBeforeInstallPrompt = (e: Event) => {
      console.log('PWA: beforeinstallprompt event captured in provider');
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Store the event so it can be triggered later
      window.deferredPrompt = e as unknown as Window['deferredPrompt'];
      
      // Only dispatch custom event if we actually have a valid prompt
      if (window.deferredPrompt) {
        console.log('PWA: dispatching pwa-installable event');
        window.dispatchEvent(new CustomEvent('pwa-installable'));
      }
    };

    // Set up the listener immediately
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    console.log('PWA: beforeinstallprompt listener registered in provider');

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  return <>{children}</>;
}