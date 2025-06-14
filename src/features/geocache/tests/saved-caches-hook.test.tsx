import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from '@/features/auth/hooks/useCurrentUser';
import { useNostrPublish } from '@/shared/hooks/useNostrPublish';
import { useNostrSavedCaches } from '@/features/geocache/hooks/useNostrSavedCaches';
import { NIP_GC_KINDS } from '@/features/geocache/utils/nip-gc';
import type { Geocache } from '@/types/geocache';
import { NostrEvent } from '@nostrify/nostrify';

// Mock dependencies
vi.mock('@nostrify/react');
vi.mock('@/features/auth/hooks/useCurrentUser');
vi.mock('@/shared/hooks/useNostrPublish');

const mockNostr = {
  query: vi.fn(),
  event: vi.fn(),
};

const mockPublish = vi.fn();

const mockUser = {
  pubkey: 'test-pubkey-123',
  signer: {},
};

const createTestWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

const sampleGeocache: Geocache = {
  id: 'a'.repeat(64),
  dTag: 'dtag1',
  pubkey: 'author1',
  name: 'Test Cache 1',
  location: { lat: 1, lng: 1 },
  created_at: 1,
  difficulty: 1,
  terrain: 1,
  size: 'micro',
  type: 'traditional',
  description: 'desc',
  foundCount: 0,
  logCount: 0,
};

const naddr = `${NIP_GC_KINDS.GEOCACHE}:${sampleGeocache.pubkey}:${sampleGeocache.dTag}`;

const initialBookmarkList: NostrEvent = {
  id: 'bookmark-list-id',
  pubkey: mockUser.pubkey,
  kind: 10003,
  created_at: Date.now() / 1000,
  content: 'bookmarks',
  tags: [['a', naddr]],
  sig: 'sig',
};

describe('useNostrSavedCaches Hook - Correct Implementation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useNostr).mockReturnValue({ nostr: mockNostr });
    vi.mocked(useCurrentUser).mockReturnValue({ user: mockUser });
    vi.mocked(useNostrPublish).mockReturnValue({ mutateAsync: mockPublish });
  });

  it('should fetch the kind 10003 bookmark list and parse saved caches', async () => {
    mockNostr.query.mockResolvedValueOnce([initialBookmarkList]); // For the bookmark list
    mockNostr.query.mockResolvedValueOnce([
      { ...sampleGeocache, kind: NIP_GC_KINDS.GEOCACHE },
    ]); // For the geocache event

    const { result } = renderHook(() => useNostrSavedCaches(), {
      wrapper: createTestWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockNostr.query).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ kinds: [10003], authors: [mockUser.pubkey] }),
      ]),
      expect.anything(),
    );

    expect(result.current.savedCaches.length).toBe(1);
    expect(result.current.savedCaches[0].id).toBe(sampleGeocache.id);
    expect(result.current.isCacheSaved(sampleGeocache.id, sampleGeocache.dTag, sampleGeocache.pubkey)).toBe(true);
  });

  it('should save a new cache by adding a tag to the list and republishing', async () => {
    const newGeocache: Geocache = { ...sampleGeocache, id: 'event2', dTag: 'dtag2' };
    const newNaddr = `${NIP_GC_KINDS.GEOCACHE}:${newGeocache.pubkey}:${newGeocache.dTag}`;
    
    mockNostr.query.mockResolvedValueOnce([initialBookmarkList]); // Initial fetch
    mockNostr.query.mockResolvedValueOnce([sampleGeocache]);

    const { result } = renderHook(() => useNostrSavedCaches(), {
      wrapper: createTestWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await result.current.toggleSaveCache(newGeocache);

    expect(mockPublish).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 10003,
        tags: expect.arrayContaining([
          ['a', naddr],
          ['a', newNaddr],
        ]),
      }),
    );
  });

  it('should unsave a cache by removing a tag from the list and republishing', async () => {
    mockNostr.query.mockResolvedValueOnce([initialBookmarkList]);
    mockNostr.query.mockResolvedValueOnce([sampleGeocache]);

    const { result } = renderHook(() => useNostrSavedCaches(), {
      wrapper: createTestWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await result.current.toggleSaveCache(sampleGeocache);

    expect(mockPublish).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 10003,
        tags: [],
      }),
    );
  });

  it('should clear all saved caches by publishing a kind 5 deletion event', async () => {
    mockNostr.query.mockResolvedValueOnce([initialBookmarkList]);
    mockNostr.query.mockResolvedValueOnce([sampleGeocache]);

    const { result } = renderHook(() => useNostrSavedCaches(), {
      wrapper: createTestWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await result.current.clearAllSaved();

    const expectedCoord = `${10003}:${mockUser.pubkey}`;
    expect(mockPublish).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 5,
        tags: [['a', expectedCoord]],
      }),
    );
  });

  it('should create a new list if one does not exist when saving a cache', async () => {
    const newGeocache: Geocache = { ...sampleGeocache, id: 'event3', dTag: 'dtag3' };
    const newNaddr = `${NIP_GC_KINDS.GEOCACHE}:${newGeocache.pubkey}:${newGeocache.dTag}`;
    
    mockNostr.query.mockResolvedValueOnce([]); // No initial list
    mockNostr.query.mockResolvedValueOnce([]);

    const { result } = renderHook(() => useNostrSavedCaches(), {
      wrapper: createTestWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await result.current.toggleSaveCache(newGeocache);

    expect(mockPublish).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 10003,
        tags: [['a', newNaddr]],
      }),
    );
  });
});
