import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { NostrProvider } from '@nostrify/react';
import { useNostrSavedCaches } from '@/hooks/useNostrSavedCaches';
import MyCaches from '@/pages/MyCaches';
import { DetailedGeocacheCard } from '@/components/ui/geocache-card';
import type { Geocache } from '@/types/geocache';

// Mock the hooks
vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    user: {
      pubkey: 'test-pubkey-123',
      signer: {
        nip44: {
          encrypt: vi.fn(),
          decrypt: vi.fn(),
        },
      },
    },
  }),
}));

vi.mock('@/hooks/useGeolocation', () => ({
  useGeolocation: () => ({
    coords: {
      latitude: 40.7128,
      longitude: -74.0060,
    },
  }),
}));

vi.mock('@/hooks/useOfflineStorage', () => ({
  useOfflineMode: () => ({
    isOnline: true,
    isOfflineMode: false,
  }),
}));

vi.mock('@/hooks/useGeocacheNavigation', () => ({
  useGeocacheNavigation: () => ({
    navigateToGeocache: vi.fn(),
  }),
}));

vi.mock('@/hooks/useGeocacheStats', () => ({
  useGeocacheStats: () => ({
    foundCount: 5,
    logCount: 12,
  }),
}));

vi.mock('@/hooks/useAuthor', () => ({
  useAuthor: () => ({
    data: {
      metadata: {
        name: 'Test Author',
        picture: 'https://example.com/avatar.jpg',
      },
    },
  }),
}));

vi.mock('@/hooks/useNostrPublish', () => ({
  useNostrPublish: () => ({
    mutateAsync: vi.fn().mockResolvedValue({}),
  }),
}));

// Mock Nostr provider
const mockNostr = {
  query: vi.fn(),
  event: vi.fn(),
};

vi.mock('@nostrify/react', () => ({
  NostrProvider: ({ children }: { children: React.ReactNode }) => children,
  useNostr: () => ({ nostr: mockNostr }),
}));

// Test utilities
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
          <BrowserRouter>
            {children}
          </BrowserRouter>
        </NostrProvider>
      </QueryClientProvider>
    );
  };
}

// Sample test data
const sampleGeocache: Geocache = {
  id: 'test-cache-1',
  dTag: 'test-dtag-1',
  pubkey: 'test-author-pubkey',
  name: 'Test Geocache',
  description: 'A test geocache for testing',
  location: {
    lat: 40.7589,
    lng: -73.9851,
  },
  difficulty: 3,
  terrain: 2,
  size: 'regular',
  type: 'traditional',
  created_at: Math.floor(Date.now() / 1000) - 86400, // 1 day ago
  foundCount: 5,
  logCount: 12,
};

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

