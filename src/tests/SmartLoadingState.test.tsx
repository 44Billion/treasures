import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SmartLoadingState } from '@/components/ui/skeleton-patterns';
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
        storageKey="test:smart-loading-state" 
        defaultConfig={defaultConfig}
        presetRelays={PRESET_RELAYS}
      >
        {children}
      </AppProvider>
    </QueryClientProvider>
  );
}

describe('SmartLoadingState', () => {
  it('shows loading skeleton when loading and no data', () => {
    render(
      <TestWrapper>
        <SmartLoadingState
          isLoading={true}
          isError={false}
          hasData={false}
          data={[]}
          skeletonCount={3}
        >
          <div>Content</div>
        </SmartLoadingState>
      </TestWrapper>
    );

    // Should show skeleton loading state
    expect(screen.queryByText('Content')).not.toBeInTheDocument();
    // Skeleton elements should be present (they have animate-pulse class)
    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('shows error state with relay picker when error and no data', () => {
    const mockError = new Error('Network error');
    const mockRetry = vi.fn();

    render(
      <TestWrapper>
        <SmartLoadingState
          isLoading={false}
          isError={true}
          hasData={false}
          data={[]}
          error={mockError}
          onRetry={mockRetry}
          showRelayFallback={true}
        >
          <div>Content</div>
        </SmartLoadingState>
      </TestWrapper>
    );

    expect(screen.getByText('Connection Failed')).toBeInTheDocument();
    expect(screen.getByTestId('relay-selector')).toBeInTheDocument();
    expect(screen.getByText('Retry Current Relay')).toBeInTheDocument();
    expect(screen.queryByText('Content')).not.toBeInTheDocument();
  });

  it('shows empty state with relay picker when no loading, has data, but empty array', () => {
    const mockRetry = vi.fn();

    render(
      <TestWrapper>
        <SmartLoadingState
          isLoading={false}
          isError={false}
          hasData={true}
          data={[]}
          onRetry={mockRetry}
          showRelayFallback={true}
        >
          <div>Content</div>
        </SmartLoadingState>
      </TestWrapper>
    );

    expect(screen.getByText('No Treasures Found')).toBeInTheDocument();
    expect(screen.getByTestId('relay-selector')).toBeInTheDocument();
    expect(screen.getByText('Retry Current Relay')).toBeInTheDocument();
    expect(screen.queryByText('Content')).not.toBeInTheDocument();
  });

  it('shows empty state with relay picker when no loading, has data, but undefined data', () => {
    const mockRetry = vi.fn();

    render(
      <TestWrapper>
        <SmartLoadingState
          isLoading={false}
          isError={false}
          hasData={true}
          data={undefined}
          onRetry={mockRetry}
          showRelayFallback={true}
        >
          <div>Content</div>
        </SmartLoadingState>
      </TestWrapper>
    );

    expect(screen.getByText('No Treasures Found')).toBeInTheDocument();
    expect(screen.getByTestId('relay-selector')).toBeInTheDocument();
    expect(screen.getByText('Retry Current Relay')).toBeInTheDocument();
    expect(screen.queryByText('Content')).not.toBeInTheDocument();
  });

  it('shows content when has data with items', () => {
    render(
      <TestWrapper>
        <SmartLoadingState
          isLoading={false}
          isError={false}
          hasData={true}
          data={[{ id: 1 }, { id: 2 }]}
          showRelayFallback={true}
        >
          <div>Content with data</div>
        </SmartLoadingState>
      </TestWrapper>
    );

    expect(screen.getByText('Content with data')).toBeInTheDocument();
    expect(screen.queryByTestId('relay-selector')).not.toBeInTheDocument();
  });

  it('shows custom empty state when provided', () => {
    render(
      <TestWrapper>
        <SmartLoadingState
          isLoading={false}
          isError={false}
          hasData={true}
          data={[]}
          showRelayFallback={true}
          emptyState={<div>Custom empty state</div>}
        >
          <div>Content</div>
        </SmartLoadingState>
      </TestWrapper>
    );

    expect(screen.getByText('Custom empty state')).toBeInTheDocument();
    expect(screen.queryByText('No Treasures Found')).not.toBeInTheDocument();
    expect(screen.queryByTestId('relay-selector')).not.toBeInTheDocument();
  });

  it('does not show relay picker when showRelayFallback is false', () => {
    render(
      <TestWrapper>
        <SmartLoadingState
          isLoading={false}
          isError={false}
          hasData={true}
          data={[]}
          showRelayFallback={false}
        >
          <div>Content</div>
        </SmartLoadingState>
      </TestWrapper>
    );

    expect(screen.getByText('No geocaches found')).toBeInTheDocument();
    expect(screen.queryByTestId('relay-selector')).not.toBeInTheDocument();
  });

  it('shows content with loading overlay when loading with existing data', () => {
    render(
      <TestWrapper>
        <SmartLoadingState
          isLoading={true}
          isError={false}
          hasData={true}
          data={[{ id: 1 }]}
        >
          <div>Existing content</div>
        </SmartLoadingState>
      </TestWrapper>
    );

    expect(screen.getByText('Existing content')).toBeInTheDocument();
    // Should have opacity class for loading overlay
    const container = screen.getByText('Existing content').parentElement;
    expect(container).toHaveClass('opacity-75');
  });

  it('calls retry function when retry button is clicked', () => {
    const mockRetry = vi.fn();

    render(
      <TestWrapper>
        <SmartLoadingState
          isLoading={false}
          isError={false}
          hasData={true}
          data={[]}
          onRetry={mockRetry}
          showRelayFallback={true}
        >
          <div>Content</div>
        </SmartLoadingState>
      </TestWrapper>
    );

    fireEvent.click(screen.getByText('Retry Current Relay'));
    expect(mockRetry).toHaveBeenCalledTimes(1);
  });
});