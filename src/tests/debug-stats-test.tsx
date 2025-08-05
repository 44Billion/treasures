import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAdaptiveReliableGeocaches } from '@/features/geocache/hooks/useReliableProximitySearch';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Simple test data
const testGeocaches = [
  {
    id: 'test-id-1',
    dTag: 'test-dtag-1',
    pubkey: '0000000000000000000000000000000000000000000000000000000000000001',
    name: 'Test Cache 1',
    description: 'Test description 1',
    location: { lat: 40.7128, lng: -74.0060 },
    difficulty: 1,
    terrain: 1,
    size: 'small',
    type: 'traditional',
    created_at: 1234567890,
    foundCount: 5,
    logCount: 8,
    zapTotal: 1000,
  },
];

vi.mock('@/shared/stores/hooks', () => ({
  useGeocacheStoreContext: () => ({
    fetchGeocaches: vi.fn().mockResolvedValue({
      success: true,
      data: [],
    }),
  }),
}));

vi.mock('@nostrify/react', () => ({
  useNostr: () => ({
    nostr: {
      query: vi.fn().mockResolvedValue([]),
    },
  }),
}));

vi.mock('@/shared/stores/useZapStore', () => ({
  useZapStore: vi.fn(() => ({
    setZaps: vi.fn(),
  })),
}));

vi.mock('@/shared/utils/batchQuery', () => ({
  batchedQuery: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/shared/utils/wot', () => ({
  useIsWotEnabled: () => false,
  useWotStore: () => ({
    wotPubkeys: new Set(),
  }),
}));

vi.mock('@/features/auth/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    user: null,
  }),
}));

describe('Debug Stats Test', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );

  it('should pass through data unchanged', async () => {
    console.log('TEST START - Input data:', testGeocaches[0]);

    const { result } = renderHook(
      () => useAdaptiveReliableGeocaches({
        baseGeocaches: testGeocaches,
        search: '',
      }),
      { wrapper }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const outputData = result.current.data;
    console.log('TEST END - Output data:', outputData[0]);

    // Check if the data is the same object reference
    console.log('Same object reference?', testGeocaches[0] === outputData[0]);

    // Check all properties
    expect(outputData[0]?.id).toBe(testGeocaches[0]?.id);
    expect(outputData[0]?.name).toBe(testGeocaches[0]?.name);
    expect(outputData[0]?.foundCount).toBe(testGeocaches[0]?.foundCount);
    expect(outputData[0]?.logCount).toBe(testGeocaches[0]?.logCount);
    expect(outputData[0]?.zapTotal).toBe(testGeocaches[0]?.zapTotal);
  });
});