import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';
import { nip57 } from 'nostr-tools';

import CacheDetail from '@/pages/CacheDetail';
import { useGeocacheByNaddr } from '@/features/geocache/hooks/useGeocacheByNaddr';
import { useGeocacheLogs } from '@/features/geocache/hooks/useGeocacheLogs';
import { useZaps } from '@/features/zaps/hooks/useZaps';
import { useAuthor } from '@/features/auth/hooks/useAuthor';
import { useCurrentUser } from '@/features/auth/hooks/useCurrentUser';
import { useZapStore } from '@/shared/stores/useZapStore';

// Mock the hooks
vi.mock('@/features/geocache/hooks/useGeocacheByNaddr');
vi.mock('@/features/geocache/hooks/useGeocacheLogs');
vi.mock('@/features/zaps/hooks/useZaps');
vi.mock('@/features/auth/hooks/useAuthor');
vi.mock('@/features/auth/hooks/useCurrentUser');

const queryClient = new QueryClient();

const mockGeocache = {
  id: '1',
  naddr: 'naddr1',
  name: 'Test Geocache',
  description: 'Test Description',
  hint: 'Test Hint',
  difficulty: 1,
  terrain: 1,
  size: 'micro',
  type: 'traditional',
  pubkey: 'test-pubkey',
  created_at: Date.now() / 1000,
  location: { lat: 0, lng: 0 },
  images: [],
};

const regularZap = {
  tags: [
    ['p', 'recipient-pubkey'],
    ['P', 'sender-pubkey'],
    ['bolt11', 'lnbc100n1pjz...'], // 10 sats
  ],
};

const selfZap = {
  tags: [
    ['p', 'same-pubkey'],
    ['P', 'same-pubkey'],
    ['bolt11', 'lnbc200n1pjz...'], // 20 sats
  ],
};

vi.spyOn(nip57, 'getSatoshisAmountFromBolt11').mockImplementation((bolt11: string) => {
  if (bolt11 === 'lnbc100n1pjz...') return 10;
  if (bolt11 === 'lnbc200n1pjz...') return 20;
  return 0;
});

const mockZaps = [regularZap, selfZap];

const mockAuthor = {
  data: {
    metadata: {
      name: 'Test Author',
      picture: 'https://example.com/avatar.jpg',
    },
  },
};

const mockUser = {
  pubkey: 'test-user-pubkey',
};

describe('CacheDetail Zap Display', () => {
  beforeEach(() => {
    vi.mocked(useGeocacheByNaddr).mockReturnValue({ data: mockGeocache, isLoading: false, isError: false });
    vi.mocked(useGeocacheLogs).mockReturnValue({ data: [], refetch: vi.fn() });
    vi.mocked(useZaps).mockReturnValue({ data: mockZaps, refetch: vi.fn() });
    vi.mocked(useAuthor).mockReturnValue(mockAuthor);
    vi.mocked(useCurrentUser).mockReturnValue({ user: mockUser });

    // Reset zap store before each test
    useZapStore.setState({ zaps: {} });
  });

  it('should display the total zap amount correctly, excluding self-zaps', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/cache/naddr1']}>
          <Routes>
            <Route path="/cache/:naddr" element={<CacheDetail />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Wait for the component to process zaps
    await waitFor(() => {
      // The useZaps hook will update the store, so we check the store directly
      const zapTotal = useZapStore.getState().getZapTotal('naddr:naddr1');
      expect(zapTotal).toBe(10);
    });
  });
});