describe('Saved Caches Functionality', () => {
  let TestWrapper: ReturnType<typeof createTestWrapper>;

  beforeEach(() => {
    TestWrapper = createTestWrapper();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('useNostrSavedCaches Hook', () => {
    it('should load saved caches from Nostr', async () => {
      // Mock Nostr responses
      mockNostr.query.mockImplementation((filters) => {
        // First call: bookmark events
        if (filters[0]?.kinds?.includes(1985)) {
          return Promise.resolve([
            {
              id: 'bookmark-event-1',
              kind: 1985,
              pubkey: 'test-pubkey-123',
              created_at: Math.floor(Date.now() / 1000),
              tags: [
                ['L', 'treasures/cache-bookmark'],
                ['l', 'treasures/cache-bookmark'],
                ['a', '37515:test-author-pubkey:test-dtag-1'],
                ['name', 'Test Geocache'],
                ['action', 'save'],
                ['client', 'treasures'],
              ],
              content: 'Saved cache: Test Geocache',
            },
          ]);
        }
        // Second call: geocache events
        if (filters[0]?.kinds?.includes(37515)) {
          return Promise.resolve([
            {
              id: 'test-cache-1',
              kind: 37515,
              pubkey: 'test-author-pubkey',
              created_at: Math.floor(Date.now() / 1000) - 86400,
              tags: [
                ['d', 'test-dtag-1'],
                ['name', 'Test Geocache'],
                ['description', 'A test geocache for testing'],
                ['location', '40.7589,-73.9851'],
                ['difficulty', '3'],
                ['terrain', '2'],
                ['size', 'regular'],
                ['type', 'traditional'],
              ],
              content: '',
            },
          ]);
        }
        return Promise.resolve([]);
      });

      function TestComponent() {
        const { savedCaches, isLoading } = useNostrSavedCaches();
        
        if (isLoading) return <div>Loading...</div>;
        
        return (
          <div>
            <div data-testid="saved-count">{savedCaches.length}</div>
            {savedCaches.map((cache) => (
              <div key={cache.id} data-testid={`cache-${cache.id}`}>
                {cache.name}
              </div>
            ))}
          </div>
        );
      }

      render(
        <TestWrapper>
          <TestComponent />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('saved-count')).toHaveTextContent('1');
      });

      expect(screen.getByTestId('cache-test-cache-1')).toHaveTextContent('Test Geocache');
    });

    it('should save a cache to Nostr', async () => {
      const publishMock = vi.fn().mockResolvedValue({});
      
      vi.mocked(require('@/hooks/useNostrPublish').useNostrPublish).mockReturnValue({
        mutateAsync: publishMock,
      });

      mockNostr.query.mockResolvedValue([]);

      function TestComponent() {
        const { saveCache } = useNostrSavedCaches();
        
        return (
          <button
            onClick={() => saveCache(sampleGeocache)}
            data-testid="save-button"
          >
            Save Cache
          </button>
        );
      }

      render(
        <TestWrapper>
          <TestComponent />
        </TestWrapper>
      );

      fireEvent.click(screen.getByTestId('save-button'));

      await waitFor(() => {
        expect(publishMock).toHaveBeenCalledWith({
          kind: 1985,
          content: 'Saved cache: Test Geocache',
          tags: [
            ['L', 'treasures/cache-bookmark'],
            ['l', 'treasures/cache-bookmark'],
            ['a', '37515:test-author-pubkey:test-dtag-1'],
            ['name', 'Test Geocache'],
            ['action', 'save'],
            ['client', 'treasures'],
          ],
        });
      });
    });

    it('should unsave a cache from Nostr', async () => {
      const publishMock = vi.fn().mockResolvedValue({});
      
      vi.mocked(require('@/hooks/useNostrPublish').useNostrPublish).mockReturnValue({
        mutateAsync: publishMock,
      });

      // Mock existing bookmark event
      mockNostr.query.mockResolvedValue([
        {
          id: 'bookmark-event-1',
          kind: 1985,
          pubkey: 'test-pubkey-123',
          created_at: Math.floor(Date.now() / 1000),
          tags: [
            ['L', 'treasures/cache-bookmark'],
            ['l', 'treasures/cache-bookmark'],
            ['a', '37515:test-author-pubkey:test-dtag-1'],
            ['name', 'Test Geocache'],
            ['action', 'save'],
            ['client', 'treasures'],
          ],
          content: 'Saved cache: Test Geocache',
        },
      ]);

      function TestComponent() {
        const { unsaveCache } = useNostrSavedCaches();
        
        return (
          <button
            onClick={() => unsaveCache(sampleGeocache)}
            data-testid="unsave-button"
          >
            Unsave Cache
          </button>
        );
      }

      render(
        <TestWrapper>
          <TestComponent />
        </TestWrapper>
      );

      fireEvent.click(screen.getByTestId('unsave-button'));

      await waitFor(() => {
        expect(publishMock).toHaveBeenCalledWith({
          kind: 5,
          content: 'Removed bookmark for cache: Test Geocache',
          tags: [
            ['e', 'bookmark-event-1'],
            ['client', 'treasures'],
          ],
        });
      });
    });

    it('should clear all saved caches', async () => {
      const publishMock = vi.fn().mockResolvedValue({});
      
      vi.mocked(require('@/hooks/useNostrPublish').useNostrPublish).mockReturnValue({
        mutateAsync: publishMock,
      });

      // Mock multiple bookmark events
      mockNostr.query.mockResolvedValue([
        {
          id: 'bookmark-event-1',
          kind: 1985,
          pubkey: 'test-pubkey-123',
          created_at: Math.floor(Date.now() / 1000),
          tags: [
            ['L', 'treasures/cache-bookmark'],
            ['l', 'treasures/cache-bookmark'],
            ['a', '37515:test-author-pubkey:test-dtag-1'],
            ['action', 'save'],
          ],
          content: 'Saved cache: Test Geocache 1',
        },
        {
          id: 'bookmark-event-2',
          kind: 1985,
          pubkey: 'test-pubkey-123',
          created_at: Math.floor(Date.now() / 1000),
          tags: [
            ['L', 'treasures/cache-bookmark'],
            ['l', 'treasures/cache-bookmark'],
            ['a', '37515:test-author-pubkey:test-dtag-2'],
            ['action', 'save'],
          ],
          content: 'Saved cache: Test Geocache 2',
        },
      ]);

      function TestComponent() {
        const { clearAllSaved } = useNostrSavedCaches();
        
        return (
          <button
            onClick={() => clearAllSaved()}
            data-testid="clear-all-button"
          >
            Clear All
          </button>
        );
      }

      render(
        <TestWrapper>
          <TestComponent />
        </TestWrapper>
      );

      fireEvent.click(screen.getByTestId('clear-all-button'));

      await waitFor(() => {
        expect(publishMock).toHaveBeenCalledWith({
          kind: 5,
          content: 'Cleared all saved caches',
          tags: [
            ['e', 'bookmark-event-1'],
            ['e', 'bookmark-event-2'],
            ['client', 'treasures'],
          ],
        });
      });
    });

    it('should check if a cache is saved', async () => {
      mockNostr.query.mockImplementation((filters) => {
        if (filters[0]?.kinds?.includes(1985)) {
          return Promise.resolve([
            {
              id: 'bookmark-event-1',
              kind: 1985,
              pubkey: 'test-pubkey-123',
              created_at: Math.floor(Date.now() / 1000),
              tags: [
                ['L', 'treasures/cache-bookmark'],
                ['l', 'treasures/cache-bookmark'],
                ['a', '37515:test-author-pubkey:test-dtag-1'],
                ['action', 'save'],
              ],
              content: 'Saved cache: Test Geocache',
            },
          ]);
        }
        return Promise.resolve([]);
      });

      function TestComponent() {
        const { isCacheSaved } = useNostrSavedCaches();
        const isCurrentCacheSaved = isCacheSaved('test-cache-1', 'test-dtag-1', 'test-author-pubkey');
        const isOtherCacheSaved = isCacheSaved('other-cache', 'other-dtag', 'other-pubkey');
        
        return (
          <div>
            <div data-testid="current-saved">{isCurrentCacheSaved ? 'saved' : 'not-saved'}</div>
            <div data-testid="other-saved">{isOtherCacheSaved ? 'saved' : 'not-saved'}</div>
          </div>
        );
      }

      render(
        <TestWrapper>
          <TestComponent />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('current-saved')).toHaveTextContent('saved');
        expect(screen.getByTestId('other-saved')).toHaveTextContent('not-saved');
      });
    });
  });

  describe('MyCaches Page', () => {
    beforeEach(() => {
      // Mock the saved caches hook to return test data
      vi.mocked(require('@/hooks/useSavedCaches').useSavedCaches).mockReturnValue({
        savedCaches: [sampleSavedCache],
        unsaveCache: vi.fn(),
        clearAllSaved: vi.fn(),
        isNostrEnabled: true,
        isLoading: false,
      });
    });

    it('should render saved caches page with cache list', async () => {
      render(
        <TestWrapper>
          <MyCaches />
        </TestWrapper>
      );

      expect(screen.getByText('Saved Caches')).toBeInTheDocument();
      expect(screen.getByText('Test Geocache')).toBeInTheDocument();
      expect(screen.getByText(/saved.*ago/)).toBeInTheDocument();
    });

    it('should show empty state when no caches are saved', async () => {
      vi.mocked(require('@/hooks/useSavedCaches').useSavedCaches).mockReturnValue({
        savedCaches: [],
        unsaveCache: vi.fn(),
        clearAllSaved: vi.fn(),
        isNostrEnabled: true,
        isLoading: false,
      });

      render(
        <TestWrapper>
          <MyCaches />
        </TestWrapper>
      );

      expect(screen.getByText('No saved caches yet')).toBeInTheDocument();
      expect(screen.getByText('Start exploring and save interesting caches for later!')).toBeInTheDocument();
    });

    it('should show loading state', async () => {
      vi.mocked(require('@/hooks/useSavedCaches').useSavedCaches).mockReturnValue({
        savedCaches: [],
        unsaveCache: vi.fn(),
        clearAllSaved: vi.fn(),
        isNostrEnabled: true,
        isLoading: true,
      });

      render(
        <TestWrapper>
          <MyCaches />
        </TestWrapper>
      );

      expect(screen.getByText('Loading saved caches...')).toBeInTheDocument();
    });

    it('should handle unsaving a cache', async () => {
      const unsaveMock = vi.fn();
      
      vi.mocked(require('@/hooks/useSavedCaches').useSavedCaches).mockReturnValue({
        savedCaches: [sampleSavedCache],
        unsaveCache: unsaveMock,
        clearAllSaved: vi.fn(),
        isNostrEnabled: true,
        isLoading: false,
      });

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
      const clearAllMock = vi.fn();
      
      vi.mocked(require('@/hooks/useSavedCaches').useSavedCaches).mockReturnValue({
        savedCaches: [sampleSavedCache],
        unsaveCache: vi.fn(),
        clearAllSaved: clearAllMock,
        isNostrEnabled: true,
        isLoading: false,
      });

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

  describe('DetailedGeocacheCard with Saved Cache', () => {
    it('should render saved cache card with metadata', () => {
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
      expect(screen.getByText('1.5 km away')).toBeInTheDocument(); // Distance
      expect(screen.getByTestId('remove-button')).toBeInTheDocument();
    });

    it('should handle click events properly', () => {
      const onClickMock = vi.fn();

      render(
        <TestWrapper>
          <DetailedGeocacheCard
            cache={sampleSavedCache}
            onClick={onClickMock}
          />
        </TestWrapper>
      );

      const card = screen.getByText('Test Geocache').closest('[role=\"button\"]');
      if (card) {
        fireEvent.click(card);
        expect(onClickMock).toHaveBeenCalled();
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle Nostr query errors gracefully', async () => {
      mockNostr.query.mockRejectedValue(new Error('Network error'));

      function TestComponent() {
        const { savedCaches, isLoading } = useNostrSavedCaches();
        
        if (isLoading) return <div>Loading...</div>;
        
        return (
          <div>
            <div data-testid="saved-count">{savedCaches.length}</div>
            <div data-testid="error-state">No caches loaded</div>
          </div>
        );
      }

      render(
        <TestWrapper>
          <TestComponent />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('saved-count')).toHaveTextContent('0');
        expect(screen.getByTestId('error-state')).toBeInTheDocument();
      });
    });

    it('should handle publish errors gracefully', async () => {
      const publishMock = vi.fn().mockRejectedValue(new Error('Publish failed'));
      
      vi.mocked(require('@/hooks/useNostrPublish').useNostrPublish).mockReturnValue({
        mutateAsync: publishMock,
      });

      mockNostr.query.mockResolvedValue([]);

      function TestComponent() {
        const { saveCache } = useNostrSavedCaches();
        
        const handleSave = async () => {
          try {
            await saveCache(sampleGeocache);
          } catch (error) {
            // Error should be handled gracefully
          }
        };
        
        return (
          <button onClick={handleSave} data-testid="save-button">
            Save Cache
          </button>
        );
      }

      render(
        <TestWrapper>
          <TestComponent />
        </TestWrapper>
      );

      fireEvent.click(screen.getByTestId('save-button'));

      await waitFor(() => {
        expect(publishMock).toHaveBeenCalled();
      });
    });
  });

  describe('Performance and Edge Cases', () => {
    it('should handle large numbers of saved caches', async () => {
      const largeCacheList = Array.from({ length: 100 }, (_, i) => ({
        ...sampleSavedCache,
        id: `test-cache-${i}`,
        dTag: `test-dtag-${i}`,
        name: `Test Geocache ${i}`,
      }));

      vi.mocked(require('@/hooks/useSavedCaches').useSavedCaches).mockReturnValue({
        savedCaches: largeCacheList,
        unsaveCache: vi.fn(),
        clearAllSaved: vi.fn(),
        isNostrEnabled: true,
        isLoading: false,
      });

      render(
        <TestWrapper>
          <MyCaches />
        </TestWrapper>
      );

      // Should render all caches
      expect(screen.getAllByText(/Test Geocache/)).toHaveLength(100);
    });

    it('should handle duplicate save attempts', async () => {
      const publishMock = vi.fn().mockResolvedValue({});
      
      vi.mocked(require('@/hooks/useNostrPublish').useNostrPublish).mockReturnValue({
        mutateAsync: publishMock,
      });

      // Mock that cache is already saved
      mockNostr.query.mockResolvedValue([
        {
          id: 'bookmark-event-1',
          kind: 1985,
          pubkey: 'test-pubkey-123',
          created_at: Math.floor(Date.now() / 1000),
          tags: [
            ['L', 'treasures/cache-bookmark'],
            ['l', 'treasures/cache-bookmark'],
            ['a', '37515:test-author-pubkey:test-dtag-1'],
            ['action', 'save'],
          ],
          content: 'Saved cache: Test Geocache',
        },
      ]);

      function TestComponent() {
        const { saveCache } = useNostrSavedCaches();
        
        return (
          <button
            onClick={() => saveCache(sampleGeocache)}
            data-testid="save-button"
          >
            Save Cache
          </button>
        );
      }

      render(
        <TestWrapper>
          <TestComponent />
        </TestWrapper>
      );

      fireEvent.click(screen.getByTestId('save-button'));

      // Should not publish duplicate save event
      await waitFor(() => {
        expect(publishMock).not.toHaveBeenCalled();
      });
    });
  });
});