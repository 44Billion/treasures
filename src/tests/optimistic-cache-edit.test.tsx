import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEditGeocache } from '@/features/geocache/hooks/useEditGeocache';
import type { Geocache } from '@/types/geocache';

// Mock dependencies
vi.mock('@/shared/hooks/useNostrPublish', () => ({
  useNostrPublish: () => ({
    mutateAsync: vi.fn().mockResolvedValue({
      id: 'updated-event-id',
      pubkey: 'test-pubkey',
      content: 'Updated description',
      tags: [['d', 'test-dtag']],
      created_at: Math.floor(Date.now() / 1000),
    }),
  }),
}));

vi.mock('@/shared/hooks/useToast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

describe('Optimistic Cache Editing', () => {
  let queryClient: QueryClient;

  const mockGeocache: Geocache = {
    id: 'test-cache-id',
    dTag: 'test-dtag',
    pubkey: 'test-pubkey',
    name: 'Original Cache Name',
    description: 'Original description',
    location: { lat: 40.7128, lng: -74.0060 },
    difficulty: 2,
    terrain: 3,
    size: 'regular',
    type: 'traditional',
    hint: 'Original hint',
    images: [],
    hidden: false,
    created_at: Date.now() / 1000,
    foundCount: 5,
    logCount: 8,
    relays: ['wss://relay.example.com'],
    verificationPubkey: 'verification-key',
  };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    // Pre-populate cache with original geocache data
    queryClient.setQueryData(['geocache', mockGeocache.id], mockGeocache);
    queryClient.setQueryData(['geocaches'], [mockGeocache]);
    queryClient.setQueryData(['user-geocaches', mockGeocache.pubkey], [mockGeocache]);
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );

  it('should immediately update cached data when editing a geocache', async () => {
    const { result } = renderHook(() => useEditGeocache(mockGeocache), { wrapper });

    // Verify initial state
    const initialGeocache = queryClient.getQueryData(['geocache', mockGeocache.id]);
    expect(initialGeocache).toEqual(mockGeocache);

    // Trigger edit mutation
    const editData = {
      name: 'Updated Cache Name',
      description: 'Updated description',
      hint: 'Updated hint',
      difficulty: 4,
      terrain: 2,
      size: 'small',
      type: 'mystery',
      images: ['https://example.com/image.jpg'],
      hidden: true,
      location: { lat: 41.0, lng: -75.0 },
    };

    result.current.mutate(editData);

    // Wait for optimistic update to be applied
    await waitFor(() => {
      const updatedGeocache = queryClient.getQueryData(['geocache', mockGeocache.id]) as Geocache;
      expect(updatedGeocache.name).toBe('Updated Cache Name');
      expect(updatedGeocache.description).toBe('Updated description');
      expect(updatedGeocache.difficulty).toBe(4);
      expect(updatedGeocache.terrain).toBe(2);
      expect(updatedGeocache.hidden).toBe(true);
    });

    // Verify that the geocaches list is also updated
    const updatedGeocachesList = queryClient.getQueryData(['geocaches']) as Geocache[];
    expect(updatedGeocachesList[0].name).toBe('Updated Cache Name');

    // Verify that user geocaches list is also updated
    const updatedUserGeocaches = queryClient.getQueryData(['user-geocaches', mockGeocache.pubkey]) as Geocache[];
    expect(updatedUserGeocaches[0].name).toBe('Updated Cache Name');
  });

  it('should preserve foundCount and logCount during optimistic updates', async () => {
    const { result } = renderHook(() => useEditGeocache(mockGeocache), { wrapper });

    const editData = {
      name: 'Updated Cache Name',
      description: 'Updated description',
      difficulty: 3,
      terrain: 3,
      size: 'regular',
      type: 'traditional',
    };

    result.current.mutate(editData);

    await waitFor(() => {
      const updatedGeocache = queryClient.getQueryData(['geocache', mockGeocache.id]) as Geocache;
      expect(updatedGeocache.foundCount).toBe(5); // Should preserve original count
      expect(updatedGeocache.logCount).toBe(8); // Should preserve original count
      expect(updatedGeocache.name).toBe('Updated Cache Name'); // Should update name
    });
  });

  it('should update all relevant query keys optimistically', async () => {
    const { result } = renderHook(() => useEditGeocache(mockGeocache), { wrapper });

    // Pre-populate additional cache keys
    queryClient.setQueryData(['geocache-by-dtag', mockGeocache.dTag], mockGeocache);
    queryClient.setQueryData(['nearby-geocaches'], [mockGeocache]);

    const editData = {
      name: 'Updated Cache Name',
      description: 'Updated description',
      difficulty: 3,
      terrain: 3,
      size: 'regular',
      type: 'traditional',
    };

    result.current.mutate(editData);

    await waitFor(() => {
      // Check all query keys are updated
      const updatedByDtag = queryClient.getQueryData(['geocache-by-dtag', mockGeocache.dTag]) as Geocache;
      const updatedNearby = queryClient.getQueryData(['nearby-geocaches']) as Geocache[];
      
      expect(updatedByDtag.name).toBe('Updated Cache Name');
      expect(updatedNearby[0].name).toBe('Updated Cache Name');
    });
  });
});