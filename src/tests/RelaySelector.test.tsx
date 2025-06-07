import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RelaySelector } from '@/components/RelaySelector';
import { AppProvider } from '@/components/AppProvider';
import { AppConfig } from '@/contexts/AppContext';
import { ThemeProvider } from 'next-themes';

const defaultConfig: AppConfig = {
  relayUrl: 'wss://ditto.pub/relay',
};

const presetRelays = [
  { url: 'wss://ditto.pub/relay', name: 'Ditto' },
  { url: 'wss://relay.nostr.band', name: 'Nostr.Band' },
];

function TestWrapper({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light">
      <AppProvider 
        storageKey="test:app-config" 
        defaultConfig={defaultConfig} 
        presetRelays={presetRelays}
      >
        {children}
      </AppProvider>
    </ThemeProvider>
  );
}

describe('RelaySelector', () => {
  it('renders with default relay selected', () => {
    render(
      <TestWrapper>
        <RelaySelector />
      </TestWrapper>
    );

    expect(screen.getByText('Ditto')).toBeInTheDocument();
  });

  it('shows relay URL when no preset name matches', () => {
    const customConfig: AppConfig = {
      relayUrl: 'wss://custom.relay.com',
    };

    render(
      <ThemeProvider attribute="class" defaultTheme="light">
        <AppProvider 
          storageKey="test:app-config" 
          defaultConfig={customConfig} 
          presetRelays={presetRelays}
        >
          <RelaySelector />
        </AppProvider>
      </ThemeProvider>
    );

    expect(screen.getByText('custom.relay.com')).toBeInTheDocument();
  });

  it('applies adventure theme styling when adventure theme is active', () => {
    render(
      <ThemeProvider attribute="class" defaultTheme="adventure">
        <AppProvider 
          storageKey="test:app-config" 
          defaultConfig={defaultConfig} 
          presetRelays={presetRelays}
        >
          <RelaySelector />
        </AppProvider>
      </ThemeProvider>
    );

    const button = screen.getByRole('combobox');
    expect(button).toHaveClass('!bg-stone-700', '!border-stone-600', '!text-stone-200');
  });
});