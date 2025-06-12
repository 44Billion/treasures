import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RelayErrorFallback } from '@/components/RelayErrorFallback';
import { AppProvider } from '@/components/AppProvider';
import { DEFAULT_RELAY, PRESET_RELAYS } from '@/shared/config';
import { vi } from 'vitest';

// Mock the RelaySelector component
vi.mock('@/components/RelaySelector', () => ({
  RelaySelector: ({ className }: { className?: string }) => (
    <div data-testid="relay-selector" className={className}>
      Relay Selector Mock
    </div>
  ),
}));

const defaultConfig = {
  relayUrl: DEFAULT_RELAY,
};

function TestWrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <AppProvider 
        storageKey="test:relay-error-fallback" 
        defaultConfig={defaultConfig}
        presetRelays={PRESET_RELAYS}
      >
        {children}
      </AppProvider>
    </QueryClientProvider>
  );
}

describe('RelayErrorFallback', () => {
  it('renders error state with relay switcher', () => {
    const mockError = new Error('Connection failed');
    const mockRetry = vi.fn();

    render(
      <TestWrapper>
        <RelayErrorFallback
          error={mockError}
          onRetry={mockRetry}
        />
      </TestWrapper>
    );

    expect(screen.getByText('Connection Failed')).toBeInTheDocument();
    expect(screen.getByText('Connection failed')).toBeInTheDocument();
    expect(screen.getByTestId('relay-selector')).toBeInTheDocument();
    expect(screen.getByText('Retry Current Relay')).toBeInTheDocument();
  });

  it('renders empty state with relay switcher', () => {
    const mockRetry = vi.fn();

    render(
      <TestWrapper>
        <RelayErrorFallback
          isEmpty={true}
          onRetry={mockRetry}
        />
      </TestWrapper>
    );

    expect(screen.getByText('No Treasures Found')).toBeInTheDocument();
    expect(screen.getByTestId('relay-selector')).toBeInTheDocument();
    expect(screen.getByText('Retry Current Relay')).toBeInTheDocument();
  });

  it('calls onRetry when retry button is clicked', () => {
    const mockRetry = vi.fn();

    render(
      <TestWrapper>
        <RelayErrorFallback
          isEmpty={true}
          onRetry={mockRetry}
        />
      </TestWrapper>
    );

    fireEvent.click(screen.getByText('Retry Current Relay'));
    expect(mockRetry).toHaveBeenCalledTimes(1);
  });

  it('shows retrying state when isRetrying is true', () => {
    const mockRetry = vi.fn();

    render(
      <TestWrapper>
        <RelayErrorFallback
          isEmpty={true}
          onRetry={mockRetry}
          isRetrying={true}
        />
      </TestWrapper>
    );

    expect(screen.getByText('Retrying...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retrying/i })).toBeDisabled();
  });

  it('renders compact layout when compact prop is true', () => {
    render(
      <TestWrapper>
        <RelayErrorFallback
          isEmpty={true}
          compact={true}
        />
      </TestWrapper>
    );

    // In compact mode, it should not render a Card wrapper
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
    expect(screen.getByText('No Treasures Found')).toBeInTheDocument();
  });

  it('renders custom title and description', () => {
    render(
      <TestWrapper>
        <RelayErrorFallback
          isEmpty={true}
          title="Custom Title"
          description="Custom description text"
        />
      </TestWrapper>
    );

    expect(screen.getByText('Custom Title')).toBeInTheDocument();
    expect(screen.getByText('Custom description text')).toBeInTheDocument();
  });
});