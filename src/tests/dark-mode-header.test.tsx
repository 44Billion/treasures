import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { DesktopHeader } from '@/components/DesktopHeader';

// Mock the hooks
vi.mock('@/features/auth/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: null }),
}));

vi.mock('@/components/auth/LoginArea', () => ({
  LoginArea: () => <div data-testid="login-area">Login Area</div>,
}));

vi.mock('@/components/ThemeToggle', () => ({
  ThemeToggle: () => <div data-testid="theme-toggle">Theme Toggle</div>,
}));

vi.mock('@/components/RelaySelector', () => ({
  RelaySelector: () => <div data-testid="relay-selector">Relay Selector</div>,
}));

function TestWrapper({ children, theme = 'light' }: { children: React.ReactNode; theme?: string }) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme={theme} enableSystem={false}>
        <BrowserRouter>
          {children}
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

describe('DesktopHeader Dark Mode', () => {
  it('should use proper background classes for light theme', () => {
    render(
      <TestWrapper theme="light">
        <DesktopHeader />
      </TestWrapper>
    );

    const header = screen.getByRole('banner');
    expect(header).toHaveClass('bg-primary/80');
    expect(header).toHaveClass('backdrop-blur-sm');
    expect(header).toHaveClass('md:bg-primary');
    expect(header).toHaveClass('border-border');
  });

  it('should use proper background classes for dark theme', () => {
    render(
      <TestWrapper theme="dark">
        <DesktopHeader />
      </TestWrapper>
    );

    const header = screen.getByRole('banner');
    // Should use bg-primary which now adapts properly to dark mode via CSS variables
    expect(header).toHaveClass('bg-primary/80');
    expect(header).toHaveClass('backdrop-blur-sm');
    expect(header).toHaveClass('md:bg-primary');
    expect(header).toHaveClass('border-border');
  });

  it('should use adventure theme classes when adventure theme is active', () => {
    render(
      <TestWrapper theme="adventure">
        <DesktopHeader />
      </TestWrapper>
    );

    const header = screen.getByRole('banner');
    expect(header).toHaveClass('bg-adventure-nav');
    expect(header).toHaveClass('border-adventure-nav');
    expect(header).toHaveClass('text-stone-200');
  });

  it('should render all navigation elements', () => {
    render(
      <TestWrapper>
        <DesktopHeader />
      </TestWrapper>
    );

    // Check that main elements are present
    expect(screen.getByText('Treasures')).toBeInTheDocument();
    expect(screen.getByText('Explore Map')).toBeInTheDocument();
    expect(screen.getByText('About')).toBeInTheDocument();
    expect(screen.getByTestId('login-area')).toBeInTheDocument();
    expect(screen.getByTestId('theme-toggle')).toBeInTheDocument();
    expect(screen.getByTestId('relay-selector')).toBeInTheDocument();
  });

  it('should have proper contrast and visibility in dark mode', () => {
    render(
      <TestWrapper theme="dark">
        <DesktopHeader />
      </TestWrapper>
    );

    const header = screen.getByRole('banner');
    
    // Verify the header uses background classes that work with dark mode
    expect(header).toHaveClass('bg-primary/80');
    expect(header).toHaveClass('md:bg-primary');
    
    // The bg-primary class now uses CSS variables that adapt properly to dark mode
    // In dark mode: --primary: 210 40% 98% (light color for contrast)
    // In light mode: --primary: 222.2 47.4% 11.2% (dark color for contrast)
  });
});