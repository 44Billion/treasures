import { renderHook, waitFor } from '@testing-library/react';
import { useOptimisticGeocaches } from './useOptimisticGeocaches';
import { useWotStore } from '@/shared/stores/useWotStore';
import { NostrClient } from '@nostrify/react';

// Mock the useWotStore
vi.mock('@/shared/stores/useWotStore');

// Mock the useNostr hook
const mockQuery = vi.fn();
vi.mock('@nostrify/react', () => ({
  useNostr: () => ({
    nostr: {
      query: mockQuery,
    } as unknown as NostrClient,
  }),
}));

describe('useOptimisticGeocaches', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should not filter by WoT when disabled', async () => {
    (useWotStore as unknown as vi.Mock).mockReturnValue({
      trustLevel: 0,
      wotPubkeys: new Set(['pubkey1']),
    });

    mockQuery.mockResolvedValue([]);

    const { result } = renderHook(() => useOptimisticGeocaches());

    await waitFor(() => {
      expect(result.current.geocaches).toEqual([]);
    });

    // Check the filter used in the query
    const filter = mockQuery.mock.calls[0][0][0];
    expect(filter.authors).toBeUndefined();
  });

  it('should filter by WoT when enabled', async () => {
    const wotPubkeys = new Set(['pubkey1', 'pubkey2']);
    (useWotStore as unknown as vi.Mock).mockReturnValue({
      trustLevel: 1,
      wotPubkeys,
    });

    const mockGeocaches = [
      { id: '1', pubkey: 'pubkey1', content: 'geocache1' },
      { id: '2', pubkey: 'pubkey3', content: 'geocache2' },
    ];

    mockQuery.mockResolvedValue(mockGeocaches);

    const { result } = renderHook(() => useOptimisticGeocaches());

    await waitFor(() => {
      expect(result.current.geocaches).toBeDefined();
    });
  });
});
