import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAppContext } from '@/shared/hooks/useAppContext';
import { AppProvider } from '@/components/AppProvider';
import { AppConfig } from '@/contexts/AppContext';

const defaultConfig: AppConfig = {
  relayUrl: 'wss://relay.primal.net',
};

const presetRelays = [
  { url: 'wss://relay.primal.net', name: 'Primal' },
  { url: 'wss://ditto.pub/relay', name: 'Ditto' },
  { url: 'wss://relay.nostr.band', name: 'Nostr.Band' },
];

function TestWrapper({ children }: { children: React.ReactNode }) {
  return (
    <AppProvider 
      storageKey="test:app-context" 
      defaultConfig={defaultConfig} 
      presetRelays={presetRelays}
    >
      {children}
    </AppProvider>
  );
}

describe('useAppContext', () => {
  it('provides default config', () => {
    const { result } = renderHook(() => useAppContext(), {
      wrapper: TestWrapper,
    });

    expect(result.current.config.relayUrl).toBe('wss://relay.primal.net');
    expect(result.current.presetRelays).toEqual(presetRelays);
  });

  it('allows updating config', () => {
    const { result } = renderHook(() => useAppContext(), {
      wrapper: TestWrapper,
    });

    act(() => {
      result.current.updateConfig((current) => ({
        ...current,
        relayUrl: 'wss://new.relay.com',
      }));
    });

    expect(result.current.config.relayUrl).toBe('wss://new.relay.com');
  });

  it('throws error when used outside provider', () => {
    expect(() => {
      renderHook(() => useAppContext());
    }).toThrow('useAppContext must be used within an AppProvider');
  });
});