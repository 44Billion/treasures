import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RelaySelector } from '@/components/RelaySelector';
import { AppProvider } from '@/components/AppProvider';
import { AppConfig } from '@/contexts/AppContext';

const defaultConfig: AppConfig = {
  relayUrl: 'wss://ditto.pub/relay',
};

const presetRelays = [
  { url: 'wss://ditto.pub/relay', name: 'Ditto' },
  { url: 'wss://relay.nostr.band', name: 'Nostr.Band' },
];

function TestWrapper({ children }: { children: React.ReactNode }) {
  return (
    <AppProvider 
      storageKey="test:app-config" 
      defaultConfig={defaultConfig} 
      presetRelays={presetRelays}
    >
      {children}
    </AppProvider>
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
      <AppProvider 
        storageKey="test:app-config" 
        defaultConfig={customConfig} 
        presetRelays={presetRelays}
      >
        <RelaySelector />
      </AppProvider>
    );

    expect(screen.getByText('custom.relay.com')).toBeInTheDocument();
  });
});