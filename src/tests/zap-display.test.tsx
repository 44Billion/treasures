import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';

import CacheDetail from '@/pages/CacheDetail';
import { useGeocacheByNaddr } from '@/features/geocache/hooks/useGeocacheByNaddr';
import { useGeocacheLogs } from '@/features/geocache/hooks/useGeocacheLogs';
import { useZapStore } from '@/shared/stores/useZapStore';
import { useZaps } from '@/features/zaps/hooks/useZaps';
import { useAuthor } from '@/features/auth/hooks/useAuthor';
import { useCurrentUser } from '@/features/auth/hooks/useCurrentUser';

// Mock the hooks
vi.mock('@/features/geocache/hooks/useGeocacheByNaddr');
vi.mock('@/features/geocache/hooks/useGeocacheLogs');
vi.mock('@/features/zaps/hooks/useZaps', () => ({
  useZaps: () => ({ data: [] }),
}));
vi.mock('@/shared/stores/useZapStore', () => ({
  useZapStore: () => ({ getZapTotal: () => 42 }),
}));
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

const mockZaps = [
  { tags: [['bolt11', 'lnbc210n1pjz...']] },
  { tags: [['bolt11', 'lnbc210n1pjz...']] },
];

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
    vi.mocked(useZaps).mockReturnValue({ data: mockZaps });
    vi.mocked(useAuthor).mockReturnValue(mockAuthor);
    vi.mocked(useCurrentUser).mockReturnValue({ user: mockUser });
  });

  it('should display the total zap amount correctly', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/cache/naddr1']}>
          <Routes>
            <Route path="/cache/:naddr" element={<CacheDetail />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      const zapAmountElement = screen.getByText(/sats/);
      expect(zapAmountElement).toBeInTheDocument();
      expect(zapAmountElement.textContent).toContain('42');
    });
  });
});
