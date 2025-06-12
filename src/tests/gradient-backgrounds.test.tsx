import { render } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';
import Profile from '@/pages/Profile';
import MyCaches from '@/pages/MyCaches';
import Claim from '@/pages/Claim';

// Mock the hooks and components that these pages depend on
vi.mock('@/features/auth/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: null })
}));

vi.mock('@/features/auth/hooks/useAuthor', () => ({
  useAuthor: () => ({ data: null, isLoading: false })
}));

vi.mock('@/features/geocache/hooks/useUserGeocaches', () => ({
  useUserGeocaches: () => ({ data: [], isLoading: false })
}));

vi.mock('@/features/profile/hooks/useUserFoundCaches', () => ({
  useUserFoundCaches: () => ({ data: [], isLoading: false })
}));

vi.mock('@/features/geocache/hooks/useSavedCaches', () => ({
  useSavedCaches: () => ({ 
    savedCaches: [], 
    isLoading: false,
    unsaveCache: vi.fn(),
    clearAllSaved: vi.fn(),
    isNostrEnabled: true
  })
}));

vi.mock('@/features/profile/hooks/useNip05Verification', () => ({
  useNip05Status: () => ({ 
    isVerified: false, 
    isLoading: false, 
    error: null 
  })
}));

vi.mock('@/features/map/hooks/useGeolocation', () => ({
  useGeolocation: () => ({ coords: null })
}));

vi.mock('@/features/offline/hooks/useOfflineStorage', () => ({
  useOfflineMode: () => ({ 
    isOnline: true, 
    isOfflineMode: false 
  })
}));

vi.mock('@/shared/hooks/useToast', () => ({
  useToast: () => ({ toast: vi.fn() })
}));

const TestWrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {children}
      </BrowserRouter>
    </QueryClientProvider>
  );
};

describe('Gradient Backgrounds', () => {
  it('Profile page should use correct dark mode gradient', () => {
    const { container } = render(
      <TestWrapper>
        <Profile />
      </TestWrapper>
    );

    const gradientElement = container.querySelector('.dark\\:from-slate-900');
    expect(gradientElement).toBeInTheDocument();
    expect(gradientElement).toHaveClass('dark:via-green-950');
    expect(gradientElement).toHaveClass('dark:to-emerald-950');
  });

  it('MyCaches page should use correct dark mode gradient', () => {
    const { container } = render(
      <TestWrapper>
        <MyCaches />
      </TestWrapper>
    );

    const gradientElement = container.querySelector('.dark\\:from-slate-900');
    expect(gradientElement).toBeInTheDocument();
    expect(gradientElement).toHaveClass('dark:via-green-950');
    expect(gradientElement).toHaveClass('dark:to-emerald-950');
  });

  it('Claim page should use correct dark mode gradient', () => {
    const { container } = render(
      <TestWrapper>
        <Claim />
      </TestWrapper>
    );

    const gradientElement = container.querySelector('.dark\\:from-slate-900');
    expect(gradientElement).toBeInTheDocument();
    expect(gradientElement).toHaveClass('dark:via-green-950');
    expect(gradientElement).toHaveClass('dark:to-emerald-950');
  });

  it('should not use the old transparent gradient pattern', () => {
    const { container: profileContainer } = render(
      <TestWrapper>
        <Profile />
      </TestWrapper>
    );

    const { container: myCachesContainer } = render(
      <TestWrapper>
        <MyCaches />
      </TestWrapper>
    );

    const { container: claimContainer } = render(
      <TestWrapper>
        <Claim />
      </TestWrapper>
    );

    // Check that none of the pages use the old transparent gradient
    expect(profileContainer.querySelector('.dark\\:from-green-950\\/40')).not.toBeInTheDocument();
    expect(myCachesContainer.querySelector('.dark\\:from-green-950\\/40')).not.toBeInTheDocument();
    expect(claimContainer.querySelector('.dark\\:from-green-950\\/40')).not.toBeInTheDocument();
  });
});