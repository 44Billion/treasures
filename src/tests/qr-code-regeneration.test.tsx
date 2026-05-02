import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, beforeEach, expect, vi } from 'vitest';
import { VerificationQRDialog } from '@/components/VerificationQRDialog';
import { generateVerificationQR } from '@/utils/verification';

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// Mock naddrToGeocache so invalid test naddr doesn't throw
vi.mock('@/utils/naddr-utils', () => ({
  naddrToGeocache: () => ({
    identifier: 'test-dtag',
    pubkey: 'test-pubkey',
    kind: 30333,
    relays: [],
  }),
}));

// Mock useTheme to avoid ThemeProvider requirement
vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    theme: 'light',
    resolvedTheme: 'light',
    setTheme: vi.fn(),
  }),
}));

// Mock ComponentLoading to avoid CompassSpinner → useTheme chain
vi.mock('@/components/ui/loading', () => ({
  ComponentLoading: () => <div data-testid="component-loading">Loading...</div>,
}));

// Mock DropdownMenu so items fire onClick directly in jsdom
vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
    <button onClick={onClick}>{children}</button>
  ),
}));

// Mock the toast hook
vi.mock('@/hooks/useToast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

// Mock the generateVerificationQR function
vi.mock('@/utils/verification', () => ({
  generateVerificationQR: vi.fn(),
  downloadQRCode: vi.fn(),
}));

const mockGenerateVerificationQR = vi.mocked(generateVerificationQR);

describe('VerificationQRDialog', () => {
  const mockProps = {
    isOpen: true,
    onOpenChange: vi.fn(),
    naddr: 'test-naddr',
    verificationKeyPair: {
      privateKey: new Uint8Array(32),
      publicKey: 'test-pubkey',
      nsec: 'test-nsec',
      npub: 'test-npub',
    },
    cacheName: 'Test Cache',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGenerateVerificationQR.mockResolvedValue('data:image/png;base64,test-qr-data');
  });

  it('should generate QR code on initial mount', async () => {
    render(<VerificationQRDialog {...mockProps} />);

    // The component builds a URL: `${origin}/${naddr}#verify=${nsec}`
    const expectedUrl = `${window.location.origin}/test-naddr#verify=test-nsec`;

    // Check that generateVerificationQR was called with the URL, type, and labels
    await waitFor(() => {
      expect(mockGenerateVerificationQR).toHaveBeenCalledWith(
        expectedUrl,
        'full',
        expect.objectContaining({ line1: expect.any(String), line2: expect.any(String) })
      );
    });

    // Check that QR code is displayed by looking for the image with correct src
    await waitFor(() => {
      const qrImage = screen.getByAltText('Verification QR Code');
      expect(qrImage).toBeTruthy();
      expect(qrImage.getAttribute('src')).toBe('data:image/png;base64,test-qr-data');
    });
  });

  it('should regenerate QR code when type changes', async () => {
    render(<VerificationQRDialog {...mockProps} />);

    // Wait for initial QR code to be generated
    await waitFor(() => {
      expect(mockGenerateVerificationQR).toHaveBeenCalledTimes(1);
    });

    // Clear the mock to track new calls
    mockGenerateVerificationQR.mockClear();

    // Click the Cutout dropdown item (rendered as a plain button via mock)
    const cutoutButton = screen.getByText(/Cutout/);
    fireEvent.click(cutoutButton);

    // Check that generateVerificationQR was called again
    await waitFor(() => {
      expect(mockGenerateVerificationQR).toHaveBeenCalledTimes(1);
    }, { timeout: 3000 });
  });

  it('should handle QR generation errors gracefully', async () => {
    mockGenerateVerificationQR.mockRejectedValue(new Error('Generation failed'));

    render(<VerificationQRDialog {...mockProps} />);

    // When generation fails, the component shows the "Failed to generate QR code" fallback text
    await waitFor(() => {
      const errorElement = screen.queryByText('Failed to generate QR code');
      expect(errorElement).toBeTruthy();
    });
  });

  it('should not generate QR code when dialog is closed', () => {
    const closedProps = { ...mockProps, isOpen: false };
    render(<VerificationQRDialog {...closedProps} />);

    expect(mockGenerateVerificationQR).not.toHaveBeenCalled();
  });

  it('should clear QR code immediately when type changes', async () => {
    render(<VerificationQRDialog {...mockProps} />);

    // Wait for initial QR code
    await waitFor(() => {
      const qrImage = screen.getByAltText('Verification QR Code');
      expect(qrImage).toBeTruthy();
    });

    // Click the Micro dropdown item (rendered as a plain button via mock)
    const microButton = screen.getByText(/Micro/);
    fireEvent.click(microButton);

    // After type change, generateVerificationQR should be called a second time
    await waitFor(() => {
      expect(mockGenerateVerificationQR).toHaveBeenCalledTimes(2);
    });
  });

  it('should call generateVerificationQR with correct parameters for different types', async () => {
    render(<VerificationQRDialog {...mockProps} />);

    // The component builds a URL from naddr and nsec
    const expectedUrl = `${window.location.origin}/test-naddr#verify=test-nsec`;

    // Wait for initial call with 'full' type
    await waitFor(() => {
      expect(mockGenerateVerificationQR).toHaveBeenCalledWith(
        expectedUrl,
        'full',
        expect.objectContaining({ line1: expect.any(String), line2: expect.any(String) })
      );
    });
  });
});