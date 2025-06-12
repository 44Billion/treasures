import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RegenerateQRDialog } from '@/components/RegenerateQRDialog';
import type { Geocache } from '@/types/geocache';

// Mock the dependencies
vi.mock('@/hooks/useRegenerateVerificationKey', () => ({
  useRegenerateVerificationKey: () => ({
    mutate: vi.fn((_, { onSuccess }) => {
      // Simulate successful regeneration
      setTimeout(() => {
        onSuccess({
          event: {
            id: 'new-event-id',
            kind: 30001,
            content: 'Test cache description',
            tags: [['d', 'test-dtag']],
            created_at: Math.floor(Date.now() / 1000),
            pubkey: 'test-pubkey',
            sig: 'test-sig'
          },
          verificationKeyPair: {
            privateKey: new Uint8Array(32),
            publicKey: 'new-verification-pubkey',
            nsec: 'nsec1test',
            npub: 'npub1test'
          }
        });
      }, 100);
    }),
    isPending: false,
    reset: vi.fn()
  })
}));

vi.mock('@/components/VerificationQRDialog', () => ({
  VerificationQRDialog: ({ isOpen, onOpenChange, cacheName }: any) => (
    isOpen ? (
      <div data-testid="verification-qr-dialog">
        <h2>New QR Code for {cacheName}</h2>
        <button onClick={() => onOpenChange(false)}>Close</button>
      </div>
    ) : null
  )
}));

vi.mock('@/shared/utils/naddr-utils', () => ({
  geocacheToNaddr: () => 'naddr1test'
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });
  
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe('QR Regeneration Integration', () => {
  const mockGeocache: Geocache = {
    id: 'test-id',
    dTag: 'test-dtag',
    name: 'Test Cache',
    description: 'Test description',
    pubkey: 'test-pubkey',
    created_at: Math.floor(Date.now() / 1000),
    location: { lat: 40.7128, lng: -74.0060 },
    difficulty: 3,
    terrain: 2,
    size: 'regular',
    type: 'traditional',
    hint: 'Test hint',
    images: [],
    relays: ['wss://relay.example.com'],
    verificationPubkey: 'old-verification-pubkey',
    hidden: false,
    foundCount: 0,
    logCount: 0
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show new QR dialog after successful regeneration', async () => {
    const onOpenChange = vi.fn();

    render(
      <RegenerateQRDialog
        isOpen={true}
        onOpenChange={onOpenChange}
        geocache={mockGeocache}
      />,
      { wrapper: createWrapper() }
    );

    // Verify the regenerate dialog is shown
    expect(screen.getByText('Regenerate QR Code')).toBeInTheDocument();
    expect(screen.getByText(/This will create a new geocache event/)).toBeInTheDocument();

    // Click the regenerate button
    const regenerateButton = screen.getByRole('button', { name: /Regenerate QR Code/ });
    fireEvent.click(regenerateButton);

    // Wait for the regeneration to complete and new QR dialog to appear
    await waitFor(() => {
      expect(screen.getByTestId('verification-qr-dialog')).toBeInTheDocument();
    });

    // Verify the new QR dialog shows the cache name
    expect(screen.getByText('New QR Code for Test Cache')).toBeInTheDocument();

    // Verify the original dialog was closed
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('should handle cancellation properly', async () => {
    const onOpenChange = vi.fn();

    render(
      <RegenerateQRDialog
        isOpen={true}
        onOpenChange={onOpenChange}
        geocache={mockGeocache}
      />,
      { wrapper: createWrapper() }
    );

    // Click the cancel button
    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    fireEvent.click(cancelButton);

    // Verify the dialog was closed
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('should show warning about invalidating old QR codes', () => {
    render(
      <RegenerateQRDialog
        isOpen={true}
        onOpenChange={vi.fn()}
        geocache={mockGeocache}
      />,
      { wrapper: createWrapper() }
    );

    // Verify warning messages are displayed
    expect(screen.getByText(/This action will create a new geocache event/)).toBeInTheDocument();
    expect(screen.getByText(/Anyone who tries to use an old QR code will see an "Outdated QR Code" error/)).toBeInTheDocument();
    expect(screen.getByText(/Old QR codes will immediately stop working/)).toBeInTheDocument();
  });
});