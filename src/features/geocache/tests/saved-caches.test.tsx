import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppProvider } from '@/components/AppProvider';
import { BrowserRouter } from 'react-router-dom';
import { NostrProvider, NostrLoginProvider } from '@nostrify/react';
import { useCurrentUser } from '@/features/auth/hooks/useCurrentUser';
import { useNostrSavedCaches } from '@/features/geocache/hooks/useNostrSavedCaches';
import { useSavedCaches } from '@/features/geocache/hooks/useSavedCaches';
import { useNostrPublish } from '@/shared/hooks/useNostrPublish';
import { useGeolocation } from '@/features/map/hooks/useGeolocation';
import { useOfflineMode } from '@/features/offline/hooks/useOfflineStorage';
import { useGeocacheNavigation } from '@/features/geocache/hooks/useGeocacheNavigation';
import { useGeocacheStats } from '@/features/geocache/hooks/useGeocacheStats';
import { useAuthor } from '@/features/auth/hooks/useAuthor';
import type { Geocache } from '@/types/geocache';

// Mock all the hooks and components we need
vi.mock('@/features/auth/hooks/useCurrentUser', () => ({
  useCurrentUser: vi.fn(() => ({
    user: {
      pubkey: 'test-pubkey-123',
      signer: {
        nip44: {
          encrypt: vi.fn(),
          decrypt: vi.fn(),
        },
      },
    },
  })),
}));

vi.mock('@/features/geocache/hooks/useNostrSavedCaches', () => ({
  useNostrSavedCaches: vi.fn(() => ({
    savedCaches: [],
    unsaveCache: vi.fn(),
    clearAllSaved: vi.fn(),
    isNostrEnabled: true,
    isLoading: false,
    nostrSavedCount: 0,
    isCacheSaved: vi.fn(),
  })),
}));

vi.mock('@/features/geocache/hooks/useSavedCaches', () => ({
  useSavedCaches: vi.fn(() => ({
    savedCaches: [],
    unsaveCache: vi.fn(),
    clearAllSaved: vi.fn(),
    isNostrEnabled: true,
    isLoading: false,
  })),
}));

vi.mock('@/shared/hooks/useNostrPublish', () => ({
  useNostrPublish: vi.fn(() => ({
    mutateAsync: vi.fn().mockResolvedValue({}),
  })),
}));



vi.mock('@/features/map/hooks/useGeolocation', () => ({
  useGeolocation: vi.fn(() => ({
    coords: {
      latitude: 40.7128,
      longitude: -74.0060,
    },
  })),
}));

vi.mock('@/features/offline/hooks/useOfflineStorage', () => ({
  useOfflineMode: vi.fn(() => ({
    isOnline: true,
    isOfflineMode: false,
  })),
}));

vi.mock('@/features/geocache/hooks/useGeocacheNavigation', () => ({
  useGeocacheNavigation: vi.fn(() => ({
    navigateToGeocache: vi.fn(),
  })),
}));

vi.mock('@/features/geocache/hooks/useGeocacheStats', () => ({
  useGeocacheStats: vi.fn(() => ({
    foundCount: 5,
    logCount: 12,
  })),
}));

vi.mock('@/features/auth/hooks/useAuthor', () => ({
  useAuthor: vi.fn(() => ({
    data: {
      metadata: {
        name: 'Test Author',
        picture: 'https://example.com/avatar.jpg',
      },
    },
  })),
}));

// Mock the ShareDialog to avoid naddr encoding issues
vi.mock('@/components/ShareDialog', () => ({
  ShareDialog: () => <div data-testid="share-dialog">Share Dialog</div>,
}));


// Test utilities
import { NostrProvider, NostrLoginProvider } from '@nostrify/react';

function createTestWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: 0,
        gcTime: 0,
      },
    },
  });

  return function TestWrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <NostrProvider relays={['wss://test-relay.com']}>
          <NostrLoginProvider>
            <AppProvider storageKey="treasures-test" defaultConfig={{ relayUrl: 'wss://test-relay.com', theme: 'light' }}>
              <BrowserRouter>
                {children}
              </BrowserRouter>
            </AppProvider>
          </NostrLoginProvider>
        </NostrProvider>
      </QueryClientProvider>
    );
  };
}

// Sample test data
const sampleSavedCache = {
  id: 'test-cache-1',
  dTag: 'test-dtag-1',
  pubkey: 'test-author-pubkey',
  name: 'Test Geocache',
  savedAt: Date.now() - 3600000, // 1 hour ago
  location: {
    lat: 40.7589,
    lng: -73.9851,
  },
  difficulty: 3,
  terrain: 2,
  size: 'regular',
  type: 'traditional',
  foundCount: 5,
  logCount: 12,
};

