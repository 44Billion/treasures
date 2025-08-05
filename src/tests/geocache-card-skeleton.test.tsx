import { render, screen } from '@testing-library/react';
import { GeocacheCard } from '@/features/geocache/components/geocache-card';
import { describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom';

// Mock the components that are not directly related to the test
vi.mock('@/components/ui/skeleton', () => ({
  Skeleton: ({ className, ...props }: any) => (
    <div data-testid="skeleton" className={className} {...props} />
  ),
}));

vi.mock('@/components/ui/card-patterns', () => ({
  InteractiveCard: ({ children, compact, ...props }: any) => (
    <div data-testid="interactive-card" data-compact={compact} {...props}>
      {children}
    </div>
  ),
}));

vi.mock('@/components/ui/card', () => ({
  CardContent: ({ children, ...props }: any) => (
    <div data-testid="card-content" {...props}>
      {children}
    </div>
  ),
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, ...props }: any) => (
    <span data-testid="badge" {...props}>
      {children}
    </span>
  ),
}));

vi.mock('@/components/CacheMenu', () => ({
  CacheMenu: () => <div data-testid="cache-menu" />,
}));

vi.mock('@/shared/components/common/SaveButton', () => ({
  SaveButton: () => <div data-testid="save-button" />,
}));

vi.mock('@/features/auth/hooks/useAuthor', () => ({
  useAuthor: () => ({
    data: null,
    isLoading: false,
  }),
}));

vi.mock('@/features/geocache/hooks/useGeocacheNavigation', () => ({
  useGeocacheNavigation: () => ({
    navigateToGeocache: vi.fn(),
  }),
}));

vi.mock('@/features/auth/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    user: null,
  }),
}));

vi.mock('next-themes', () => ({
  useTheme: () => ({
    theme: 'light',
  }),
}));

describe('GeocacheCard Skeleton Loading', () => {
  const mockCache = {
    id: 'test-id',
    dTag: 'test-dtag',
    pubkey: 'test-pubkey',
    name: 'Test Cache',
    location: { lat: 40.7128, lng: -74.0060 },
    difficulty: 2,
    terrain: 3,
    size: 'regular' as const,
    type: 'traditional' as const,
    foundCount: 5,
    logCount: 10,
    zapTotal: 1000,
  };

  it('should show actual stats when statsLoading is false', () => {
    render(
      <GeocacheCard
        cache={mockCache}
        variant="default"
        statsLoading={false}
      />
    );

    // Should show the actual stats values
    expect(screen.getByText('1,000')).toBeInTheDocument(); // zap total
    expect(screen.getByText('5')).toBeInTheDocument(); // found count
    expect(screen.getByText('10')).toBeInTheDocument(); // log count
    
    // Should not show any skeletons
    expect(screen.queryByTestId('skeleton')).not.toBeInTheDocument();
  });

  it('should show skeleton stats when statsLoading is true', () => {
    render(
      <GeocacheCard
        cache={mockCache}
        variant="default"
        statsLoading={true}
      />
    );

    // Should show skeleton elements instead of actual stats
    expect(screen.queryByText('1,000')).not.toBeInTheDocument(); // zap total should not be visible
    expect(screen.queryByText('5')).not.toBeInTheDocument(); // found count should not be visible
    expect(screen.queryByText('10')).not.toBeInTheDocument(); // log count should not be visible
    
    // Should show skeleton elements with appropriate sizes
    const skeletons = screen.getAllByTestId('skeleton');
    expect(skeletons.length).toBe(3); // One for each stat
    
    // Check that skeletons have appropriate width classes (small sizes)
    const zapSkeleton = skeletons[0];
    const foundSkeleton = skeletons[1];
    const logSkeleton = skeletons[2];
    
    // Check that skeletons have small width classes (the actual implementation uses w-3 and w-4)
    expect(zapSkeleton?.className).toMatch(/w-\d+/); // Should have some width class
    expect(foundSkeleton?.className).toMatch(/w-\d+/); // Should have some width class
    expect(logSkeleton?.className).toMatch(/w-\d+/); // Should have some width class
    
    // Check that they don't have large width classes
    expect(zapSkeleton?.className).not.toMatch(/w-1[2-9]/); // Should not have large widths
    expect(foundSkeleton?.className).not.toMatch(/w-1[2-9]/); // Should not have large widths
    expect(logSkeleton?.className).not.toMatch(/w-1[2-9]/); // Should not have large widths
  });

  it('should show skeleton stats in compact variant when statsLoading is true', () => {
    render(
      <GeocacheCard
        cache={mockCache}
        variant="compact"
        statsLoading={true}
      />
    );

    // Should show skeleton elements instead of actual stats
    expect(screen.queryByText('1,000')).not.toBeInTheDocument();
    expect(screen.queryByText('5')).not.toBeInTheDocument();
    expect(screen.queryByText('10')).not.toBeInTheDocument();
    
    // Should show skeleton elements with appropriate sizes
    const skeletons = screen.getAllByTestId('skeleton');
    expect(skeletons.length).toBe(3); // One for each stat
    
    // Check that skeletons have appropriate width classes for compact variant
    const zapSkeleton = skeletons[0];
    const foundSkeleton = skeletons[1];
    const logSkeleton = skeletons[2];
    
    // Check that skeletons have small width classes for compact variant
    expect(zapSkeleton?.className).toMatch(/w-\d+/); // Should have some width class
    expect(foundSkeleton?.className).toMatch(/w-\d+/); // Should have some width class
    expect(logSkeleton?.className).toMatch(/w-\d+/); // Should have some width class
    
    // Check that they don't have large width classes
    expect(zapSkeleton?.className).not.toMatch(/w-1[2-9]/); // Should not have large widths
    expect(foundSkeleton?.className).not.toMatch(/w-1[2-9]/); // Should not have large widths
    expect(logSkeleton?.className).not.toMatch(/w-1[2-9]/); // Should not have large widths
  });

  it('should not show stats when showStats is false', () => {
    render(
      <GeocacheCard
        cache={mockCache}
        variant="default"
        showStats={false}
        statsLoading={true}
      />
    );

    // Should not show any stats or skeletons
    expect(screen.queryByText('1,000')).not.toBeInTheDocument();
    expect(screen.queryByText('5')).not.toBeInTheDocument();
    expect(screen.queryByText('10')).not.toBeInTheDocument();
    expect(screen.queryByTestId('skeleton')).not.toBeInTheDocument();
  });

  it('should show actual stats when statsLoading is false in compact variant', () => {
    render(
      <GeocacheCard
        cache={mockCache}
        variant="compact"
        statsLoading={false}
      />
    );

    // Should show the actual stats values
    expect(screen.getByText('1,000')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    
    // Should not show any skeletons
    expect(screen.queryByTestId('skeleton')).not.toBeInTheDocument();
  });
});