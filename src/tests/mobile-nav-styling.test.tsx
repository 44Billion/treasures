import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { vi } from 'vitest';
import { MobileHeader, MobileBottomNav } from '@/shared/components/layout/MobileNav';

// Mock the hooks and components
vi.mock('@/features/auth/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: null }),
}));

vi.mock('@/features/geocache/hooks/useLoggedInAccounts', () => ({
  useLoggedInAccounts: () => ({ 
    currentUser: null, 
    removeLogin: vi.fn() 
  }),
}));

vi.mock('@/components/auth/LoginArea', () => ({
  LoginArea: ({ compact }: { compact?: boolean }) => (
    <button data-testid="login-area" className={compact ? 'compact' : ''}>
      Login
    </button>
  ),
}));

vi.mock('@/components/ThemeToggle', () => ({
  ThemeToggle: ({ variant }: { variant?: string }) => (
    <button data-testid="theme-toggle" className={variant || 'default'}>
      Theme
    </button>
  ),
}));

vi.mock('@/components/OfflineIndicator', () => ({
  OfflineIndicator: () => <div data-testid="offline-indicator">Offline</div>,
}));

vi.mock('@/components/RelaySelector', () => ({
  RelaySelector: () => <div data-testid="relay-selector">Relay</div>,
}));

const TestWrapper = ({ children, theme = 'light' }: { children: React.ReactNode; theme?: string }) => {
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
};

describe('Mobile Navigation Styling', () => {
  beforeEach(() => {
    // Reset any theme-related localStorage
    localStorage.clear();
  });

  it('should render MobileHeader with light theme styling', () => {
    render(
      <TestWrapper theme="light">
        <MobileHeader />
      </TestWrapper>
    );

    const header = screen.getByRole('banner');
    expect(header).toBeInTheDocument();
    
    // Check that the header has the correct classes for light theme
    expect(header).toHaveClass('bg-white');
    expect(header).toHaveClass('border-gray-300');
    
    // Check that theme toggle is present
    expect(screen.getByTestId('theme-toggle')).toBeInTheDocument();
    
    // Check that login area is present
    expect(screen.getByTestId('login-area')).toBeInTheDocument();
  });

  it('should render MobileHeader with dark theme styling', () => {
    render(
      <TestWrapper theme="dark">
        <MobileHeader />
      </TestWrapper>
    );

    const header = screen.getByRole('banner');
    expect(header).toBeInTheDocument();
    
    // Check that the header has the correct classes for dark theme
    expect(header).toHaveClass('dark:bg-background/95');
    expect(header).toHaveClass('dark:border-border');
  });

  it('should render MobileHeader with adventure theme styling', () => {
    render(
      <TestWrapper theme="adventure">
        <MobileHeader />
      </TestWrapper>
    );

    const header = screen.getByRole('banner');
    expect(header).toBeInTheDocument();
    
    // Check that the header has the correct classes for adventure theme
    expect(header).toHaveClass('bg-adventure-nav');
    expect(header).toHaveClass('border-adventure-nav');
  });

  it('should render MobileBottomNav with proper navigation items', () => {
    render(
      <TestWrapper theme="light">
        <MobileBottomNav />
      </TestWrapper>
    );

    const nav = screen.getByRole('navigation');
    expect(nav).toBeInTheDocument();
    
    // Check that navigation items are present
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Map')).toBeInTheDocument();
    expect(screen.getByText('Claim')).toBeInTheDocument();
    expect(screen.getByText('New')).toBeInTheDocument();
    
    // Check that the nav has the correct classes for light theme
    expect(nav).toHaveClass('bg-white');
    expect(nav).toHaveClass('border-gray-300');
  });

  it('should have proper contrast for text elements in light theme', () => {
    render(
      <TestWrapper theme="light">
        <MobileHeader />
      </TestWrapper>
    );

    // Check that the logo text has proper contrast
    const logoText = screen.getByText('Treasures');
    expect(logoText).toHaveClass('text-gray-900');
  });

  it('should handle theme switching correctly', () => {
    const { rerender } = render(
      <TestWrapper theme="light">
        <MobileHeader />
      </TestWrapper>
    );

    let header = screen.getByRole('banner');
    expect(header).toHaveClass('bg-white');

    // Switch to dark theme
    rerender(
      <TestWrapper theme="dark">
        <MobileHeader />
      </TestWrapper>
    );

    header = screen.getByRole('banner');
    expect(header).toHaveClass('dark:bg-background/95');
  });
});