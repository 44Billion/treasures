import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import RemoteLoginSuccess from '@/pages/RemoteLoginSuccess';

// Mock react-i18next so translation keys resolve to human-readable strings
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'remoteLogin.completing': 'Completing Login...',
        'remoteLogin.verifying': 'Please wait while we verify your session.',
        'remoteLogin.success': 'Login Successful',
        'remoteLogin.redirecting': 'Redirecting...',
        'remoteLogin.timeout': 'Session Not Found',
        'remoteLogin.timeoutDescription': "We couldn't detect an active login session.",
        'remoteLogin.returnHome': 'Return to Home',
      };
      return translations[key] ?? key;
    },
  }),
}));

// Mock NostrLoginProvider
vi.mock('@nostrify/react/login', () => ({
  useNostrLogin: vi.fn(() => ({
    logins: [],
  })),
}));

describe('RemoteLoginSuccess', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    // Mock localStorage
    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {});
    
    // Mock window.close and window.location
    vi.spyOn(window, 'close').mockImplementation(() => {});
    Object.defineProperty(window, 'location', {
      value: { href: '' },
      writable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should render checking status initially', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <RemoteLoginSuccess />
        </BrowserRouter>
      </QueryClientProvider>
    );

    expect(screen.getByText('Completing Login...')).toBeTruthy();
    expect(screen.getByText('Please wait while we verify your session.')).toBeTruthy();
  });

  it('should show timeout after waiting period', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <RemoteLoginSuccess />
        </BrowserRouter>
      </QueryClientProvider>
    );

    // Wait for timeout to occur (should happen after 10 seconds of checking)
    await waitFor(
      () => {
        expect(screen.getByText('Session Not Found')).toBeTruthy();
      },
      { timeout: 15000 }
    );

    expect(screen.getByText("We couldn't detect an active login session.")).toBeTruthy();
  }, 20000); // Set test timeout to 20 seconds
});
