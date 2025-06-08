import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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

    const selectTrigger = screen.getByRole('combobox');
    expect(selectTrigger).toHaveClass('!bg-stone-700', '!border-stone-600', '!text-stone-200');
  });

  it('shows custom relay input when "Add custom relay..." is selected', async () => {
    render(
      <TestWrapper>
        <RelaySelector />
      </TestWrapper>
    );

    const selectTrigger = screen.getByRole('combobox');
    fireEvent.click(selectTrigger);

    // Wait for the dropdown to open and find the custom option
    await waitFor(() => {
      const customOption = screen.getByText('Add custom relay...');
      expect(customOption).toBeInTheDocument();
      fireEvent.click(customOption);
    });

    // Check that the custom input appears
    await waitFor(() => {
      const customInput = screen.getByPlaceholderText('wss://relay.example.com');
      expect(customInput).toBeInTheDocument();
    });
  });

  it('allows adding a custom relay URL', async () => {
    render(
      <TestWrapper>
        <RelaySelector />
      </TestWrapper>
    );

    const selectTrigger = screen.getByRole('combobox');
    fireEvent.click(selectTrigger);

    // Select custom option
    await waitFor(() => {
      const customOption = screen.getByText('Add custom relay...');
      fireEvent.click(customOption);
    });

    // Enter custom URL
    await waitFor(() => {
      const customInput = screen.getByPlaceholderText('wss://relay.example.com');
      fireEvent.change(customInput, { target: { value: 'custom.relay.com' } });
      
      const addButton = screen.getByText('Add');
      fireEvent.click(addButton);
    });

    // Check that the custom relay is now selected
    await waitFor(() => {
      expect(screen.getByText('custom.relay.com')).toBeInTheDocument();
    });
  });
});