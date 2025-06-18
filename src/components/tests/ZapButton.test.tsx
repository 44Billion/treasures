import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { ZapButton } from '../ZapButton';
import { useCurrentUser } from '@/features/auth/hooks/useCurrentUser';
import { useAuthor } from '@/features/auth/hooks/useAuthor';
import { requestProvider } from 'webln';
import { Geocache } from '@/types/geocache';

// Mock dependencies
vi.mock('@/features/auth/hooks/useCurrentUser');
vi.mock('@/features/auth/hooks/useAuthor');
vi.mock('webln');
vi.mock('@/shared/hooks/useToast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));
vi.mock('@/shared/hooks/useNostrPublish', () => ({
  useNostrPublish: () => ({
    mutate: vi.fn(),
  }),
}));

const mockGeocache: Geocache = {
  id: '1',
  name: 'Test Geocache',
  description: 'Test Description',
  hint: 'Test Hint',
  difficulty: '1',
  terrain: '1',
  size: 'micro',
  type: 'traditional',
  location: { lat: 0, lng: 0 },
  pubkey: 'test-pubkey',
  created_at: 0,
  dTag: 'test-dTag',
  relays: [],
  images: [],
  hidden: false,
  verificationPubkey: 'test-verification-pubkey',
};

describe('ZapButton', () => {
  it('should open the zap modal when clicked', async () => {
    // Arrange
    (useCurrentUser as jest.Mock).mockReturnValue({ user: { pubkey: 'test-user' } });
    (useAuthor as jest.Mock).mockReturnValue({ data: { metadata: { lud16: 'test@lud16' } } });
    (requestProvider as jest.Mock).mockResolvedValue({});

    render(<ZapButton geocache={mockGeocache} />);

    // Act
    const zapButton = await screen.findByRole('button', { name: /Zap \d+ sats/i });
    fireEvent.click(zapButton);

    // Assert
    const modal = await screen.findByTestId('zap-modal');
    expect(modal).toBeInTheDocument();
  });
});
