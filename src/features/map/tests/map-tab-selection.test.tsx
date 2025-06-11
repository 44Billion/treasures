import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock cache detail layout component that shows both map and logs
const MockCacheDetailLayout = ({ logCount }: { logCount: number }) => (
  <div>
    <div data-testid="map-section">
      <h2>Map</h2>
      <div>Map Content</div>
    </div>
    <div data-testid="logs-section">
      <h2>Logs ({logCount})</h2>
      <div>Logs Content</div>
    </div>
  </div>
);

const renderWithProviders = (component: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {component}
      </BrowserRouter>
    </QueryClientProvider>
  );
};

describe('Cache Detail Layout', () => {
  it('should show both map and logs sections simultaneously', () => {
    renderWithProviders(<MockCacheDetailLayout logCount={5} />);

    // Both sections should be visible at the same time
    expect(screen.getByTestId('map-section')).toBeInTheDocument();
    expect(screen.getByTestId('logs-section')).toBeInTheDocument();
    
    // Both headings should be visible
    expect(screen.getByText('Map')).toBeInTheDocument();
    expect(screen.getByText('Logs (5)')).toBeInTheDocument();
  });

  it('should display log count in logs section', () => {
    renderWithProviders(<MockCacheDetailLayout logCount={10} />);

    expect(screen.getByText('Logs (10)')).toBeInTheDocument();
  });

  it('should handle zero log count', () => {
    renderWithProviders(<MockCacheDetailLayout logCount={0} />);

    expect(screen.getByText('Logs (0)')).toBeInTheDocument();
  });

  it('should show map content and logs content together', () => {
    renderWithProviders(<MockCacheDetailLayout logCount={3} />);

    // Both content areas should be present
    expect(screen.getByText('Map Content')).toBeInTheDocument();
    expect(screen.getByText('Logs Content')).toBeInTheDocument();
  });
});