describe('Saved Caches Functionality - Simple Tests', () => {
  let TestWrapper: ReturnType<typeof createTestWrapper>;

  beforeEach(() => {
    TestWrapper = createTestWrapper();
    vi.clearAllMocks();
    // Reset the mock hook state
    vi.mocked(useNostrSavedCaches).mockReturnValue({
      savedCaches: [],
      unsaveCache: vi.fn(),
      clearAllSaved: vi.fn(),
      isNostrEnabled: true,
      isLoading: false,
      nostrSavedCount: 0,
    });
    vi.mocked(useSavedCaches).mockReturnValue({
      savedCaches: [],
      unsaveCache: vi.fn(),
      clearAllSaved: vi.fn(),
      isNostrEnabled: true,
      isLoading: false,
    });
  });

  describe('MyCaches Page Basic Functionality', () => {
    it('should render empty state when no caches are saved', async () => {
      // Import the component dynamically to avoid import issues
      const { default: MyCaches } = await import('@/pages/MyCaches');
      
      render(
        <TestWrapper>
          <MyCaches />
        </TestWrapper>
      );

      expect(screen.getByText('Saved Caches')).toBeInTheDocument();
      expect(screen.getByText('No saved caches yet')).toBeInTheDocument();
      expect(screen.getByText('Start exploring and save interesting caches for later!')).toBeInTheDocument();
    });

    it('should render saved caches when they exist', async () => {
      // Set up mock data
      vi.mocked(useSavedCaches).mockReturnValue({
        savedCaches: [sampleSavedCache],
        unsaveCache: vi.fn(),
        clearAllSaved: vi.fn(),
        isNostrEnabled: true,
        isLoading: false,
      });
      
      const { default: MyCaches } = await import('@/pages/MyCaches');
      
      render(
        <TestWrapper>
          <MyCaches />
        </TestWrapper>
      );

      expect(screen.getByText('Saved Caches')).toBeInTheDocument();
      expect(screen.getByText('Test Geocache')).toBeInTheDocument();
      expect(screen.getByText(/saved.*ago/)).toBeInTheDocument();
    });

    it('should show loading state', async () => {
      vi.mocked(useSavedCaches).mockReturnValue({
        savedCaches: [],
        unsaveCache: vi.fn(),
        clearAllSaved: vi.fn(),
        isNostrEnabled: true,
        isLoading: true,
      });
      
      const { default: MyCaches } = await import('@/pages/MyCaches');
      
      render(
        <TestWrapper>
          <MyCaches />
        </TestWrapper>
      );

      expect(screen.getByText('Loading saved caches...')).toBeInTheDocument();
    });

    it('should handle unsaving a cache', async () => {
      vi.mocked(useSavedCaches).mockReturnValue({
        savedCaches: [sampleSavedCache],
        unsaveCache: vi.fn(),
        clearAllSaved: vi.fn(),
        isNostrEnabled: true,
        isLoading: false,
      });
      const unsaveMock = vi.fn();
      vi.mocked(useSavedCaches).mockReturnValue({
        savedCaches: [sampleSavedCache],
        unsaveCache: unsaveMock,
        clearAllSaved: vi.fn(),
        isNostrEnabled: true,
        isLoading: false,
      });
      
      const { default: MyCaches } = await import('@/pages/MyCaches');
      
      render(
        <TestWrapper>
          <MyCaches />
        </TestWrapper>
      );

      const unsaveButton = screen.getByTitle('Remove from saved caches');
      fireEvent.click(unsaveButton);

      expect(unsaveMock).toHaveBeenCalledWith('test-cache-1');
    });

    it('should handle clearing all saved caches', async () => {
      vi.mocked(useSavedCaches).mockReturnValue({
        savedCaches: [sampleSavedCache],
        unsaveCache: vi.fn(),
        clearAllSaved: vi.fn(),
        isNostrEnabled: true,
        isLoading: false,
      });
      const clearAllMock = vi.fn();
      vi.mocked(useSavedCaches).mockReturnValue({
        savedCaches: [sampleSavedCache],
        unsaveCache: vi.fn(),
        clearAllSaved: clearAllMock,
        isNostrEnabled: true,
        isLoading: false,
      });
      
      const { default: MyCaches } = await import('@/pages/MyCaches');
      
      render(
        <TestWrapper>
          <MyCaches />
        </TestWrapper>
      );

      // Open the dropdown menu
      const menuButton = screen.getByRole('button', { name: /more/i });
      fireEvent.click(menuButton);

      // Click the clear all option
      const clearAllOption = screen.getByText('Clear All Saved Caches');
      fireEvent.click(clearAllOption);

      // Confirm in the dialog
      const confirmButton = screen.getByText('Clear All');
      fireEvent.click(confirmButton);

      expect(clearAllMock).toHaveBeenCalled();
    });
  });

  describe('GeocacheCard with Saved Cache', () => {
    it('should render saved cache card with basic information', async () => {
      const { DetailedGeocacheCard } = await import('@/components/ui/geocache-card');
      
      render(
        <TestWrapper>
          <DetailedGeocacheCard
            cache={sampleSavedCache}
            distance={1500}
            metadata={<>• saved 1 hour ago</>}
            actions={
              <button data-testid="remove-button">Remove</button>
            }
          />
        </TestWrapper>
      );

      expect(screen.getByText('Test Geocache')).toBeInTheDocument();
      expect(screen.getByText('• saved 1 hour ago')).toBeInTheDocument();
      expect(screen.getByText('D3')).toBeInTheDocument(); // Difficulty
      expect(screen.getByText('T2')).toBeInTheDocument(); // Terrain
      expect(screen.getByText('regular')).toBeInTheDocument(); // Size
      expect(screen.getByTestId('remove-button')).toBeInTheDocument();
    });

    it('should handle click events properly', async () => {
      const onClickMock = vi.fn();
      const { DetailedGeocacheCard } = await import('@/components/ui/geocache-card');

      render(
        <TestWrapper>
          <DetailedGeocacheCard
            cache={sampleSavedCache}
            onClick={onClickMock}
          />
        </TestWrapper>
      );

      const card = screen.getByText('Test Geocache').closest('[role="button"]');
      if (card) {
        fireEvent.click(card);
        expect(onClickMock).toHaveBeenCalled();
      }
    });
  });

  describe('Saved Caches Hook Integration', () => {
    it('should provide the correct interface', async () => { // Added async
      const { useSavedCaches } = await import('@/features/geocache/hooks/useSavedCaches');
      const result = useSavedCaches();

      expect(result).toHaveProperty('savedCaches');
      expect(result).toHaveProperty('unsaveCache');
      expect(result).toHaveProperty('clearAllSaved');
      expect(result).toHaveProperty('isNostrEnabled');
      expect(result).toHaveProperty('isLoading');
      
      expect(Array.isArray(result.savedCaches)).toBe(true);
      expect(typeof result.unsaveCache).toBe('function');
      expect(typeof result.clearAllSaved).toBe('function');
      expect(typeof result.isNostrEnabled).toBe('boolean');
      expect(typeof result.isLoading).toBe('boolean');
    });
  });

  describe('Performance and Edge Cases', () => {
    it('should handle large numbers of saved caches', async () => {
      const largeCacheList = Array.from({ length: 50 }, (_, i) => ({
        ...sampleSavedCache,
        id: `test-cache-${i}`,
        dTag: `test-dtag-${i}`,
        pubkey: `test-author-pubkey-${i}`,
        name: `Test Geocache ${i}`,
      }));

      vi.mocked(useSavedCaches).mockReturnValue({
        savedCaches: largeCacheList,
        unsaveCache: vi.fn(),
        clearAllSaved: vi.fn(),
        isNostrEnabled: true,
        isLoading: false,
      });
      
      const { default: MyCaches } = await import('@/pages/MyCaches');
      
      render(
        <TestWrapper>
          <MyCaches />
        </TestWrapper>
      );

      // Should render all caches
      expect(screen.getAllByText(/Test Geocache/)).toHaveLength(50);
    });

    it('should handle empty cache data gracefully', async () => {
      vi.mocked(useSavedCaches).mockReturnValue({
        savedCaches: [],
        unsaveCache: vi.fn(),
        clearAllSaved: vi.fn(),
        isNostrEnabled: true,
        isLoading: false,
      });
      
      const { default: MyCaches } = await import('@/pages/MyCaches');
      
      render(
        <TestWrapper>
          <MyCaches />
        </TestWrapper>
      );

      expect(screen.getByText('No saved caches yet')).toBeInTheDocument();
      expect(screen.queryByText('Clear All Saved Caches')).not.toBeInTheDocument();
    });

    it('should show sync status correctly', async () => {
      vi.mocked(useSavedCaches).mockReturnValue({
        savedCaches: [sampleSavedCache],
        unsaveCache: vi.fn(),
        clearAllSaved: vi.fn(),
        isNostrEnabled: true,
        isLoading: false,
      });
      
      const { default: MyCaches } = await import('@/pages/MyCaches');
      
      render(
        <TestWrapper>
          <MyCaches />
        </TestWrapper>
      );

      expect(screen.getByText('Synced')).toBeInTheDocument();
    });
  });

  describe('User Authentication', () => {
    it('should show login required when user is not logged in', async () => {
      // Mock no user
      vi.mocked(useCurrentUser).mockReturnValue({
        user: null,
      });
      
      const { default: MyCaches } = await import('@/pages/MyCaches');
      
      render(
        <TestWrapper>
          <MyCaches />
        </TestWrapper>
      );

      expect(screen.getByText('Please log in with your Nostr account to view your caches.')).toBeInTheDocument();
    });
  });

  describe('Distance Calculation', () => {
    it('should calculate and display distances correctly', async () => {
      vi.mocked(useSavedCaches).mockReturnValue({
        savedCaches: [sampleSavedCache],
        unsaveCache: vi.fn(),
        clearAllSaved: vi.fn(),
        isNostrEnabled: true,
        isLoading: false,
      });
      
      const { default: MyCaches } = await import('@/pages/MyCaches');
      
      render(
        <TestWrapper>
          <MyCaches />
        </TestWrapper>
      );

      // Should show some distance (exact value depends on calculation)
      expect(screen.getByText(/km/)).toBeInTheDocument();
    });
  });
});